import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildSchemaParityReport, summarizeSchemaParityDiagnostics } from '../scripts/d1-schema-parity.mjs';

const base = {
  tables: [{ name: 'students' }],
  columns: [{ table: 'students', name: 'id', type: 'text', nullable: false, default: null }],
  indexes: [{ table: 'students', name: 'students_email_uq', unique: true, partial: false, columns: ['email'] }],
  foreignKeys: [{ table: 'enrollments', name: 'enrollments_student_fk', columns: ['student_id'], refTable: 'students', refColumns: ['id'], onDelete: 'CASCADE' }],
  checks: [{ table: 'students', name: 'students_status_ck', expression: "status IN ('ACTIVE','INACTIVE')" }],
  triggers: [{ table: 'students', name: 'students_activate_trigger', timing: 'AFTER INSERT', body: '...' }],
};

test('normalized schema catalogs compare all supported object classes independent of JSON key order', () => {
  const reversed = Object.fromEntries(Object.entries(base).reverse().map(([key, rows]) => [key, rows.map(row => Object.fromEntries(Object.entries(row).reverse()))]));
  const report = buildSchemaParityReport(base, reversed);
  assert.equal(report.complete, true);
  assert.deepEqual(report.differences, []);
});

test('catalog parity identifies additions, drops, partial indexes, defaults and object definition drift', () => {
  const pg = structuredClone(base);
  const d1 = structuredClone(base);
  d1.columns[0].default = "'generated'";
  d1.indexes[0].partial = true;
  d1.checks = [];
  d1.triggers[0].body = 'different';
  d1.tables.push({ name: 'new_table' });
  const report = buildSchemaParityReport(pg, d1);
  assert.equal(report.complete, false);
  assert.ok(report.differences.some(item => item.kind === 'columns' && item.difference === 'definition_mismatch'));
  assert.ok(report.differences.some(item => item.kind === 'indexes' && item.difference === 'missing_in_d1'));
  assert.ok(report.differences.some(item => item.kind === 'indexes' && item.difference === 'missing_in_postgres'));
  assert.ok(report.differences.some(item => item.kind === 'checks' && item.difference === 'missing_in_d1'));
  assert.ok(report.differences.some(item => item.kind === 'triggers' && item.difference === 'definition_mismatch'));
  assert.ok(report.differences.some(item => item.kind === 'tables' && item.difference === 'missing_in_postgres'));
  const strict = spawnSync(process.execPath, ['scripts/d1-schema-parity.mjs', 'tests/fixtures/schema-parity-pg.json', 'tests/fixtures/schema-parity-d1-drift.json', '--require-complete'], { encoding: 'utf8' });
  assert.equal(strict.status, 1);
});

test('CLI summary mode emits counts only and enforces complete parity', () => {
  const args = ['scripts/d1-schema-parity.mjs', 'tests/fixtures/schema-parity-pg.json', 'tests/fixtures/schema-parity-d1-drift.json', '--summary-only'];
  const summary = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(summary.status, 0);
  const report = JSON.parse(summary.stdout);
  assert.equal(report.complete, false);
  assert.ok(report.differenceCount > 0);
  assert.equal('differences' in report, false);
  assert.equal('unsupported' in report, false);
  assert.equal(/students|email|"key"|"postgres"|"d1"/i.test(summary.stdout), false);

  const strict = spawnSync(process.execPath, [...args, '--require-complete'], { encoding: 'utf8' });
  assert.equal(strict.status, 1);
  assert.equal(JSON.parse(strict.stdout).complete, false);
});

test('diagnostic parity summary reports categorized schema mismatches without row data', () => {
  const report = buildSchemaParityReport(base, { ...structuredClone(base), checks: [] });
  const summary = summarizeSchemaParityDiagnostics(report, 3);
  assert.equal(summary.differenceCount, 1);
  assert.equal(summary.differenceCounts.checks.missing_in_d1, 1);
  assert.equal(summary.samples.checks[0].difference, 'missing_in_d1');
  assert.match(summary.samples.checks[0].key, /^students\./);
  assert.deepEqual(summary.unsupported, []);
  assert.throws(() => summarizeSchemaParityDiagnostics(report, 101), /between 0 and 100/);
});

test('unsupported database constructs block a complete schema parity report', () => {
  const report = buildSchemaParityReport({ ...base, unsupported: ['postgres enum students_status'] }, base);
  assert.equal(report.complete, false);
  assert.deepEqual(report.unsupported, ['postgres enum students_status']);
});

test('column type normalization covers verified UUID, timestamp, boolean, JSON and money storage mappings', () => {
  const postgres = { tables: [{ name: 'managed_hosting_months' }], columns: [
    { table: 'managed_hosting_months', name: 'id', type: 'uuid', nullable: false, default: null },
    { table: 'managed_hosting_months', name: 'paid_at', type: 'timestamptz', nullable: true, default: null },
    { table: 'managed_hosting_months', name: 'enabled', type: 'bool', nullable: false, default: 'true' },
    { table: 'managed_hosting_months', name: 'layout_config_json', type: 'jsonb', nullable: false, default: "'{}'::jsonb" },
    { table: 'managed_hosting_months', name: 'minimum_floor_usd', type: 'numeric', nullable: false, default: '15' },
    { table: 'media_ingest_jobs', name: 'duration_minutes', type: 'numeric(12,3)', nullable: true, default: null },
    { table: 'media_ingest_jobs', name: 'estimated_cost_usd', type: 'numeric(12,6)', nullable: true, default: null },
  ] };
  const d1 = { tables: structuredClone(postgres.tables), columns: [
    { table: 'managed_hosting_months', name: 'id', type: 'TEXT', nullable: false, default: null },
    { table: 'managed_hosting_months', name: 'paid_at', type: 'TEXT', nullable: true, default: null },
    { table: 'managed_hosting_months', name: 'enabled', type: 'INTEGER', nullable: false, default: '1' },
    { table: 'managed_hosting_months', name: 'layout_config_json', type: 'TEXT', nullable: false, default: "'{}'" },
    { table: 'managed_hosting_months', name: 'minimum_floor_cents', type: 'INTEGER', nullable: false, default: '1500' },
    { table: 'media_ingest_jobs', name: 'duration_minutes', type: 'TEXT', nullable: true, default: null },
    { table: 'media_ingest_jobs', name: 'estimated_cost_usd', type: 'TEXT', nullable: true, default: null },
  ] };
  const report = buildSchemaParityReport(postgres, d1);
  assert.deepEqual(report.differences, []);
});

test('text defaults ignore PostgreSQL casts and catalog-only index expression flags', () => {
  const postgres = {
    tables: [{ name: 'courses' }],
    columns: [{ table: 'courses', name: 'status', type: 'text', nullable: false, default: "'DRAFT'::text" }],
    indexes: [{ table: 'courses', name: 'courses_status_idx', unique: false, partial: false, columns: ['status'], predicate: null, has_expressions: false }],
  };
  const d1 = {
    tables: structuredClone(postgres.tables),
    columns: [{ table: 'courses', name: 'status', type: 'TEXT', nullable: false, default: "'DRAFT'" }],
    indexes: [{ table: 'courses', name: 'courses_status_idx', unique: false, partial: false, columns: ['status'], predicate: null }],
  };
  const report = buildSchemaParityReport(postgres, d1);
  assert.equal(report.complete, true);
  assert.deepEqual(report.differences, []);
});

test('index expression and partial predicate normalization compares SQLite and PostgreSQL forms', () => {
  const pg = { indexes: [{ table: 'preauthorizations', name: 'pg_idx', unique: true, partial: true, columns: ['lower(email)', "COALESCE(course_id, ''::text)"], predicate: "((email IS NOT NULL) AND (status = ANY (ARRAY['PREAUTHORIZED'::text, 'CLAIMED'::text])))" }] };
  const d1 = { indexes: [{ table: 'preauthorizations', name: 'sqlite_autoindex', unique: true, partial: true, columns: ['LOWER(email)', "COALESCE(course_id, '')"], predicate: "email IS NOT NULL AND status IN ('PREAUTHORIZED', 'CLAIMED')" }] };
  const report = buildSchemaParityReport(pg, d1);
  assert.equal(report.complete, true);
  assert.deepEqual(report.differences, []);
});

test('indexes with equal columns but different predicates remain distinct', () => {
  const pg = { indexes: [
    { table: 'students', name: 'active_email', unique: true, partial: true, columns: ['lower(email)'], predicate: "status = 'ACTIVE'" },
    { table: 'students', name: 'pending_email', unique: true, partial: true, columns: ['lower(email)'], predicate: "status = 'PENDING'" },
  ] };
  const d1 = { indexes: [pg.indexes[0], { ...pg.indexes[1], name: 'd1_pending_email' }] };
  const report = buildSchemaParityReport(pg, d1);
  assert.equal(report.complete, true);
  assert.deepEqual(report.differences, []);
});

test('CHECK expressions normalize case, grouping and PostgreSQL casts', () => {
  const pg = { checks: [{ table: 'students', name: 'pg_check', expression: "CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'SUSPENDED'::text])))" }] };
  const d1 = { checks: [{ table: 'students', name: 'sqlite_check', expression: "status IN ('ACTIVE', 'SUSPENDED')" }] };
  const report = buildSchemaParityReport(pg, d1);
  assert.equal(report.complete, true);
  assert.deepEqual(report.differences, []);
});

test('known D1 trigger emulations normalize to PostgreSQL constraints and enrollment trigger', () => {
  const foreignKeys = [
    { table: 'lessons', columns: ['media_asset_id'], refTable: 'media_assets', refColumns: ['id'], onUpdate: 'NO ACTION', onDelete: 'SET NULL' },
    { table: 'live_sessions', columns: ['media_asset_id'], refTable: 'media_assets', refColumns: ['id'], onUpdate: 'NO ACTION', onDelete: 'SET NULL' },
  ];
  const pg = {
    ...base,
    foreignKeys,
    triggers: [{ table: 'students', name: 'mklms_students_all_active_course_enrollment', definition: 'EXECUTE FUNCTION mklms_enroll_active_student_in_all_courses()' }],
  };
  const d1 = {
    ...structuredClone(pg),
    foreignKeys: foreignKeys.map(item => ({ ...item, enforcement: 'verified-triggers' })),
    triggers: [
      { table: 'students', name: 'mklms_students_all_active_enrollment_after_insert', definition: 'after insert' },
      { table: 'students', name: 'mklms_students_all_active_enrollment_after_status_change', definition: 'after status change' },
      { table: 'lessons', name: 'lessons_media_asset_fk_insert', definition: 'guard' },
      { table: 'lessons', name: 'lessons_media_asset_fk_update', definition: 'guard' },
      { table: 'media_assets', name: 'media_assets_lessons_set_null', definition: 'set null' },
      { table: 'live_sessions', name: 'live_sessions_media_asset_fk_insert', definition: 'guard' },
      { table: 'live_sessions', name: 'live_sessions_media_asset_fk_update', definition: 'guard' },
      { table: 'media_assets', name: 'media_assets_live_sessions_set_null', definition: 'set null' },
      { table: 'students', name: 'mklms_pk_guard_students_id_insert', definition: 'pk guard' },
      { table: 'students', name: 'mklms_pk_guard_students_id_update', definition: 'pk guard' },
    ],
  };
  const report = buildSchemaParityReport(pg, d1);
  assert.equal(report.complete, true);
  assert.deepEqual(report.differences, []);
  assert.equal(report.semanticMappings.length, 8);
});

test('the known PostgreSQL enrollment routine is supported only when its trigger is present', () => {
  const pg = {
    ...base,
    triggers: [{ table: 'students', name: 'mklms_students_all_active_course_enrollment', definition: 'EXECUTE FUNCTION mklms_enroll_active_student_in_all_courses()' }],
    unsupported: ['postgres function mklms_enroll_active_student_in_all_courses'],
  };
  const d1 = {
    ...structuredClone(pg),
    unsupported: [],
    triggers: [
      { table: 'students', name: 'mklms_students_all_active_enrollment_after_insert', definition: 'after insert' },
      { table: 'students', name: 'mklms_students_all_active_enrollment_after_status_change', definition: 'after status change' },
    ],
  };
  const report = buildSchemaParityReport(pg, d1);
  assert.equal(report.complete, true);
  assert.deepEqual(report.unsupported, []);

  const noTrigger = buildSchemaParityReport({ ...pg, triggers: [] }, d1);
  assert.equal(noTrigger.complete, false);
  assert.deepEqual(noTrigger.unsupported, ['postgres function mklms_enroll_active_student_in_all_courses']);
});

test('incomplete D1 emulation trigger sets block parity instead of being silently ignored', () => {
  const pg = { ...base, triggers: [{ table: 'students', name: 'mklms_students_all_active_course_enrollment', definition: 'trigger' }] };
  const d1 = { ...structuredClone(pg), triggers: [{ table: 'students', name: 'mklms_students_all_active_enrollment_after_insert', definition: 'trigger' }] };
  const report = buildSchemaParityReport(pg, d1);
  assert.equal(report.complete, false);
  assert.ok(report.unsupported.includes('incomplete D1 all-active enrollment trigger mapping'));
});

test('replication capture triggers normalize by table and event across database engines', () => {
  const pg = structuredClone(base);
  const d1 = structuredClone(base);
  for (const catalog of [pg, d1]) catalog.tables.push({ name: 'mklms_replication_config' });
  pg.triggers = [...pg.triggers, ...['insert','update','delete'].map(event => ({
    table: 'students', name: `mklms_replication_capture_students_${event}`, definition: 'PostgreSQL trigger function',
  }))];
  d1.triggers = [...d1.triggers, ...['insert','update','delete'].map(event => ({
    table: 'students', name: `mklms_replication_capture_students_${event}`, definition: 'SQLite trigger body',
  }))];
  const report = buildSchemaParityReport(pg, d1);
  assert.equal(report.complete, true);
  assert.deepEqual(report.differences, []);
});

test('replication capture readiness fails when any application table event trigger is missing', () => {
  const pg = structuredClone(base);
  const d1 = structuredClone(base);
  for (const catalog of [pg, d1]) catalog.tables.push({ name: 'mklms_replication_config' });
  pg.triggers = [...pg.triggers, ...['insert','update','delete'].map(event => ({ table:'students', name:`mklms_replication_capture_students_${event}`, definition:'capture' }))];
  d1.triggers = [...d1.triggers, { table:'students', name:'mklms_replication_capture_students_insert', definition:'capture' }];
  const report = buildSchemaParityReport(pg, d1);
  assert.equal(report.complete, false);
  assert.ok(report.unsupported.some(item => item.includes('incomplete d1 transactional replication capture')));
});

test('duplicate catalog keys and malformed catalog groups fail closed', () => {
  assert.throws(() => buildSchemaParityReport({ ...base, tables: [{ name: 'students' }, { name: 'students' }] }, base), /Duplicate tables/);
  assert.throws(() => buildSchemaParityReport({ ...base, indexes: {} }, base), /must be an array/);
});

test('SQLite catalog exporter creates a D1 migration snapshot without any external database access', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mklms-d1-catalog-'));
  const output = path.join(directory, 'catalog.json');
  try {
    const result = spawnSync(process.execPath, ['scripts/export-d1-schema-catalog.mjs', output], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const catalog = JSON.parse(await readFile(output, 'utf8'));
    assert.ok(catalog.tables.some(item => item.name === 'students'));
    assert.ok(catalog.columns.some(item => item.table === 'students' && item.name === 'id'));
    assert.ok(catalog.indexes.length > 0);
    assert.ok(catalog.foreignKeys.length > 0);
    assert.ok(catalog.foreignKeys.some(item => item.table === 'lessons' && item.refTable === 'media_assets' && item.enforcement === 'verified-triggers'));
    assert.equal(catalog.tables.some(item => item.name === 'mklms_d1_atomic_assertions'), false);
    assert.deepEqual(catalog.unsupported, []);
    assert.ok(catalog.triggers.some(item => item.name === 'mklms_pk_guard_students_id_insert'));
    const captureTables = catalog.tables.filter(item => !item.name.startsWith('mklms_replication_') && item.name !== 'mklms_d1_atomic_assertions' && !item.name.startsWith('_mklms_'));
    const captureNames = new Set(catalog.triggers.map(item => item.name));
    for (const table of captureTables) for (const event of ['insert','update','delete']) {
      assert.ok(captureNames.has(`mklms_replication_capture_${table.name}_${event}`), `missing ${event} capture trigger on ${table.name}`);
    }
    assert.equal(catalog.triggers.filter(item => item.name.startsWith('mklms_replication_capture_')).length, 96);
    assert.ok(catalog.indexes.some(item => item.table === 'students' && item.columns[0] === 'LOWER(email)'));
    assert.match(result.stdout, /"mode":"offline-only"/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('PostgreSQL catalog export fails closed without an explicitly named isolated audit URL', () => {
  const env = { ...process.env };
  delete env.MKLMS_SCHEMA_AUDIT_DATABASE_URL;
  const result = spawnSync(process.execPath, ['scripts/export-postgres-schema-catalog.mjs', '/tmp/mklms-catalog-must-not-be-created.json'], { encoding: 'utf8', env });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MKLMS_SCHEMA_AUDIT_DATABASE_URL/);
  assert.doesNotMatch(result.stderr, /postgres(?:ql)?:\/\/[^\s]+/i);
});

test('normalizes PostgreSQL replication trigger name truncation without hiding missing capture events', () => {
  const table = 'managed_hosting_operator_policy';
  const events = ['insert', 'update', 'delete'];
  const make = (side) => ({
    tables: [{ name: table }, { name: 'mklms_replication_config' }],
    columns: [], indexes: [], foreignKeys: [], checks: [],
    triggers: events.map(event => {
      const name = `mklms_replication_capture_${table}_${event}`;
      return { table, name: side === 'postgres' ? name.slice(0, 63) : name, definition: 'trigger body' };
    }),
    unsupported: side === 'postgres'
      ? ['postgres function mklms_capture_replication_change', 'postgres sequence mklms_replication_journal_sequence_seq']
      : [],
  });
  const report = buildSchemaParityReport(make('postgres'), make('d1'));
  assert.equal(report.complete, true);
  assert.deepEqual(report.differences, []);
  const missing = make('postgres');
  missing.triggers.pop();
  const incomplete = buildSchemaParityReport(missing, make('d1'));
  assert.ok(incomplete.unsupported.some(item => item.includes('incomplete postgres transactional replication capture')));
});

test('diagnostic CLI accepts a bounded sample limit', () => {
  const result = spawnSync(process.execPath, [
    'scripts/d1-schema-parity.mjs',
    'tests/fixtures/schema-parity-pg.json',
    'tests/fixtures/schema-parity-d1-drift.json',
    '--diagnostic-summary',
    '--sample-limit=1',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  const summary = JSON.parse(result.stdout);
  for (const samples of Object.values(summary.samples)) assert.ok(samples.length <= 1);
});

test('normalizes equivalent index scan directions and backend-native check constraints', () => {
  const names = ['lesson_progress','managed_hosting_months','media_ingest_jobs','certificate_templates','media_assets'];
  const columns = {
    postgres: [
      { table:'lesson_progress', name:'progress_percent', type:'int4' },
      { table:'managed_hosting_months', name:'amount_due_usd', type:'numeric(12,2)' },
      { table:'media_ingest_jobs', name:'estimated_cost_usd', type:'numeric(12,2)' },
      { table:'certificate_templates', name:'active', type:'bool' },
      { table:'media_assets', name:'metadata_json', type:'jsonb' },
    ],
    d1: [
      { table:'lesson_progress', name:'progress_percent', type:'INTEGER' },
      { table:'managed_hosting_months', name:'amount_due_cents', type:'INTEGER' },
      { table:'media_ingest_jobs', name:'estimated_cost_usd', type:'TEXT' },
      { table:'certificate_templates', name:'active', type:'INTEGER' },
      { table:'media_assets', name:'metadata_json', type:'TEXT' },
    ],
  };
  const completeColumn = item => ({ ...item, nullable:true, default:null, position:1, primaryKeyPosition:0 });
  const postgres = {
    tables:names.map(name=>({name})), columns:columns.postgres.map(completeColumn),
    indexes:[{table:'lesson_progress',name:'lesson_progress_recent_idx',unique:false,partial:false,columns:['student_id','created_at']}],
    foreignKeys:[], triggers:[], unsupported:[],
    checks:[
      {table:'lesson_progress',name:'progress_range',expression:'CHECK (progress_percent >= 0 AND progress_percent <= 100)'},
      {table:'managed_hosting_months',name:'amount_due_nonnegative',expression:'CHECK ((amount_due_usd IS NULL) OR (amount_due_usd >= (0)::numeric))'},
      {table:'media_ingest_jobs',name:'estimated_cost_nonnegative',expression:'CHECK ((estimated_cost_usd IS NULL) OR (estimated_cost_usd >= (0)::numeric))'},
    ],
  };
  const d1 = {
    tables:names.map(name=>({name})), columns:columns.d1.map(completeColumn),
    indexes:[{table:'lesson_progress',name:'lesson_progress_recent_idx',unique:false,partial:false,columns:['student_id','created_at DESC']}],
    foreignKeys:[], triggers:[], unsupported:[],
    checks:[
      {table:'lesson_progress',name:'progress_range',expression:'CHECK (progress_percent BETWEEN 0 AND 100)'},
      {table:'managed_hosting_months',name:'amount_due_nonnegative',expression:'CHECK (amount_due_cents IS NULL OR amount_due_cents >= 0)'},
      {table:'media_ingest_jobs',name:'estimated_cost_nonnegative',expression:"estimated_cost_usd IS NULL OR (estimated_cost_usd GLOB '[0-9]*' AND CAST(estimated_cost_usd AS REAL) >= 0)"},
      {table:'certificate_templates',name:'active_boolean',expression:'CHECK (active IN (0,1))'},
      {table:'media_assets',name:'metadata_json_valid',expression:'CHECK (json_valid(metadata_json))'},
    ],
  };
  const report=buildSchemaParityReport(postgres,d1);
  assert.equal(report.complete,true,JSON.stringify(report.differences));
  assert.deepEqual(report.differences,[]);
});
