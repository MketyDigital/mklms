import test from 'node:test';
import assert from 'node:assert/strict';
import { assertHyperdriveOriginMatches } from '../scripts/assert-hyperdrive-origin.mjs';

const target = { host: 'db.internal.example', port: '5432', database: 'mkety_lms', user: 'mklms_app' };

test('Hyperdrive origin must match the approved installation database coordinates', () => {
  assert.equal(assertHyperdriveOriginMatches({ ...target, port: 5432 }, target), true);
});

test('Hyperdrive origin mismatch fails without including endpoints in the error', () => {
  assert.throws(
    () => assertHyperdriveOriginMatches({ ...target, host: 'old.internal.example' }, target),
    (error) => error.message === 'Hyperdrive origin does not match the approved installation database target.',
  );
});

test('missing Hyperdrive coordinates fail closed', () => {
  assert.throws(() => assertHyperdriveOriginMatches({ host: target.host }, target), /does not match/);
});

test('database and role comparisons remain case sensitive', () => {
  assert.throws(() => assertHyperdriveOriginMatches({ ...target, user: 'MKLMS_APP' }, target), /does not match/);
});
