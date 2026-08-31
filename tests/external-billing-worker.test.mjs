import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalCheckoutPayload,
  signHmacHex,
  sortObjectDeep,
  verifyHmacHex,
} from '../workers/billing/src/auth.ts';
import { createOrderId, parseOrderId } from '../workers/billing/src/order.ts';
import billingWorker from '../workers/billing/src/index.ts';

const customers = {
  'spf-mklms': {
    settlementUrl: 'https://customer.example/api/managed-hosting/settlement',
    sharedSecret: 'customer-shared-secret-1234567890',
    successUrl: 'https://customer.example/admin/hosting?payment=success',
    cancelUrl: 'https://customer.example/admin/hosting?payment=cancelled',
  },
};

const env = {
  NOWPAYMENTS_API_KEY: 'legacy-api-key',
  NOWPAYMENTS_IPN_SECRET: 'legacy-ipn-secret',
  MKETY_BILLING_CUSTOMERS_JSON: JSON.stringify(customers),
};

test('checkout signature is deterministic and tampering fails', async () => {
  const payload = canonicalCheckoutPayload({
    installationId: 'spf-mklms',
    monthKey: '2026-09',
    amountUsd: 25,
    timestamp: 1788177600,
    nonce: 'abc12345',
  });
  const signature = await signHmacHex('sha256', customers['spf-mklms'].sharedSecret, payload);
  assert.equal(await verifyHmacHex('sha256', customers['spf-mklms'].sharedSecret, payload, signature), true);
  assert.equal(await verifyHmacHex('sha256', customers['spf-mklms'].sharedSecret, payload.replace('25.00', '50.00'), signature), false);
});

test('NOWPayments payload sorting is deep and stable for IPN verification', async () => {
  const payload = { z: 1, a: { y: 2, b: 3 }, m: 'x' };
  assert.deepEqual(sortObjectDeep(payload), { a: { b: 3, y: 2 }, m: 'x', z: 1 });
  const canonical = JSON.stringify(sortObjectDeep(payload));
  const sig = await signHmacHex('sha512', env.NOWPAYMENTS_IPN_SECRET, canonical);
  assert.equal(await verifyHmacHex('sha512', env.NOWPAYMENTS_IPN_SECRET, canonical, sig), true);
});

test('billing order ids are validated and reversible', () => {
  const id = createOrderId('spf-mklms', '2026-09', 'abc12345');
  assert.deepEqual(parseOrderId(id), { installationId: 'spf-mklms', monthKey: '2026-09', nonce: 'abc12345' });
  assert.equal(parseOrderId('bad|order'), null);
});

test('signed invoice request calls NOWPayments with legacy API key and returns invoice URL', async () => {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    installationId: 'spf-mklms',
    monthKey: '2026-09',
    amountUsd: 25,
    timestamp: now,
    nonce: 'abc12345',
  };
  const signature = await signHmacHex('sha256', customers['spf-mklms'].sharedSecret, canonicalCheckoutPayload(body));
  const calls = [];
  const request = new Request('https://billing.example/v1/invoices', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, signature }),
  });
  const response = await billingWorker.fetch(request, env, { fetch: async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify({ invoice_url: 'https://nowpayments.io/payment/?iid=123' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).invoiceUrl, 'https://nowpayments.io/payment/?iid=123');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://api.nowpayments.io/v1/invoice');
  assert.equal(calls[0][1].headers['x-api-key'], 'legacy-api-key');
});

test('IPN fails closed without signature and only finished triggers settlement', async () => {
  const orderId = createOrderId('spf-mklms', '2026-09', 'abc12345');
  const payload = {
    order_id: orderId,
    payment_id: 12345,
    payment_status: 'finished',
    price_amount: 25,
    price_currency: 'usd',
    actually_paid: 25,
    pay_currency: 'usdttrc20',
  };
  const missing = await billingWorker.fetch(new Request('https://billing.example/webhooks/nowpayments', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  }), env, { fetch });
  assert.equal(missing.status, 401);

  const signature = await signHmacHex('sha512', env.NOWPAYMENTS_IPN_SECRET, JSON.stringify(sortObjectDeep(payload)));
  const calls = [];
  const finished = await billingWorker.fetch(new Request('https://billing.example/webhooks/nowpayments', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nowpayments-sig': signature },
    body: JSON.stringify(payload),
  }), env, { fetch: async (...args) => { calls.push(args); return new Response(JSON.stringify({ ok: true }), { status: 200 }); } });
  assert.equal(finished.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], customers['spf-mklms'].settlementUrl);

  const confirmedPayload = { ...payload, payment_status: 'confirmed' };
  const confirmedSig = await signHmacHex('sha512', env.NOWPAYMENTS_IPN_SECRET, JSON.stringify(sortObjectDeep(confirmedPayload)));
  const confirmedCalls = [];
  const confirmed = await billingWorker.fetch(new Request('https://billing.example/webhooks/nowpayments', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nowpayments-sig': confirmedSig },
    body: JSON.stringify(confirmedPayload),
  }), env, { fetch: async (...args) => { confirmedCalls.push(args); return new Response('{}'); } });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmedCalls.length, 0);
});
