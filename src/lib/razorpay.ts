import crypto from 'node:crypto';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  currency: string;
}

export function getRazorpayConfig(env: NodeJS.ProcessEnv = process.env): RazorpayConfig | null {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const currency = (env.RAZORPAY_CURRENCY || 'INR').trim().toUpperCase();
  if (!keyId || !keySecret || !webhookSecret) return null;
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  return { keyId, keySecret, webhookSecret, currency };
}

export function isValidRazorpaySignature(orderId: unknown, paymentId: unknown, signature: unknown, keySecret: string): boolean {
  if (typeof orderId !== 'string' || !/^order_[A-Za-z0-9]+$/.test(orderId)) return false;
  if (typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) return false;
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', keySecret).update(orderId + '|' + paymentId).digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && crypto.timingSafeEqual(expected, supplied);
}

export function isValidRazorpayWebhookSignature(rawBody: Buffer | string, signature: unknown, webhookSecret: string): boolean {
  if (!(Buffer.isBuffer(rawBody) || typeof rawBody === 'string')) return false;
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && crypto.timingSafeEqual(expected, supplied);
}

export async function createRazorpayOrder(
  amountMinor: number,
  currency: string,
  receipt: string,
  config: Pick<RazorpayConfig, 'keyId' | 'keySecret'>,
): Promise<{ id: string; amount: number; currency: string }> {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 100) {
    throw new Error('Payment amount must be at least 100 minor currency units.');
  }
  if (!/^[A-Z]{3}$/.test(currency) || !/^[A-Za-z0-9_-]{1,40}$/.test(receipt)) {
    throw new Error('Invalid Razorpay order currency or receipt.');
  }
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(config.keyId + ':' + config.keySecret).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: amountMinor, currency, receipt, payment_capture: 1 }),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || !payload || typeof payload.id !== 'string' ||
      payload.amount !== amountMinor || payload.currency !== currency) {
    throw new Error('Razorpay could not create a verified payment order.');
  }
  return { id: payload.id, amount: payload.amount, currency: payload.currency };
}

export async function fetchCapturedRazorpayPayment(
  paymentId: string,
  config: Pick<RazorpayConfig, 'keyId' | 'keySecret'>,
): Promise<{ id: string; order_id: string; amount: number; currency: string; status: string }> {
  if (typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    throw new Error('Invalid Razorpay payment identifier.');
  }
  const response = await fetch('https://api.razorpay.com/v1/payments/' + encodeURIComponent(paymentId), {
    headers: {
      Authorization: 'Basic ' + Buffer.from(config.keyId + ':' + config.keySecret).toString('base64'),
    },
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || !payload || payload.id !== paymentId) {
    throw new Error('Could not verify the payment with Razorpay.');
  }
  return {
    id: payload.id,
    order_id: payload.order_id,
    amount: payload.amount,
    currency: payload.currency,
    status: payload.status,
  };
}
