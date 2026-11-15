import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { createSocialPost, findVisibleSocialPost } from '../src/server/repositories/social-posts';

function fakeClient(responses: unknown[][]) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return { rows: responses.shift() ?? [], rowCount: 1 };
    },
  } as unknown as PoolClient;
  return { client, calls };
}

test('creates a post only for an active author and writes its outbox event', async () => {
  const { client, calls } = fakeClient([[{ id: 'post_1' }], [{ event_id: 'evt_1' }]]);
  assert.deepEqual(await createSocialPost(client, {
    id: 'post_1', authorId: 'acct_1', body: { text: 'Hello' }, visibility: 'followers',
  }), { id: 'post_1' });
  assert.match(calls[0].sql, /account_status = 'active'/);
  assert.match(calls[1].sql, /INSERT INTO event_outbox/);
  assert.deepEqual(calls[1].values?.slice(0, 5), ['post', 'post_1', 'created', 1, 'post_1']);
});

test('rejects missing authors and invalid or oversized content before outbox insertion', async () => {
  const missing = fakeClient([[]]);
  await assert.rejects(() => createSocialPost(missing.client, {
    id: 'post_1', authorId: 'acct_1', body: { text: 'Hello' },
  }), /author was not found/);
  assert.equal(missing.calls.length, 1);

  const invalid = fakeClient([]);
  await assert.rejects(() => createSocialPost(invalid.client, {
    id: 'post_1', authorId: 'acct_1', body: { text: 'x'.repeat(270_000) },
  }), /256 KiB/);
  assert.equal(invalid.calls.length, 0);
});

test('visible-post lookup enforces author, public, accepted-follower and deletion predicates in SQL', async () => {
  const { client, calls } = fakeClient([[{
    id: 'post_1', author_id: 'acct_1', body: { text: 'Hello' },
    visibility: 'followers', created_at: new Date(),
  }]]);
  const result = await findVisibleSocialPost(client, { postId: 'post_1', viewerId: 'acct_2' });
  assert.equal(result?.id, 'post_1');
  assert.match(calls[0].sql, /p\.deleted_at IS NULL/);
  assert.match(calls[0].sql, /p\.author_id = \$2/);
  assert.match(calls[0].sql, /p\.visibility = 'public'/);
  assert.match(calls[0].sql, /f\.status = 'accepted'/);
  assert.match(calls[0].sql, /f\.follower_id = \$2/);
  assert.match(calls[0].sql, /f\.following_id = p\.author_id/);
});

test('returns no post when the SQL authorization predicate finds no visible row', async () => {
  const { client } = fakeClient([[]]);
  assert.equal(await findVisibleSocialPost(client, { postId: 'post_1', viewerId: 'acct_2' }), null);
});

test('validates identifiers and visibility before database access', async () => {
  const { client, calls } = fakeClient([]);
  await assert.rejects(() => findVisibleSocialPost(client, { postId: 'bad id', viewerId: 'acct_1' }));
  await assert.rejects(() => createSocialPost(client, {
    id: 'post_1', authorId: 'acct_1', body: { text: 'x' }, visibility: 'everyone' as 'public',
  }));
  assert.equal(calls.length, 0);
});
