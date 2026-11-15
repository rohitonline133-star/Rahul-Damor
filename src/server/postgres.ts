import { Pool, type PoolClient, type PoolConfig } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for PostgreSQL operations.');
}

const sslMode = process.env.PGSSLMODE || 'verify-full';
const poolConfig: PoolConfig = {
  connectionString: databaseUrl,
  max: Number(process.env.PGPOOL_MAX || 20),
  connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS || 5000),
  idleTimeoutMillis: Number(process.env.PGIDLE_TIMEOUT_MS || 30000),
  statement_timeout: Number(process.env.PGSTATEMENT_TIMEOUT_MS || 15000),
  application_name: 'gb-official-api',
  ssl: sslMode === 'disable' ? false : { rejectUnauthorized: true },
};

if (!Number.isInteger(poolConfig.max) || Number(poolConfig.max) < 1 || Number(poolConfig.max) > 100) {
  throw new Error('PGPOOL_MAX must be an integer between 1 and 100.');
}
if (!['disable', 'verify-full'].includes(sslMode)) {
  throw new Error('PGSSLMODE must be disable (local development only) or verify-full.');
}

export const postgresPool = new Pool(poolConfig);

postgresPool.on('error', (error) => {
  // Do not log connection strings or query parameters.
  console.error('Unexpected idle PostgreSQL client error:', error.message);
});

export async function checkPostgresReady(): Promise<boolean> {
  const result = await postgresPool.query<{ ready: number }>('SELECT 1 AS ready');
  return result.rows[0]?.ready === 1;
}

export async function withPostgresTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await postgresPool.connect();
  try {
    await client.query('BEGIN');
    const value = await work(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original transaction error.
    }
    throw error;
  } finally {
    client.release();
  }
}
