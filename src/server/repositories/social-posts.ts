import type { PoolClient } from 'pg';
import { insertOutboxEvent } from '../outbox';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_POST_BODY_BYTES = 256 * 1024;

export type NewSocialPost = {
  id: string;
  authorId: string;
  body: Record<string, unknown>;
  visibility?: 'public' | 'followers' | 'private';
  ownerRegion?: string;
};

/**
 * Creates a post and its event in the caller-owned transaction.
 * The caller must commit both together or roll both back.
 */
export async function createSocialPost(
  client: PoolClient,
  input: NewSocialPost,
): Promise<{ id: string }> {
  if (!input || !ID_PATTERN.test(input.id) || !ID_PATTERN.test(input.authorId)) {
    throw new Error('Invalid post or author ID.');
  }
  const visibility = input.visibility ?? 'public';
  if (!['public', 'followers', 'private'].includes(visibility)) {
    throw new Error('Invalid post visibility.');
  }
  const ownerRegion = input.ownerRegion ?? 'region-unassigned';
  if (!/^[a-z0-9-]{1,64}$/.test(ownerRegion)) throw new Error('Invalid post owner region.');
  if (!input.body || typeof input.body !== 'object' || Array.isArray(input.body)) {
    throw new Error('Post body must be a JSON object.');
  }
  const serialized = JSON.stringify(input.body);
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_POST_BODY_BYTES) {
    throw new Error('Post body exceeds the 256 KiB limit.');
  }

  const inserted = await client.query<{ id: string }>(`
    INSERT INTO posts (id, author_id, body, visibility, owner_region)
    SELECT $1, a.id, $3::jsonb, $4, $5
    FROM accounts a
    WHERE a.id = $2 AND a.account_status = 'active'
    RETURNING id
  `, [input.id, input.authorId, serialized, visibility, ownerRegion]);
  const id = inserted.rows[0]?.id;
  if (!id) throw new Error('Active post author was not found.');

  await insertOutboxEvent(client, {
    aggregateType: 'post',
    aggregateId: id,
    eventType: 'created',
    partitionKey: id,
    payload: { postId: id, authorId: input.authorId, visibility },
  });
  return { id };
}

/** Privacy-aware keyset-paginated feed. Caller supplies authenticated viewer ID. */
export async function listVisibleSocialPosts(client: PoolClient, input: { viewerId: string; limit?: number; before?: { createdAt: string; id: string } }): Promise<Array<{ id: string; author_id: string; body: Record<string, unknown>; visibility: string; created_at: Date }>> {
  if (!input || !ID_PATTERN.test(input.viewerId)) throw new Error('Invalid viewer ID.');
  const limit = input.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid feed page size.');
  let beforeCreatedAt: Date | null = null;
  let beforeId: string | null = null;
  if (input.before) {
    if (!ID_PATTERN.test(input.before.id) || typeof input.before.createdAt !== 'string') throw new Error('Invalid feed cursor.');
    const parsed = new Date(input.before.createdAt);
    if (!Number.isFinite(parsed.getTime())) throw new Error('Invalid feed cursor timestamp.');
    beforeCreatedAt = parsed; beforeId = input.before.id;
  }
  const result = await client.query<{ id: string; author_id: string; body: Record<string, unknown>; visibility: string; created_at: Date }>(`
    SELECT p.id, p.author_id, p.body, p.visibility, p.created_at
    FROM posts p JOIN accounts author ON author.id = p.author_id
    WHERE p.deleted_at IS NULL AND author.account_status = 'active'
      AND (p.author_id = $1 OR NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id=p.author_id AND b.blocked_id=$1) OR (b.blocker_id=$1 AND b.blocked_id=p.author_id)))
      AND (p.author_id = $1 OR (COALESCE((SELECT up.is_private FROM user_profiles up WHERE up.user_id=p.author_id),false)=false AND p.visibility='public')
        OR (p.visibility IN ('public','followers') AND EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.following_id=p.author_id AND f.status='accepted')))
      AND (p.author_id = $1 OR NOT EXISTS (SELECT 1 FROM user_mutes m WHERE m.muter_id=$1 AND m.muted_id=p.author_id))
      AND ($2::timestamptz IS NULL OR (p.created_at,p.id)<($2::timestamptz,$3::text))
    ORDER BY p.created_at DESC,p.id DESC LIMIT $4
  `, [input.viewerId,beforeCreatedAt,beforeId,limit]);
  return result.rows;
}
/**
 * Reads a post only when the viewer is its author, it is public, or the viewer
 * follows the author through an accepted follow relationship. Authorization is
 * part of the SQL predicate rather than a caller-side check.
 */
export async function findVisibleSocialPost(
  client: PoolClient,
  input: { postId: string; viewerId: string },
): Promise<{ id: string; author_id: string; body: Record<string, unknown>; visibility: string; created_at: Date } | null> {
  if (!input || !ID_PATTERN.test(input.postId) || !ID_PATTERN.test(input.viewerId)) {
    throw new Error('Invalid post or viewer ID.');
  }
  const result = await client.query<{
    id: string;
    author_id: string;
    body: Record<string, unknown>;
    visibility: string;
    created_at: Date;
  }>(`
    SELECT p.id, p.author_id, p.body, p.visibility, p.created_at
    FROM posts p
    JOIN accounts author ON author.id = p.author_id
    WHERE p.id = $1
      AND p.deleted_at IS NULL
      AND author.account_status = 'active'
      AND (
        p.author_id = $2
        OR NOT EXISTS (
          SELECT 1 FROM user_blocks b
          WHERE (b.blocker_id = p.author_id AND b.blocked_id = $2)
             OR (b.blocker_id = $2 AND b.blocked_id = p.author_id)
        )
      )
      AND (
        p.author_id = $2
        OR (
          COALESCE((SELECT up.is_private FROM user_profiles up WHERE up.user_id = p.author_id), false) = false
          AND p.visibility = 'public'
        )
        OR (
          p.visibility IN ('public', 'followers')
          AND EXISTS (
            SELECT 1 FROM follows f
            WHERE f.follower_id = $2
              AND f.following_id = p.author_id
              AND f.status = 'accepted'
          )
        )
      )
      AND (
        p.author_id = $2
        OR NOT EXISTS (
          SELECT 1 FROM user_mutes m
          WHERE m.muter_id = $2 AND m.muted_id = p.author_id
        )
      )
    LIMIT 1
  `, [input.postId, input.viewerId]);
  return result.rows[0] ?? null;
}
