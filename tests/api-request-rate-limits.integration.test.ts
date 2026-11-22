import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { consumeApiRequestQuota } from '../src/server/repositories/api-request-rate-limits';

test('PostgreSQL quota serializes concurrent requests across transactions', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const { postgresPool, withPostgresTransaction } = await import('../src/server/postgres');
  const secret = randomUUID() + randomUUID();
  const value = 'integration-' + randomUUID();
  const keyHash = createHmac('sha256', secret).update('ip:' + value).digest('hex');
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      withPostgresTransaction((client) => consumeApiRequestQuota(client, [
        { scope: 'ip', value, maxRequests: 3 },
      ], secret))
    ));
    assert.equal(results.filter((result) => result.allowed).length, 3);
    assert.equal(results.filter((result) => !result.allowed).length, 5);
    const stored = await postgresPool.query<{
      key_hash: string; request_count: number; blocked_until: Date | null;
    }>(
      'SELECT key_hash, request_count, blocked_until FROM api_request_rate_limits WHERE scope = $1 AND key_hash = $2',
      ['ip', keyHash],
    );
    assert.equal(stored.rowCount, 1);
    assert.equal(Number(stored.rows[0].request_count), 3);
    assert.ok(stored.rows[0].blocked_until instanceof Date);
    assert.equal(stored.rows[0].key_hash, keyHash);
  } finally {
    await postgresPool.query(
      'DELETE FROM api_request_rate_limits WHERE scope = $1 AND key_hash = $2',
      ['ip', keyHash],
    );
    await postgresPool.end();
  }
});
