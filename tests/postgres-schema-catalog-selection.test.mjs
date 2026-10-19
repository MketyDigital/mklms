import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPostgresCatalogToMklms, selectPostgresCatalogSchema } from '../scripts/postgres-schema-catalog-selection.mjs';

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
    { name: 'public', hasMigrationLedger: false, applicationTableCount: 22, mklmsTableMatchCount: 0 },
    { name: 'application', hasMigrationLedger: false, applicationTableCount: 37, mklmsTableMatchCount: 38 },
    { name: 'billing', hasMigrationLedger: false, applicationTableCount: 5, mklmsTableMatchCount: 0 },
  ]), 'application');
});

test('selects a unique partial core signature so missing source tables remain auditable', () => {
  assert.equal(selectPostgresCatalogSchema([
    { name: 'auth', hasMigrationLedger: false, applicationTableCount: 8, mklmsTableMatchCount: 0 },
    { name: 'application', hasMigrationLedger: false, applicationTableCount: 35, mklmsTableMatchCount: 22 },
    { name: 'billing', hasMigrationLedger: false, applicationTableCount: 12, mklmsTableMatchCount: 4 },
  ]), 'application');
});

test('fails closed when the strongest core signature is tied or too weak', () => {
  assert.throws(() => selectPostgresCatalogSchema([
    { name: 'one', hasMigrationLedger: false, applicationTableCount: 12, mklmsTableMatchCount: 12 },
    { name: 'two', hasMigrationLedger: false, applicationTableCount: 13, mklmsTableMatchCount: 12 },
  ]), /Multiple PostgreSQL schemas share the strongest MkLMS table signature/);
  assert.throws(() => selectPostgresCatalogSchema([
    { name: 'one', hasMigrationLedger: false, applicationTableCount: 12, mklmsTableMatchCount: 2 },
    { name: 'two', hasMigrationLedger: false, applicationTableCount: 13, mklmsTableMatchCount: 1 },
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

test('explicit schema selection disambiguates multiple live MkLMS schemas', () => {
  const schemas = [
    { name: 'public', hasMigrationLedger: true, applicationTableCount: 37 },
    { name: 'mkety_academy', hasMigrationLedger: true, applicationTableCount: 37 },
  ];
  assert.equal(selectPostgresCatalogSchema(schemas, 'public'), 'public');
  assert.equal(selectPostgresCatalogSchema(schemas, 'mkety_academy'), 'mkety_academy');
  assert.throws(() => selectPostgresCatalogSchema(schemas, 'missing'), /does not contain application tables/);
  assert.throws(() => selectPostgresCatalogSchema(schemas, 'Bad-Schema'), /schema name is invalid/);
});

test('filters shared-schema catalogs to the MkLMS table signature', () => {
  const filtered = filterPostgresCatalogToMklms({
    tables: [{ name: 'students' }, { name: 'chat_messages_bot2' }],
    columns: [{ table: 'students', name: 'id' }, { table: 'chat_messages_bot2', name: 'id' }],
    indexes: [{ table: 'students', columns: ['id'] }, { table: 'assistant_settings', columns: ['id'] }],
    foreignKeys: [{ table: 'students', refTable: 'courses' }, { table: 'other_product', refTable: 'users' }],
    checks: [{ table: 'students', expression: 'id > 0' }, { table: 'other_product', expression: 'id > 0' }],
    triggers: [{ table: 'students', name: 'enroll' }, { table: 'other_product', name: 'other' }],
    unsupported: ['postgres function app_trigger'],
  });
  assert.deepEqual(filtered.tables, [{ name: 'students' }]);
  assert.deepEqual(filtered.columns.map(item => item.table), ['students']);
  assert.deepEqual(filtered.indexes.map(item => item.table), ['students']);
  assert.deepEqual(filtered.foreignKeys.map(item => item.table), ['students']);
  assert.deepEqual(filtered.checks.map(item => item.table), ['students']);
  assert.deepEqual(filtered.triggers.map(item => item.table), ['students']);
  assert.deepEqual(filtered.unsupported, ['postgres function app_trigger']);
});
