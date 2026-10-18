import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { buildD1SchemaCatalog, buildD1SchemaCatalogFromSql, exportD1SchemaOnly, fetchCloudflareD1SchemaCatalog } from '../scripts/cloudflare-d1-schema-catalog.mjs';

const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, async json() { return body; } });

test('builds a full D1 catalog from schema-only sqlite metadata', () => {
  const objects = [
    { type: 'table', name: 'students', tbl_name: 'students', sql: "CREATE TABLE students (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, CHECK (length(email) > 0))" },
    { type: 'table', name: 'mklms_d1_atomic_assertions', tbl_name: 'mklms_d1_atomic_assertions', sql: 'CREATE TABLE mklms_d1_atomic_assertions (id INTEGER)' },
    { type: 'table', name: 'sqlite_sequence', tbl_name: 'sqlite_sequence', sql: 'CREATE TABLE sqlite_sequence(name,seq)' },
    { type: 'index', name: 'students_email_uq', tbl_name: 'students', sql: 'CREATE UNIQUE INDEX students_email_uq ON students(lower(email)) WHERE email IS NOT NULL' },
    { type: 'trigger', name: 'students_insert_guard', tbl_name: 'students', sql: 'CREATE TRIGGER students_insert_guard AFTER INSERT ON students BEGIN SELECT 1; END' },
  ];
  const metadata = {
    students: {
      columns: [
        { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
        { cid: 1, name: 'email', type: 'TEXT', notnull: 1, dflt_value: "''", pk: 0 },
      ],
      foreignKeys: [],
      indexes: [
        { seq: 0, name: 'students_email_uq', unique: 1, origin: 'c', partial: 1, columns: [{ seqno: 0, cid: -2, name: null }] },
        { seq: 1, name: 'sqlite_autoindex_students_1', unique: 1, origin: 'pk', partial: 0, columns: [{ seqno: 0, cid: 0, name: 'id' }] },
      ],
    },
  };

  assert.deepEqual(buildD1SchemaCatalog(objects, metadata), {
    tables: [{ name: 'students' }],
    columns: [
      { table: 'students', name: 'id', type: 'TEXT', nullable: false, default: null, primaryKeyPosition: 1 },
      { table: 'students', name: 'email', type: 'TEXT', nullable: false, default: "''", primaryKeyPosition: 0 },
    ],
    indexes: [{ table: 'students', name: 'students_email_uq', unique: true, partial: true, columns: ['lower(email)'], predicate: 'email IS NOT NULL' }],
    foreignKeys: [],
    checks: [{ table: 'students', name: 'check_0', expression: 'length(email) > 0' }],
    triggers: [{ table: 'students', name: 'students_insert_guard', definition: 'CREATE TRIGGER students_insert_guard AFTER INSERT ON students BEGIN SELECT 1; END' }],
    unsupported: [],
  });
});

test('fails closed when an expression index cannot be reconstructed', () => {
  const catalog = buildD1SchemaCatalog([
    { type: 'table', name: 'items', tbl_name: 'items', sql: 'CREATE TABLE items (id TEXT)' },
    { type: 'index', name: 'items_expression', tbl_name: 'items', sql: null },
  ], {
    items: {
      columns: [{ cid: 0, name: 'id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }],
      foreignKeys: [],
      indexes: [{ seq: 0, name: 'items_expression', unique: 0, origin: 'c', partial: 0, columns: [{ seqno: 0, cid: -2, name: null }] }],
    },
  });
  assert.deepEqual(catalog.unsupported, ['sqlite expression index items.items_expression']);
});

test('uses Wrangler schema-only remote export and removes its temporary file', async () => {
  let exportedPath;
  let argsSeen;
  const sql = await exportD1SchemaOnly('mklms-starpips', {
    run: async (program, args) => {
      assert.equal(program, 'npx');
      argsSeen = args;
      exportedPath = args[args.indexOf('--output') + 1];
      await writeFile(exportedPath, 'CREATE TABLE students (id TEXT PRIMARY KEY);');
    },
  });
  assert.ok(argsSeen.includes('--remote'));
  assert.ok(argsSeen.includes('--no-data'));
  assert.ok(argsSeen.includes('--skip-confirmation'));
  assert.match(sql, /^CREATE TABLE/);
  await assert.rejects(import('node:fs/promises').then(fs => fs.access(exportedPath)));
});

test('reconstructs live columns, foreign keys, indexes and checks from schema DDL only', () => {
  const catalog = buildD1SchemaCatalogFromSql(`
    CREATE TABLE parents (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE children (
      id TEXT PRIMARY KEY NOT NULL,
      parent_id TEXT NOT NULL,
      CHECK (length(parent_id) > 0),
      FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX children_parent_uq ON children(parent_id);
  `);
  assert.equal(catalog.columns.length, 3);
  assert.deepEqual(catalog.foreignKeys.map(({ table, columns, refTable, refColumns, onDelete }) => ({ table, columns, refTable, refColumns, onDelete })), [
    { table: 'children', columns: ['parent_id'], refTable: 'parents', refColumns: ['id'], onDelete: 'CASCADE' },
  ]);
  assert.deepEqual(catalog.indexes.map(({ table, name, unique, columns }) => ({ table, name, unique, columns })), [
    { table: 'children', name: 'children_parent_uq', unique: true, columns: ['parent_id'] },
  ]);
  assert.deepEqual(catalog.checks.map(({ table, expression }) => ({ table, expression })), [
    { table: 'children', expression: 'length(parent_id) > 0' },
  ]);
});

test('fetches a schema-only export for the exact installation D1 database', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(String(url));
    calls.push({ url: parsed, options });
    if (options.method !== 'POST') return response({ success: true, result: [{ uuid: 'starpips-db', name: 'mklms-starpips' }], result_info: { total_count: 1 } });
    const sql = JSON.parse(options.body).sql;
    assert.match(sql, /sqlite_master/);
    return response({ success: true, result: [{ success: true, results: [
      { type: 'table', name: 'students', tbl_name: 'students', sql: 'CREATE TABLE students (id TEXT PRIMARY KEY NOT NULL)' },
      { type: 'trigger', name: 'students_insert_audit', tbl_name: 'students', sql: 'CREATE TRIGGER students_insert_audit AFTER INSERT ON students BEGIN SELECT 1; END' },
    ] }] });
  };
  const exportedDatabases = [];

  const catalog = await fetchCloudflareD1SchemaCatalog({
    accountId: 'account', apiToken: 'token', installationId: 'starpips', fetchImpl,
    exportSchema: async databaseName => {
      exportedDatabases.push(databaseName);
      return 'CREATE TABLE students (id TEXT PRIMARY KEY NOT NULL); CREATE TRIGGER students_insert_audit AFTER INSERT ON students BEGIN SELECT 1; END;';
    },
  });
  assert.equal(catalog.databaseId, 'starpips-db');
  assert.deepEqual(exportedDatabases, ['mklms-starpips']);
  assert.deepEqual(catalog.tables, [{ name: 'students' }]);
  assert.equal(catalog.columns.length, 1);
  assert.deepEqual(catalog.triggers.map(({ name, table }) => ({ name, table })), [{ name: 'students_insert_audit', table: 'students' }]);
  assert.ok(calls.every(({ options }) => options.method === 'GET' || JSON.parse(options.body).sql.includes('sqlite_master')));
  assert.ok(calls.every(({ url }) => !url.pathname.endsWith('/unrelated-db/query')));
  assert.doesNotMatch(JSON.stringify(catalog), /token|secret|password/i);
});

test('fails closed when multiple live D1 databases match one installation', async () => {
  const fetchImpl = async (url, options = {}) => {
    if (options.method === 'POST') return response({ success: true, result: [{ success: true, results: [] }] });
    return response({ success: true, result: [
      { uuid: 'target-one', name: 'starpips' },
      { uuid: 'target-two', name: 'mklms-starpips' },
    ], result_info: { total_count: 2 } });
  };
  await assert.rejects(
    fetchCloudflareD1SchemaCatalog({ accountId: 'account', apiToken: 'token', installationId: 'starpips', fetchImpl }),
    /Expected exactly one D1 database/,
  );
});
