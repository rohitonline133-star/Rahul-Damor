import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { replaceUserBlocks, upsertUserPrivacySettings, upsertUserProfile } from '../src/server/repositories/profiles';

function fakeClient() {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return { rows: [], rowCount: 1 };
    },
  } as unknown as PoolClient;
  return { client, calls };
}

test('profile upsert preserves profile and verification fields in PostgreSQL', async () => {
  const { client, calls } = fakeClient();
  await upsertUserProfile(client, {
    userId: 'acct_1', avatarUrl: 'https://cdn.example/avatar.png',
    coverUrl: 'https://cdn.example/cover.png', bio: 'Hello',
    websiteUrl: 'https://example.com', isPrivate: true,
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO user_profiles/);
  assert.match(calls[0].sql, /ON CONFLICT \(user_id\) DO UPDATE/);
  assert.equal(calls[0].values?.[0], 'acct_1');
  assert.equal(calls[0].values?.[5], true);
  assert.doesNotMatch(calls[0].sql, /is_verified\s*=\s*EXCLUDED/i);
});

test('profile rejects overlong bio before querying', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => upsertUserProfile(client, {
    userId: 'acct_1', bio: 'x'.repeat(2001),
  }));
  assert.equal(calls.length, 0);
});

test('privacy preferences are persisted with constrained visibility values', async () => {
  const { client, calls } = fakeClient();
  await upsertUserPrivacySettings(client, {
    userId: 'acct_1', lastSeenVisibility: 'contacts',
    profilePhotoVisibility: 'nobody', statusVisibility: 'selected',
    readReceiptsEnabled: false,
  });
  assert.match(calls[0].sql, /INSERT INTO user_privacy_settings/);
  assert.deepEqual(calls[0].values, ['acct_1', 'contacts', 'nobody', 'selected', false]);
});

test('privacy settings reject unsupported visibility values before querying', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => upsertUserPrivacySettings(client, {
    userId: 'acct_1', lastSeenVisibility: 'public' as 'everyone',
  }));
  assert.equal(calls.length, 0);
});

test('block-list replacement deletes then inserts within caller transaction', async () => {
  const { client, calls } = fakeClient();
  await replaceUserBlocks(client, 'acct_1', ['acct_2', 'acct_3']);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /DELETE FROM user_blocks/);
  assert.match(calls[1].sql, /INSERT INTO user_blocks/);
  assert.deepEqual(calls[1].values, ['acct_1', ['acct_2', 'acct_3']]);
});

test('block-list replacement rejects self-blocks and duplicates before querying', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => replaceUserBlocks(client, 'acct_1', ['acct_1']));
  await assert.rejects(() => replaceUserBlocks(client, 'acct_1', ['acct_2', 'acct_2']));
  assert.equal(calls.length, 0);
});
