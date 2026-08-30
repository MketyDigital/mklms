import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hashClaimCode,
  verifyClaimCode,
} from '../src/features/access/domain/claim-code.ts';

test('claim code hash does not store plaintext and verifies normalized code', () => {
  const stored = hashClaimCode('  CLAIM-ABC123  ');

  assert.notEqual(stored, 'CLAIM-ABC123');
  assert.equal(verifyClaimCode('claim-abc123', stored), true);
  assert.equal(verifyClaimCode('wrong', stored), false);
});
