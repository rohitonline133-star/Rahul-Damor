import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSupportedOtpPurpose,
  isValidOtpCode,
  canAddGroupMembers,
  isCommunityGroupLinkValid,
  isValidShippingAddress,
} from '../src/lib/server-validation';

test('OTP purpose accepts only supported registration and authentication flows', () => {
  assert.equal(isSupportedOtpPurpose('register'), true);
  assert.equal(isSupportedOtpPurpose('login'), true);
  assert.equal(isSupportedOtpPurpose('authenticate'), true);
  assert.equal(isSupportedOtpPurpose('password-reset'), false);
  assert.equal(isSupportedOtpPurpose(undefined), false);
});

test('OTP code requires exactly six numeric digits', () => {
  assert.equal(isValidOtpCode('123456'), true);
  assert.equal(isValidOtpCode(' 123456 '), true);
  assert.equal(isValidOtpCode('12345'), false);
  assert.equal(isValidOtpCode('1234567'), false);
  assert.equal(isValidOtpCode('12a456'), false);
  assert.equal(isValidOtpCode(123456), false);
});

test('group member addition requires admin or explicit add-members permission', () => {
  assert.equal(canAddGroupMembers(true, false), true);
  assert.equal(canAddGroupMembers(false, true), true);
  assert.equal(canAddGroupMembers(false, false), false);
  assert.equal(canAddGroupMembers(false, 'true'), false);
});

test('community group linkage must match both community ID and registered group ID', () => {
  assert.equal(isCommunityGroupLinkValid('community-1', 'community-1', ['group-1'], 'group-1'), true);
  assert.equal(isCommunityGroupLinkValid('community-1', 'community-2', ['group-1'], 'group-1'), false);
  assert.equal(isCommunityGroupLinkValid('community-1', 'community-1', [], 'group-1'), false);
  assert.equal(isCommunityGroupLinkValid('community-1', 'community-1', null, 'group-1'), false);
});

test('shipping address requires bounded non-empty string fields', () => {
  const valid = { fullName: 'A User', address: '1 Main Road', city: 'Vadodara', postalCode: '390001', country: 'India' };
  assert.equal(isValidShippingAddress(valid), true);
  assert.equal(isValidShippingAddress({ ...valid, city: ' ' }), false);
  assert.equal(isValidShippingAddress({ ...valid, postalCode: 'x'.repeat(201) }), false);
  assert.equal(isValidShippingAddress(null), false);
  assert.equal(isValidShippingAddress([]), false);
});
