import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface LegacyRouteInventoryEntry {
  method: string;
  path: string;
  startLine: number;
  endLine: number;
  collections: string[];
}

export interface LegacyRouteInventory {
  sourceFile: string;
  routeCount: number;
  directDatabaseReferenceCount: number;
  collectionReferenceCounts: Record<string, number>;
  routes: LegacyRouteInventoryEntry[];
  limitations: string[];
}

const ROUTE_START = /\\bapp\\.(get|post|put|patch|delete|all)\\s*\\(\\s*(['"])([^'"]+)\\2/g;
const DB_REFERENCE = /\\bdb\\.([A-Za-z_$][\\w$]*)/g;

export function inventoryLegacyRoutes(source: string, sourceFile = 'server.ts'): LegacyRouteInventory {
  const matches: Array<{ method: string; routePath: string; index: number }> = [];
  for (const match of source.matchAll(ROUTE_START)) {
    if (match.index === undefined) continue;
    matches.push({ method: match[1].toUpperCase(), routePath: match[3], index: match.index });
  }

  const routes: LegacyRouteInventoryEntry[] = [];
  const collectionReferenceCounts: Record<string, number> = {};
  let directDatabaseReferenceCount = 0;

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const start = current.index;
    const end = matches[index + 1]?.index ?? source.length;
    const segment = source.slice(start, end);
    const startLine = source.slice(0, start).split('\\n').length;
    const endLine = source.slice(0, end).split('\\n').length;
    const collections = new Set<string>();

    for (const reference of segment.matchAll(DB_REFERENCE)) {
      const collection = reference[1];
      collections.add(collection);
      collectionReferenceCounts[collection] = (collectionReferenceCounts[collection] || 0) + 1;
      directDatabaseReferenceCount += 1;
    }

    routes.push({
      method: current.method,
      path: current.routePath,
      startLine,
      endLine,
      collections: [...collections].sort(),
    });
  }

  return {
    sourceFile,
    routeCount: routes.length,
    directDatabaseReferenceCount,
    collectionReferenceCounts: Object.fromEntries(
      Object.entries(collectionReferenceCounts).sort(([a], [b]) => a.localeCompare(b)),
    ),
    routes,
    limitations: [
      'This is a lexical inventory, not a TypeScript AST or call-graph analysis.',
      'A route span ends at the next literal app.<method> declaration; helper functions and indirect database access may be attributed imperfectly or missed.',
      'Computed route paths, router instances other than app, aliases, and repository calls are not expanded.',
      'No source record values, credentials, tokens, or personal data are read into the report.',
    ],
  };
}

function runCli() {
  const sourcePath = process.argv[2] || 'server.ts';
  const outputPath = process.argv[3];
  try {
    const report = inventoryLegacyRoutes(fs.readFileSync(path.resolve(sourcePath), 'utf8'), path.basename(sourcePath));
    const output = JSON.stringify(report, null, 2) + '\\n';
    if (outputPath) fs.writeFileSync(path.resolve(outputPath), output, { flag: 'wx', mode: 0o600 });
    process.stdout.write(output);
  } catch {
    process.stderr.write('Route inventory failed; check the source path and permissions.\\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
