import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDatabaseBackend } from '../src/lib/database-backend-policy.ts';

const readyForD1 = {
  backend: 'd1',
  d1BindingPresent: true,
  schemaReady: true,
  reconciliationPassed: true,
  authorityLeaseVerified: true,
  replicationHealthy: true,
  rollbackPlanVerified: true,
  cutoverApproved: true,
};

test('PostgreSQL remains the default and accepts explicit PostgreSQL selection', () => {
  assert.equal(resolveDatabaseBackend({}), 'postgresql');
  assert.equal(resolveDatabaseBackend({ backend: 'postgresql' }), 'postgresql');
});

test('caller-supplied readiness booleans cannot authorize D1 without a verifier', () => {
  assert.throws(
    () => resolveDatabaseBackend(readyForD1),
    /D1 is unavailable: production authority verification is not implemented/,
  );
});

test('unsupported backend selections fail closed', () => {
  assert.throws(
    () => resolveDatabaseBackend({ ...readyForD1, backend: 'postgres' }),
    /Unsupported MkLMS database backend/,
  );
});
