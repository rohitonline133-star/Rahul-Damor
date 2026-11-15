import type { PoolClient } from 'pg';
import { insertOutboxEvent } from '../outbox';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const CLIENT_ID = /^[A-Za-z0-9_-]{8,128}$/;
const MAX_COMMENT_LENGTH = 5000;

function validatePair(postId: string, userId: string): void {
  if (!ID.test(postId) || !ID.test(userId)) throw new Error('Invalid post or account ID.');
}

const VISIBLE_POST = `
  p.id = $1
  AND p.deleted_at IS NULL
  AND author.account_status = 'active'
  AND (
    p.author_id = $2
    OR p.visibility = 'public'
    OR (
      p.visibility = 'followers'
      AND EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = $2
          AND f.following_id = p.author_id
          AND f.status = 'accepted'
      )
    )
  )
`;

/** Like is idempotent per account/post and authorized in the INSERT predicate. */
export async function likePost(
  client: PoolClient,
  input: { postId: string; userId: string },
): Promise<{ liked: boolean }> {
  validatePair(input.postId, input.userId);
  const inserted = await client.query<{ post_id: string }>(`
    INSERT INTO post_likes (post_id, user_id)
    SELECT p.id, $2
    FROM posts p
    JOIN accounts author ON author.id = p.author_id
    WHERE ${VISIBLE_POST}
      AND EXISTS (SELECT 1 FROM accounts viewer WHERE viewer.id = $2 AND viewer.account_status = 'active')
    ON CONFLICT (post_id, user_id) DO NOTHING
    RETURNING post_id
  `, [input.postId, input.userId]);
  if (inserted.rows[0]) {
    await insertOutboxEvent(client, {
      aggregateType: 'post', aggregateId: input.postId, eventType: 'liked',
      partitionKey: input.postId, payload: { postId: input.postId, userId: input.userId },
    });
    return { liked: true };
  }
  const existing = await client.query(`
    SELECT 1 FROM post_likes l
    JOIN posts p ON p.id = l.post_id
    JOIN accounts author ON author.id = p.author_id
    WHERE l.post_id = $1 AND l.user_id = $2 AND ${VISIBLE_POST}
    LIMIT 1
  `, [input.postId, input.userId]);
  if (existing.rows[0]) return { liked: false };
  throw new Error('Post is not available to this account.');
}

/** Remove only the caller's own like; does not reveal other users' reactions. */
export async function unlikePost(
  client: PoolClient,
  input: { postId: string; userId: string },
): Promise<{ unliked: boolean }> {
  validatePair(input.postId, input.userId);
  const removed = await client.query<{ post_id: string }>(`
    DELETE FROM post_likes l
    USING posts p, accounts author
    WHERE l.post_id = p.id AND p.author_id = author.id
      AND l.post_id = $1 AND l.user_id = $2
      AND ${VISIBLE_POST}
    RETURNING l.post_id
  `, [input.postId, input.userId]);
  if (removed.rows[0]) {
    await insertOutboxEvent(client, {
      aggregateType: 'post', aggregateId: input.postId, eventType: 'unliked',
      partitionKey: input.postId, payload: { postId: input.postId, userId: input.userId },
    });
  }
  return { unliked: Boolean(removed.rows[0]) };
}

/** Add a bounded comment; duplicate client IDs cannot create duplicate comments. */
export async function addPostComment(
  client: PoolClient,
  input: { id: string; postId: string; authorId: string; clientCommentId: string; body: string },
): Promise<{ id: string; duplicate: boolean }> {
  if (!ID.test(input.id) || !ID.test(input.postId) || !ID.test(input.authorId)) {
    throw new Error('Invalid comment, post or account ID.');
  }
  if (!CLIENT_ID.test(input.clientCommentId)) throw new Error('Invalid client comment ID.');
  if (typeof input.body !== 'string' || !input.body.trim() || input.body.length > MAX_COMMENT_LENGTH) {
    throw new Error('Comment must contain between 1 and 5000 characters.');
  }
  const inserted = await client.query<{ id: string }>(`
    INSERT INTO post_comments (id, post_id, author_id, client_comment_id, body)
    SELECT $1, p.id, $3, $4, $5
    FROM posts p
    JOIN accounts author ON author.id = p.author_id
    JOIN accounts commenter ON commenter.id = $3 AND commenter.account_status = 'active'
    WHERE ${VISIBLE_POST}
    ON CONFLICT (author_id, client_comment_id) DO NOTHING
    RETURNING id
  `, [input.postId, input.authorId, input.authorId, input.clientCommentId, input.body.trim()]);
  if (inserted.rows[0]) {
    await insertOutboxEvent(client, {
      aggregateType: 'post', aggregateId: input.postId, eventType: 'commented',
      partitionKey: input.postId,
      payload: { postId: input.postId, commentId: inserted.rows[0].id, authorId: input.authorId },
    });
    return { id: inserted.rows[0].id, duplicate: false };
  }
  const existing = await client.query<{ id: string }>(`
    SELECT c.id FROM post_comments c
    JOIN posts p ON p.id = c.post_id
    JOIN accounts author ON author.id = p.author_id
    WHERE c.author_id = $1 AND c.client_comment_id = $2
      AND c.post_id = $3 AND c.deleted_at IS NULL
      AND ${VISIBLE_POST}
    LIMIT 1
  `, [input.authorId, input.clientCommentId, input.postId, input.authorId]);
  if (existing.rows[0]) return { id: existing.rows[0].id, duplicate: true };
  throw new Error('Post is not available or comment could not be created.');
}

/** Comment deletion is owner-scoped and soft-deletes the selected comment. */
export async function deleteOwnPostComment(
  client: PoolClient,
  input: { commentId: string; authorId: string },
): Promise<boolean> {
  if (!ID.test(input.commentId) || !ID.test(input.authorId)) throw new Error('Invalid comment or account ID.');
  const result = await client.query(`
    UPDATE post_comments
    SET deleted_at = now(), updated_at = now(), body = '[deleted]'
    WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL
  `, [input.commentId, input.authorId]);
  return result.rowCount === 1;
}
