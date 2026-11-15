# Legacy route-to-collection inventory

This report generator creates a metadata-only, lexical map of literal Express route declarations in `server.ts` to direct `db.<collection>` references found in each route's source span.

## Run

```sh
npx tsx scripts/inventory-legacy-routes.ts server.ts
```

Optionally write a new report file (the output path must not already exist):

```sh
npx tsx scripts/inventory-legacy-routes.ts server.ts /secure/path/route-inventory.json
```

The output contains HTTP method, literal path, source line range, referenced collection names, and aggregate reference counts. It does not serialize route source, request values, user records, credentials, or tokens.

## Interpretation and safety

This is a migration-planning aid, not proof that a route is fully migrated. It uses lexical spans ending at the next literal `app.get/post/put/patch/delete/all` declaration. Helper functions, indirect calls, aliases, computed paths, other router instances, and runtime control flow are not resolved. The generated limitations travel with every report to prevent it being mistaken for a complete AST/call-graph audit.

Use the report to prioritize route conversion, then review each handler and its called helpers manually. A route is considered migrated only when its complete read/write path uses typed PostgreSQL repositories, authorization predicates, and required transactions, and PostgreSQL integration tests cover the behavior. Keep the production startup guard enabled until that gate is met.
