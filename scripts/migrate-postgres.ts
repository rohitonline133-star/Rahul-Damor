import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. No database changes were made.');
}

const sslMode = process.env.PGSSLMODE || 'verify-full';
if (!['disable', 'verify-full'].includes(sslMode)) {
  throw new Error('PGSSLMODE must be disable or verify-full.');
}
const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
  application_name: 'gb-official-migration',
  ssl: sslMode === 'disable' ? false : { rejectUnauthorized: true },
});

const migrationId = '0001_core';
const migrationPath = path.resolve(process.cwd(), 'infra/migrations/0001_core.sql');
const sql = await readFile(migrationPath, 'utf8');
const checksum = createHash('sha256').update(sql).digest('hex');
const client = await pool.connect();

try {
  await client.query('SELECT pg_advisory_lock($1)', [741902611]);
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const existing = await client.query(
    'SELECT checksum FROM schema_migrations WHERE migration_id = $1',
    [migrationId],
  );

  if (existing.rowCount) {
    if (existing.rows[0].checksum !== checksum) {
      throw new Error(`Migration checksum mismatch for ${migrationId}; refusing to continue.`);
    }
    process.stdout.write(`Migration ${migrationId} already applied; checksum verified.\\n`);
  } else {
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (migration_id, checksum) VALUES ($1, $2)',
        [migrationId, checksum],
      );
      await client.query('COMMIT');
      process.stdout.write(`Applied migration ${migrationId}.\\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [741902611]);
  } finally {
    client.release();
    await pool.end();
  }
}
