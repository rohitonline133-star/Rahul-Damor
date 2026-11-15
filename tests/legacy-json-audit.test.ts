import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { auditLegacyJson } from '../scripts/audit-legacy-json';

test('audits legacy collection shapes and reports counts without exposing record values', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-legacy-audit-'));
  const source = path.join(dir, 'database.json');
  const raw = JSON.stringify({
    users: [{ id: 'u1', email: 'private@example.invalid' }, { id: 'u2' }, { displayName: 'Missing identifier' }],
    sessions: [{ id: 's1', token: 'never-print-this' }],
    phone_verifications: [{ id: 'otp1', code: '000000' }],
    shop_cart: { u1: [{ productId: 'p1' }] },
    two_factor_auth: { u1: { secret: 'never-print-this-either' } },
  });
  fs.writeFileSync(source, raw);
  try {
    const result = auditLegacyJson(source);
    assert.equal(result.sourceSha256, crypto.createHash('sha256').update(raw).digest('hex'));
    assert.equal(result.collections.users.records, 3);
    assert.equal(result.collections.users.recordsWithoutStringId, 1);
    assert.ok(result.warnings.some((entry) => entry.includes('"users" contains 1 record(s) without a non-empty string ID')));
    assert.equal(result.collections.sessions.importPolicy, 'never-import');
    assert.equal(result.collections.phone_verifications.importPolicy, 'never-import');
    assert.equal(result.collections.shop_cart.records, 1);
    assert.equal(JSON.stringify(result).includes('private@example.invalid'), false);
    assert.equal(JSON.stringify(result).includes('never-print-this'), false);
    assert.deepEqual(result.errors, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects malformed collection shape and duplicate IDs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-legacy-audit-'));
  const source = path.join(dir, 'database.json');
  fs.writeFileSync(source, JSON.stringify({ users: [{ id: 'same' }, { id: 'same' }], messages: {} }));
  try {
    const result = auditLegacyJson(source);
    assert.ok(result.errors.some((entry) => entry.includes('duplicate record ID')));
    assert.ok(result.errors.some((entry) => entry.includes('"messages" must be an array')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('audits the checked-in synthetic fixture across all 32 legacy collections', () => {
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/legacy-database.synthetic.json');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-legacy-fixture-audit-'));
  const source = path.join(dir, 'database.json');
  fs.copyFileSync(fixturePath, source);
  try {
    const fixture = JSON.parse(fs.readFileSync(source, 'utf8')) as Record<string, unknown>;
    const result = auditLegacyJson(source);
    assert.equal(Object.keys(result.collections).length, 32);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.unknownKeys, ['_fixture']);
    assert.deepEqual((fixture.sessions as unknown[]), []);
    assert.deepEqual((fixture.phone_verifications as unknown[]), []);
    assert.deepEqual((fixture.password_resets as unknown[]), []);
    assert.deepEqual(fixture.two_factor_auth, {});
    assert.equal(result.collections.sessions.importPolicy, 'never-import');
    assert.equal(result.collections.phone_verifications.importPolicy, 'never-import');
    assert.equal(result.collections.password_resets.importPolicy, 'never-import');
    assert.equal(JSON.stringify(result).includes('synthetic-user-001'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
