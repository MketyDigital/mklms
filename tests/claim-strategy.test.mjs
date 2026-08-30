import test from 'node:test';
import assert from 'node:assert/strict';

import { decideClaimVerification } from '../src/features/access/domain/claim-strategy.ts';

test('claim-code verifies only with a valid code', () => {
  assert.equal(
    decideClaimVerification({ strategy: 'claim-code', claimCodeValid: true }).status,
    'VERIFIED',
  );
  assert.equal(
    decideClaimVerification({ strategy: 'claim-code', claimCodeValid: false }).status,
    'REJECTED',
  );
});

test('manual approval is pending until admin approval then verified', () => {
  assert.equal(
    decideClaimVerification({ strategy: 'manual-approval', manualApproved: false }).status,
    'PENDING',
  );
  assert.equal(
    decideClaimVerification({ strategy: 'manual-approval', manualApproved: true }).status,
    'VERIFIED',
  );
});

test('preauth-only verifies without an external delivery provider', () => {
  assert.equal(
    decideClaimVerification({ strategy: 'preauth-only' }).status,
    'VERIFIED',
  );
});
