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

test('selects one schema matching the full MkLMS core-table signature', () => {
  assert.equal(selectPostgresCatalogSchema([
    { name: 'public', hasMigrationLedger: false, applicationTableCount: 22, mklmsSignatureTableCount: 0 },
    { name: 'application', hasMigrationLedger: false, applicationTableCount: 37, mklmsSignatureTableCount: 5 },
    { name: 'billing', hasMigrationLedger: false, applicationTableCount: 5, mklmsSignatureTableCount: 0 },
  ]), 'application');
});

test('selects a unique partial core signature so missing source tables remain auditable', () => {
  assert.equal(selectPostgresCatalogSchema([
    { name: 'auth', hasMigrationLedger: false, applicationTableCount: 8, mklmsSignatureTableCount: 0 },
    { name: 'application', hasMigrationLedger: false, applicationTableCount: 35, mklmsSignatureTableCount: 4 },
    { name: 'billing', hasMigrationLedger: false, applicationTableCount: 12, mklmsSignatureTableCount: 1 },
  ]), 'application');
});

test('fails closed when the strongest core signature is tied or too weak', () => {
  assert.throws(() => selectPostgresCatalogSchema([
    { name: 'one', hasMigrationLedger: false, applicationTableCount: 12, mklmsSignatureTableCount: 4 },
    { name: 'two', hasMigrationLedger: false, applicationTableCount: 13, mklmsSignatureTableCount: 4 },
  ]), /Multiple PostgreSQL schemas share the strongest MkLMS core-table signature/);
  assert.throws(() => selectPostgresCatalogSchema([
    { name: 'one', hasMigrationLedger: false, applicationTableCount: 12, mklmsSignatureTableCount: 2 },
    { name: 'two', hasMigrationLedger: false, applicationTableCount: 13, mklmsSignatureTableCount: 1 },
  ]), /no unique MkLMS migration ledger was found/);
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
