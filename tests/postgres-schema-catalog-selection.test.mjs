import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPostgresCatalogSchema } from '../scripts/postgres-schema-catalog-selection.mjs';

test('prefers the unique MkLMS migration ledger schema', () => {
  assert.equal(selectPostgresCatalogSchema([
    { name: 'public', hasMigrationLedger: false, applicationTableCount: 20 },
    { name: 'mklms', hasMigrationLedger: true, applicationTableCount: 37 },
  ]), 'mklms');
});

test('selects the only non-system schema with tables when no ledger exists', () => {
  assert.equal(selectPostgresCatalogSchema([
    { name: 'public', hasMigrationLedger: false, applicationTableCount: 37 },
    { name: 'extensions', hasMigrationLedger: false, applicationTableCount: 0 },
  ]), 'public');
});

test('fails closed for missing or ambiguous application schemas', () => {
  assert.throws(() => selectPostgresCatalogSchema([]), /Could not select one PostgreSQL application schema safely/);
  assert.throws(() => selectPostgresCatalogSchema([
    { name: 'one', hasMigrationLedger: false, applicationTableCount: 12 },
    { name: 'two', hasMigrationLedger: false, applicationTableCount: 13 },
  ]), /no unique MkLMS migration ledger was found/);
  assert.throws(() => selectPostgresCatalogSchema([
    { name: 'one', hasMigrationLedger: true, applicationTableCount: 12 },
    { name: 'two', hasMigrationLedger: true, applicationTableCount: 13 },
  ]), /Multiple MkLMS migration-ledger schemas contain application tables/);
});
