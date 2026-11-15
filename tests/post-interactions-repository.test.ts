import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { addPostComment, deleteOwnPostComment, likePost, unlikePost } from '../src/server/repositories/post-interactions';

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

test('like is authorized in SQL and emits one outbox event for a new like', async () => {
  const { client, calls } = fakeClient([[{ post_id: 'post_1' }], [{ event_id: 'evt_1' }]]);
  assert.deepEqual(await likePost(client, { postId: 'post_1', userId: 'acct_2' }), { liked: true });
  assert.match(calls[0].sql, /p\.deleted_at IS NULL/);
  assert.match(calls[0].sql, /f\.status = 'accepted'/);
  assert.match(calls[0].sql, /ON CONFLICT \(post_id, user_id\) DO NOTHING/);
  assert.match(calls[1].sql, /INSERT INTO event_outbox/);
});

test('repeat like is idempotent and does not emit a second event', async () => {
  const { client, calls } = fakeClient([[], [{}]]);
  assert.deepEqual(await likePost(client, { postId: 'post_1', userId: 'acct_2' }), { liked: false });
  assert.equal(calls.length, 2);
});

test('unlike removes only the caller like and writes an outbox event when changed', async () => {
  const { client, calls } = fakeClient([[{ post_id: 'post_1' }], [{ event_id: 'evt_2' }]]);
  assert.deepEqual(await unlikePost(client, { postId: 'post_1', userId: 'acct_2' }), { unliked: true });
  assert.match(calls[0].sql, /l\.user_id = \$2/);
  assert.match(calls[1].sql, /unliked/);
});

test('comment insert checks visibility, bounds content and uses client id idempotency', async () => {
  const { client, calls } = fakeClient([[{ id: 'comment_1' }], [{ event_id: 'evt_3' }]]);
  assert.deepEqual(await addPostComment(client, {
    id: 'comment_1', postId: 'post_1', authorId: 'acct_2',
    clientCommentId: 'comment_client_123', body: 'Nice post',
  }), { id: 'comment_1', duplicate: false });
  assert.match(calls[0].sql, /p\.deleted_at IS NULL/);
  assert.match(calls[0].sql, /ON CONFLICT \(author_id, client_comment_id\) DO NOTHING/);
  assert.match(calls[1].sql, /commented/);
});

test('duplicate comment returns existing comment without duplicate event', async () => {
  const { client, calls } = fakeClient([[], [{ id: 'comment_existing' }]]);
  assert.deepEqual(await addPostComment(client, {
    id: 'comment_retry', postId: 'post_1', authorId: 'acct_2',
    clientCommentId: 'comment_client_123', body: 'Nice post',
  }), { id: 'comment_existing', duplicate: true });
  assert.equal(calls.length, 2);
});

test('comment deletion is restricted to its author', async () => {
  const { client, calls } = fakeClient([[]]);
  assert.equal(await deleteOwnPostComment(client, { commentId: 'comment_1', authorId: 'acct_3' }), false);
  assert.match(calls[0].sql, /id = \$1 AND author_id = \$2/);
});

test('invalid identifiers and oversized comments are rejected before SQL', async () => {
  const { client, calls } = fakeClient([]);
  await assert.rejects(() => likePost(client, { postId: 'bad id', userId: 'acct_1' }));
  await assert.rejects(() => addPostComment(client, {
    id: 'comment_1', postId: 'post_1', authorId: 'acct_1',
    clientCommentId: 'comment_client_123', body: 'x'.repeat(5001),
  }));
  assert.equal(calls.length, 0);
});
