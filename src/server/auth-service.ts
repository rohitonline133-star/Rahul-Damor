import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { createAccount, findAccountForLogin, upgradeAccountPasswordHash, type NewAccount } from './repositories/accounts';
import { createPersistentSession, type IssuedSession, type SessionMetadata } from './repositories/sessions';
import { upsertUserPrivacySettings, upsertUserProfile, type PrivacyRecord, type ProfileRecord } from './repositories/profiles';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const HASH_BYTES = 64;
const PBKDF2_ITERATIONS = 310_000;
const LEGACY_PBKDF2_ITERATIONS = 1_000;

export type RegistrationInput = {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  displayName: string;
  password: string;
  homeRegion?: string;
  sessionMetadata: SessionMetadata;
  profile?: Omit<ProfileRecord, 'userId'>;
  privacy?: Omit<PrivacyRecord, 'userId'>;
};

export type AuthenticatedAccount = {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  session: IssuedSession;
};

function derivePassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, HASH_BYTES, 'sha512').toString('hex');
}

function validatePassword(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new Error('Password must be between 8 and 128 characters.');
  }
}

/** Creates account and persistent session in the same caller-owned transaction. */
export async function registerAccountWithSession(
  client: PoolClient,
  input: RegistrationInput,
): Promise<AuthenticatedAccount> {
  validatePassword(input.password);
  const salt = randomBytes(16).toString('hex');
  const account: NewAccount = {
    id: input.id,
    username: input.username,
    email: input.email,
    phone: input.phone,
    displayName: input.displayName,
    passwordHash: derivePassword(input.password, salt),
    passwordSalt: salt,
    homeRegion: input.homeRegion,
  };
  const created = await createAccount(client, account);
  await upsertUserProfile(client, { ...input.profile, userId: created.id });
  await upsertUserPrivacySettings(client, { ...input.privacy, userId: created.id });
  const session = await createPersistentSession(client, created.id, input.sessionMetadata);
  return {
    id: created.id,
    username: input.username.trim(),
    email: input.email?.trim().toLowerCase() ?? null,
    phone: input.phone ?? null,
    displayName: input.displayName.trim(),
    session,
  };
}

/** Verifies the existing PBKDF2-SHA512 password format without exposing hashes. */
export async function loginWithPassword(
  client: PoolClient,
  identifier: string,
  password: string,
  sessionMetadata: SessionMetadata,
): Promise<AuthenticatedAccount | null> {
  validatePassword(password);
  const account = await findAccountForLogin(client, identifier);
  if (!account || account.account_status !== 'active') return null;
  const stored = account.password_hash;
  if (!/^[a-f0-9]{128}$/i.test(stored) || !/^[a-f0-9]{32,128}$/i.test(account.password_salt)) {
    return null;
  }
  const expected = Buffer.from(stored, 'hex');
  const actual = Buffer.from(derivePassword(password, account.password_salt), 'hex');
  const currentMatch = expected.length === actual.length && timingSafeEqual(expected, actual);
  const legacy = Buffer.from(pbkdf2Sync(password, account.password_salt, LEGACY_PBKDF2_ITERATIONS, HASH_BYTES, 'sha512').toString('hex'), 'hex');
  const legacyMatch = expected.length === legacy.length && timingSafeEqual(expected, legacy);
  if (!currentMatch && !legacyMatch) return null;
  if (legacyMatch) {
    const replacementSalt = randomBytes(16).toString('hex');
    const replacementHash = derivePassword(password, replacementSalt);
    await upgradeAccountPasswordHash(client, {
      accountId: account.id, previousHash: stored, previousSalt: account.password_salt,
      passwordHash: replacementHash, passwordSalt: replacementSalt,
    });
  }
  const session = await createPersistentSession(client, account.id, sessionMetadata);
  return {
    id: account.id,
    username: account.username,
    email: account.email,
    phone: account.phone,
    displayName: account.display_name,
    session,
  };
}
