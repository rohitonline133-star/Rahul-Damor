import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  getRazorpayConfig,
  isValidRazorpaySignature,
  isValidRazorpayWebhookSignature,
} from '../src/lib/razorpay';

test('Razorpay configuration fails closed when any required secret is missing', () => {
  assert.equal(getRazorpayConfig({ RAZORPAY_KEY_ID: 'key', RAZORPAY_KEY_SECRET: 'secret' } as NodeJS.ProcessEnv), null);
  assert.deepEqual(getRazorpayConfig({
    RAZORPAY_KEY_ID: 'key_test_123',
    RAZORPAY_KEY_SECRET: 'secret',
    RAZORPAY_WEBHOOK_SECRET: 'webhook',
    RAZORPAY_CURRENCY: 'INR',
  } as NodeJS.ProcessEnv), {
    keyId: 'key_test_123',
    keySecret: 'secret',
    webhookSecret: 'webhook',
    currency: 'INR',
  });
});

test('Razorpay checkout signature is bound to the exact order and payment IDs', () => {
  const orderId = 'order_abc123';
  const paymentId = 'pay_xyz789';
  const secret = 'test-secret';
  const signature = crypto.createHmac('sha256', secret).update(orderId + '|' + paymentId).digest('hex');
  assert.equal(isValidRazorpaySignature(orderId, paymentId, signature, secret), true);
  assert.equal(isValidRazorpaySignature('order_other', paymentId, signature, secret), false);
  assert.equal(isValidRazorpaySignature(orderId, paymentId, '0'.repeat(64), secret), false);
  assert.equal(isValidRazorpaySignature(orderId, 'invalid', signature, secret), false);
});

test('Razorpay webhook signature validates the exact raw request body', () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  const secret = 'webhook-secret';
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(isValidRazorpayWebhookSignature(body, signature, secret), true);
  assert.equal(isValidRazorpayWebhookSignature(Buffer.from(body.toString() + ' '), signature, secret), false);
  assert.equal(isValidRazorpayWebhookSignature(body, 'bad', secret), false);
});
