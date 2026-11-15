import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARRAY_COLLECTIONS = [
  'users', 'conversations', 'messages', 'statuses', 'communities', 'calls',
  'reports', 'notifications', 'posts', 'channels', 'followers', 'follow_requests',
  'verification_requests', 'blocked_users', 'muted_users', 'location_shares',
  'shop_products', 'shop_orders', 'payment_methods', 'transactions', 'devices',
  'custom_lists', 'broadcast_lists', 'phone_verifications', 'sessions',
  'security_logs', 'security_notifications', 'oauth_accounts', 'password_resets',
] as const;

const OBJECT_COLLECTIONS = ['shop_cart', 'subscriptions', 'two_factor_auth'] as const;
const NEVER_IMPORT = new Set(['sessions', 'password_resets', 'phone_verifications']);
const KNOWN_COLLECTIONS = new Set<string>([...ARRAY_COLLECTIONS, ...OBJECT_COLLECTIONS]);

export interface LegacyAuditManifest {
  formatVersion: 1;
  sourceSha256: string;
  sourceBytes: number;
  auditedAt: string;
  collections: Record<string, { shape: 'array' | 'object'; records: number; duplicateIds: number; recordsWithoutStringId: number; importPolicy: 'review-required' | 'never-import' }>;
  unknownKeys: string[];
  errors: string[];
  warnings: string[];
}

export function auditLegacyJson(sourcePath: string): LegacyAuditManifest {
  const absolutePath = path.resolve(sourcePath);
  const raw = fs.readFileSync(absolutePath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new Error('Legacy database is not valid UTF-8 JSON; no data was changed.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Legacy database root must be a JSON object; no data was changed.');
  }

  const source = parsed as Record<string, unknown>;
  const collections: LegacyAuditManifest['collections'] = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of ARRAY_COLLECTIONS) {
    const value = source[key];
    if (value === undefined) {
      collections[key] = { shape: 'array', records: 0, duplicateIds: 0, recordsWithoutStringId: 0, importPolicy: NEVER_IMPORT.has(key) ? 'never-import' : 'review-required' };
      continue;
    }
    if (!Array.isArray(value)) {
      errors.push(`"${key}" must be an array.`);
      continue;
    }
    const seen = new Set<string>();
    let duplicateIds = 0;
    let recordsWithoutStringId = 0;
    for (const record of value) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        errors.push(`"${key}" contains a non-object record.`);
        continue;
      }
      const id = (record as Record<string, unknown>).id;
      if (typeof id !== 'string' || id.length === 0) {
        recordsWithoutStringId += 1;
        continue;
      }
      if (seen.has(id)) duplicateIds += 1;
      seen.add(id);
    }
    if (duplicateIds) errors.push(`"${key}" contains ${duplicateIds} duplicate record ID(s).`);
    if (recordsWithoutStringId) warnings.push(`"${key}" contains ${recordsWithoutStringId} record(s) without a non-empty string ID; manual mapping is required.`);
    collections[key] = { shape: 'array', records: value.length, duplicateIds, recordsWithoutStringId, importPolicy: NEVER_IMPORT.has(key) ? 'never-import' : 'review-required' };
  }

  for (const key of OBJECT_COLLECTIONS) {
    const value = source[key];
    if (value === undefined) {
      collections[key] = { shape: 'object', records: 0, duplicateIds: 0, recordsWithoutStringId: 0, importPolicy: 'review-required' };
      continue;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`"${key}" must be an object/map.`);
      continue;
    }
    collections[key] = { shape: 'object', records: Object.keys(value).length, duplicateIds: 0, recordsWithoutStringId: 0, importPolicy: 'review-required' };
  }

  const unknownKeys = Object.keys(source).filter((key) => !KNOWN_COLLECTIONS.has(key)).sort();
  if (unknownKeys.length) warnings.push('Unknown top-level keys require manual schema review.');
  warnings.push('This is a metadata-only audit. It does not import, export, repair, or modify source data.');
  warnings.push('Session tokens, password-reset tokens, and pending OTP records are marked never-import.');
  warnings.push('Two-factor authentication material requires a separately reviewed encryption and key-rotation process.');

  return {
    formatVersion: 1,
    sourceSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    sourceBytes: raw.byteLength,
    auditedAt: new Date().toISOString(),
    collections,
    unknownKeys,
    errors,
    warnings,
  };
}

function runCli() {
  const sourcePath = process.argv[2];
  const manifestPath = process.argv[3];
  if (!sourcePath) {
    process.stderr.write('Usage: npm run db:audit-legacy -- <path-to-database.json> [manifest-output.json]\\n');
    process.exitCode = 2;
    return;
  }
  try {
    const manifest = auditLegacyJson(sourcePath);
    const output = JSON.stringify(manifest, null, 2) + '\\n';
    if (manifestPath) fs.writeFileSync(path.resolve(manifestPath), output, { flag: 'wx', mode: 0o600 });
    process.stdout.write(output);
    if (manifest.errors.length) process.exitCode = 1;
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : 'Legacy audit failed') + '\\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
