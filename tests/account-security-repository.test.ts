import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { hashRecoveryCode, saveEncryptedTotpSecret, enableTwoFactor,
  getEncryptedTotpSecret, consumeTwoFactorBackupCode, verifyAndConsumePasswordRecoveryChallenge } from '../src/server/repositories/account-security';

function fakeClient(responses: unknown[][]) {
  const calls: Array<{sql:string;values?:unknown[]}> = [];
  const client = { query: async (sql:string, values?:unknown[]) => {
    calls.push({sql,values}); return {rows:responses.shift() ?? [],rowCount:1};
  }} as unknown as PoolClient;
  return {client,calls};
}

test('recovery code hashing requires a server-side pepper', () => {
  assert.throws(() => hashRecoveryCode('123456','short'));
  assert.notEqual(hashRecoveryCode('123456','a'.repeat(32)), hashRecoveryCode('123456','b'.repeat(32)));
});

test('encrypted TOTP secret is stored and only returned after enablement', async () => {
  const {client,calls}=fakeClient([[],[{secret_ciphertext:'cipher',secret_nonce:'a'.repeat(24),
    secret_auth_tag:'b'.repeat(32),encryption_key_version:'v1'}]]);
  await saveEncryptedTotpSecret(client,'acct_1',{ciphertext:'cipher',nonce:'a'.repeat(24),authTag:'b'.repeat(32),keyVersion:'v1'});
  assert.match(calls[0].sql,/INSERT INTO account_two_factor/);
  await enableTwoFactor(client,'acct_1');
  assert.match(calls[1].sql,/UPDATE account_two_factor/);
  const value=await getEncryptedTotpSecret(client,'acct_1');
  assert.equal(value?.ciphertext,'cipher');
});

test('backup code consumption is account-scoped and one-time', async () => {
  const {client,calls}=fakeClient([[]]);
  assert.equal(await consumeTwoFactorBackupCode(client,'acct_1','c'.repeat(64)),true);
  assert.match(calls[0].sql,/consumed_at IS NULL/);
  assert.match(calls[0].sql,/account_two_factor/);
});

test('password recovery challenge verification locks the row and consumes it once', async () => {
  const {client,calls}=fakeClient([[{id:'pr_1',code_hash:'d'.repeat(64),attempts:0,max_attempts:5,expires_at:new Date(Date.now()+60000)}],[{id:'pr_1'}]]);
  assert.equal(await verifyAndConsumePasswordRecoveryChallenge(client,'acct_1','d'.repeat(64)),true);
  assert.match(calls[0].sql,/FOR UPDATE/);
  assert.match(calls[1].sql,/consumed_at = now\(\)/);
});
