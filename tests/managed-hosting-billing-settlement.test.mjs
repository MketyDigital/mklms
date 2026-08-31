import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalBillingSettlementPayload,
  signBillingPayload,
  verifyBillingPayload,
} from '../src/features/hosting/server/billing-signature.ts';

const secret = 'customer-shared-secret-1234567890';

const settlement = {
  installationId: 'spf-mklms',
  monthKey: '2026-09',
  paymentId: '12345',
  paymentStatus: 'finished',
  priceAmount: 25,
  priceCurrency: 'usd',
  actuallyPaid: 25,
  payCurrency: 'usdttrc20',
  timestamp: 1788177600,
};

test('settlement signature is deterministic and tampering fails', () => {
  const canonical = canonicalBillingSettlementPayload(settlement);
  const signature = signBillingPayload(secret, canonical);
  assert.equal(verifyBillingPayload(secret, canonical, signature), true);
  assert.equal(verifyBillingPayload(secret, canonicalBillingSettlementPayload({ ...settlement, monthKey: '2026-10' }), signature), false);
});

test('settlement canonical JSON sorts keys recursively', () => {
  assert.equal(
    canonicalBillingSettlementPayload({ z: 1, a: { y: 2, b: 3 } }),
    '{"a":{"b":3,"y":2},"z":1}',
  );
});
