import type { PoolClient } from 'pg';
import { insertOutboxEvent } from '../outbox';

export type NewAccount = {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  homeRegion?: string;
};

export type LoginAccount = {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  password_hash: string;
  password_salt: string;
  account_status: 'active' | 'suspended' | 'deletion_pending' | 'deleted';
};

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{3,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

function requiredText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new Error(`Invalid account ${field}.`);
  }
  return value.trim();
}

/**
 * Creates an account inside the caller's transaction. Password material must
 * already be derived by the authentication service; plaintext is never accepted.
 */
export async function createAccount(client: PoolClient, input: NewAccount): Promise<{ id: string }> {
  if (!input || !ID_PATTERN.test(input.id)) throw new Error('Invalid account ID.');
  const username = requiredText(input.username, 'username', 30);
  if (!USERNAME_PATTERN.test(username)) throw new Error('Invalid account username.');
  const displayName = requiredText(input.displayName, 'display name', 80);
  const passwordHash = requiredText(input.passwordHash, 'password hash', 512);
  const passwordSalt = requiredText(input.passwordSalt, 'password salt', 256);
  const email = input.email == null ? null : requiredText(input.email, 'email', 254).toLowerCase();
  if (email && !EMAIL_PATTERN.test(email)) throw new Error('Invalid account email.');
  const phone = input.phone == null ? null : requiredText(input.phone, 'phone', 16);
  if (phone && !E164_PATTERN.test(phone)) throw new Error('Phone number must use E.164 format.');
  const homeRegion = input.homeRegion == null ? 'region-unassigned' : requiredText(input.homeRegion, 'home region', 64);

  const result = await client.query<{ id: string }>(`
    INSERT INTO accounts (
      id, username, username_normalized, email, email_normalized,
      phone, phone_normalized, display_name, password_hash, password_salt, home_region
    )
    VALUES ($1, $2, lower($2), $3, $3, $4, $4, $5, $6, $7, $8)
    RETURNING id
  `, [input.id, username, email, phone, displayName, passwordHash, passwordSalt, homeRegion]);

  const id = result.rows[0]?.id;
  if (!id) throw new Error('Account insert returned no identifier.');

  await insertOutboxEvent(client, {
    aggregateType: 'account',
    aggregateId: id,
    eventType: 'created',
    partitionKey: id,
    payload: { accountId: id, username },
  });
  return { id };
}

/** Finds credentials for login without returning them to public profile handlers. */
export async function findAccountForLogin(
  client: PoolClient,
  identifier: string,
): Promise<LoginAccount | null> {
  const value = requiredText(identifier, 'login identifier', 254);
  const normalized = value.toLowerCase();
  const result = await client.query<LoginAccount>(`
    SELECT id, username, email, phone, display_name, password_hash, password_salt, account_status
    FROM accounts
    WHERE username_normalized = $1
       OR email_normalized = $1
       OR phone_normalized = $2
    LIMIT 1
  `, [normalized, value]);
  return result.rows[0] ?? null;
}

/** Returns only fields safe for a public profile response. */
export async function findPublicAccount(
  client: PoolClient,
  accountId: string,
): Promise<{ id: string; username: string; display_name: string | null; created_at: Date } | null> {
  if (!ID_PATTERN.test(accountId)) throw new Error('Invalid account ID.');
  const result = await client.query<{
    id: string; username: string; display_name: string | null; created_at: Date;
  }>(`
    SELECT id, username, display_name, created_at
    FROM accounts
    WHERE id = $1 AND account_status = 'active'
    LIMIT 1
  `, [accountId]);
  return result.rows[0] ?? null;
}
