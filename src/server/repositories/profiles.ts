import type { PoolClient } from 'pg';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const VISIBILITY = new Set(['everyone', 'contacts', 'nobody']);
const STATUS_VISIBILITY = new Set(['everyone', 'contacts', 'selected']);

export type ProfileRecord = {
  userId: string;
  avatarUrl?: string;
  coverUrl?: string;
  bio?: string;
  websiteUrl?: string | null;
  isPrivate?: boolean;
  isVerified?: boolean;
};

export type PrivacyRecord = {
  userId: string;
  lastSeenVisibility?: 'everyone' | 'contacts' | 'nobody';
  profilePhotoVisibility?: 'everyone' | 'contacts' | 'nobody';
  statusVisibility?: 'everyone' | 'contacts' | 'selected';
  readReceiptsEnabled?: boolean;
};

function boundedText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.length > max) {
    throw new Error(`Invalid profile ${field}.`);
  }
  return value.trim();
}

function validateUserId(userId: string): void {
  if (typeof userId !== 'string' || !ID_PATTERN.test(userId)) {
    throw new Error('Invalid profile user ID.');
  }
}

/** Upserts durable profile fields. Caller owns the surrounding transaction. */
export async function upsertUserProfile(
  client: PoolClient,
  input: ProfileRecord,
): Promise<void> {
  validateUserId(input.userId);
  const avatarUrl = boundedText(input.avatarUrl ?? '', 'avatar URL', 2048);
  const coverUrl = boundedText(input.coverUrl ?? '', 'cover URL', 2048);
  const bio = boundedText(input.bio ?? '', 'bio', 2000);
  const websiteUrl = input.websiteUrl == null || input.websiteUrl === ''
    ? null : boundedText(input.websiteUrl, 'website URL', 2048);
  if (input.isPrivate !== undefined && typeof input.isPrivate !== 'boolean') {
    throw new Error('Invalid profile privacy flag.');
  }
  if (input.isVerified !== undefined && typeof input.isVerified !== 'boolean') {
    throw new Error('Invalid profile verification flag.');
  }

  await client.query(`
    INSERT INTO user_profiles (user_id, avatar_url, cover_url, bio, website_url, is_private, is_verified, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,now())
    ON CONFLICT (user_id) DO UPDATE SET
      avatar_url = EXCLUDED.avatar_url,
      cover_url = EXCLUDED.cover_url,
      bio = EXCLUDED.bio,
      website_url = EXCLUDED.website_url,
      is_private = EXCLUDED.is_private,
      is_verified = EXCLUDED.is_verified,
      updated_at = now()
  `, [input.userId, avatarUrl, coverUrl, bio, websiteUrl,
    input.isPrivate ?? false, input.isVerified ?? false]);
}

/** Upserts privacy preferences with database-enforced enum constraints. */
export async function upsertUserPrivacySettings(
  client: PoolClient,
  input: PrivacyRecord,
): Promise<void> {
  validateUserId(input.userId);
  const lastSeen = input.lastSeenVisibility ?? 'everyone';
  const photo = input.profilePhotoVisibility ?? 'everyone';
  const status = input.statusVisibility ?? 'everyone';
  const readReceipts = input.readReceiptsEnabled ?? true;
  if (!VISIBILITY.has(lastSeen) || !VISIBILITY.has(photo) ||
      !STATUS_VISIBILITY.has(status) || typeof readReceipts !== 'boolean') {
    throw new Error('Invalid privacy settings.');
  }
  await client.query(`
    INSERT INTO user_privacy_settings (
      user_id, last_seen_visibility, profile_photo_visibility,
      status_visibility, read_receipts_enabled, updated_at
    ) VALUES ($1,$2,$3,$4,$5,now())
    ON CONFLICT (user_id) DO UPDATE SET
      last_seen_visibility = EXCLUDED.last_seen_visibility,
      profile_photo_visibility = EXCLUDED.profile_photo_visibility,
      status_visibility = EXCLUDED.status_visibility,
      read_receipts_enabled = EXCLUDED.read_receipts_enabled,
      updated_at = now()
  `, [input.userId, lastSeen, photo, status, readReceipts]);
}

/** Replaces the block list atomically when called inside a transaction. */
export async function replaceUserBlocks(
  client: PoolClient,
  blockerId: string,
  blockedIds: string[],
): Promise<void> {
  validateUserId(blockerId);
  if (!Array.isArray(blockedIds) || blockedIds.length > 10_000 ||
      blockedIds.some((id) => typeof id !== 'string' || !ID_PATTERN.test(id) || id === blockerId) ||
      new Set(blockedIds).size !== blockedIds.length) {
    throw new Error('Invalid blocked-user list.');
  }
  await client.query('DELETE FROM user_blocks WHERE blocker_id = $1', [blockerId]);
  if (blockedIds.length === 0) return;
  await client.query(`
    INSERT INTO user_blocks (blocker_id, blocked_id)
    SELECT $1, blocked_id FROM unnest($2::text[]) AS blocked_id
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING
  `, [blockerId, blockedIds]);
}
