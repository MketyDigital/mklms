#!/usr/bin/env node
/**
 * Compare normalized PostgreSQL and SQLite catalog snapshots. This tool does
 * not infer equivalence from migration text. Catalog extraction is deliberately
 * separate so a report can only claim parity from actual database catalogs.
 *
 * Usage: node scripts/d1-schema-parity.mjs pg-catalog.json d1-catalog.json [--require-complete]
 */
import { readFile } from 'node:fs/promises';

const objectKinds = ['tables', 'columns', 'indexes', 'foreignKeys', 'checks', 'triggers'];
const d1EnrollmentTriggerNames = [
  'mklms_students_all_active_enrollment_after_insert',
  'mklms_students_all_active_enrollment_after_status_change',
];
const d1MediaGuardTriggerNames = [
  'lessons_media_asset_fk_insert', 'lessons_media_asset_fk_update', 'media_assets_lessons_set_null',
  'live_sessions_media_asset_fk_insert', 'live_sessions_media_asset_fk_update', 'media_assets_live_sessions_set_null',
];
const enrollmentTriggerMapping = {
  table: 'students',
  name: 'mklms_students_all_active_course_enrollment',
  definition: 'logical:all_active_student_enrollment:v1',
};
const supportedPostgresTriggerFunctions = new Set([
  'mklms_enroll_active_student_in_all_courses',
]);
const replicationCaptureEvents = ['insert', 'update', 'delete'];
const keyFields = {
  tables: ['name'],
  columns: ['table', 'name'],
  indexes: ['table', 'name'],
  foreignKeys: ['table', 'name'],
  checks: ['table', 'name'],
  triggers: ['table', 'name'],
};
const centColumns = new Map([
  ['managed_hosting_months.minimum_floor_usd', 'minimum_floor_cents'],
  ['managed_hosting_months.amount_due_usd', 'amount_due_cents'],
  ['managed_hosting_months.settled_amount_usd', 'settled_amount_cents'],
  ['managed_hosting_operator_policy.minimum_monthly_fee_usd', 'minimum_monthly_fee_cents'],
  ['managed_hosting_operator_policy.maximum_monthly_fee_usd', 'maximum_monthly_fee_cents'],
  ['managed_hosting_daily_ledger.automatic_balance_usd', 'automatic_balance_cents'],
  ['managed_hosting_daily_ledger.operator_adjustment_usd', 'operator_adjustment_cents'],
]);
const booleanColumns = new Set([
  'managed_hosting_operator_policy.configured', 'managed_hosting_operator_policy.enabled',
  'managed_hosting_operator_policy.enforcement_enabled', 'certificate_templates.active',
  'quiz_choices.is_correct', 'quiz_attempts.passed', 'quiz_attempt_answers.correct',
  'mklms_replication_config.capture_enabled',
]);
const jsonTextColumns = new Set([
  'mklms_replication_journal.record_key', 'mklms_replication_journal.payload',
]);

function normalizedType(table, column, value) {
  const type = String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (centColumns.has(`${table}.${column}`)) return 'INTEGER_CENTS';
  if (/^(?:bool|boolean)$/.test(type) || booleanColumns.has(`${table}.${column}`) || /^(?:active|enabled|configured|enforcement_enabled|is_correct|passed|correct)$/.test(column)) return 'BOOLEAN';
  if (/^(?:int2|int4|int8|integer|smallint|bigint)$/.test(type)) return 'INTEGER';
  if (/^(?:timestamptz|timestamp with time zone|timestamp without time zone|timestamp)$/.test(type) || /(?:_at|_date)$/.test(column)) return 'TIMESTAMP_TEXT';
  if (/^(?:json|jsonb)$/.test(type) || /_json$/.test(column) || jsonTextColumns.has(`${table}.${column}`)) return 'JSON_TEXT';
  if (/^(?:uuid|text|varchar|character varying|bpchar|char|character)$/.test(type)) return 'TEXT';
  if (/^(?:numeric|decimal)(?:\([^)]*\))?$/.test(type)) {
    if (table === 'media_ingest_jobs' && ['duration_minutes', 'estimated_cost_usd'].includes(column)) return 'DECIMAL_TEXT';
    return `NUMERIC:${type.replace(/\s/g, '')}`;
  }
  if (/^(?:real|float4|float8|double precision)$/.test(type)) return 'REAL';
  return type.toUpperCase();
}

function normalizeColumn(column, side) {
  const rest = { ...column };
  delete rest.position;
  delete rest.type;
  const logicalName = side === 'd1'
    ? [...centColumns.entries()].find(([key, value]) => key.startsWith(`${column.table}.`) && value === column.name)?.[0].slice(column.table.length + 1) ?? column.name
    : column.name;
  const canonicalType = normalizedType(column.table, logicalName, column.type);
  const normalized = { ...rest, name: logicalName, type: canonicalType, default: normalizeDefault(column.default, canonicalType, side) };
  if (Number(column.primaryKeyPosition) > 0) normalized.nullable = false;
  return normalized;
}

function normalizeDefault(value, type, side) {
  if (value === null || value === undefined) return null;
  let result = String(value).trim().replace(/^\((.*)\)$/s, '$1').trim();
  if (type === 'BOOLEAN') {
    if (/^(?:true|1)$/i.test(result)) return '1';
    if (/^(?:false|0)$/i.test(result)) return '0';
  }
  if (type === 'JSON_TEXT') return result.replace(/::(?:jsonb?|text)\b/gi, '').replace(/^\((.*)\)$/s, '$1').trim();
  if (type === 'TIMESTAMP_TEXT' && /^(?:now\(\)|current_timestamp(?:\(\d*\))?)$/i.test(result)) return 'CURRENT_TIMESTAMP';
  if (type === 'INTEGER_CENTS') {
    result = result.replace(/::(?:numeric|decimal)(?:\([^)]*\))?/gi, '').trim();
    if (side === 'postgres' && /^-?\d+(?:\.\d+)?$/.test(result)) {
      const [whole, fraction = ''] = result.split('.');
      const cents = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2)) * (whole.startsWith('-') ? -1n : 1n);
      return cents.toString();
    }
  }
  return result;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

function normalizeSqlExpression(value) {
  let output = '';
  let quote = null;
  for (let index = 0; index < String(value).length; index++) {
    const character = String(value)[index];
    if (quote === "'") {
      output += character;
      if (character === "'" && String(value)[index + 1] === "'") output += String(value)[++index];
      else if (character === "'") quote = null;
      continue;
    }
    if (character === "'") { quote = character; output += character; continue; }
    if (character === '"') continue;
    output += character.toLowerCase();
  }
  output = output.replace(/::(?:text|character varying)\b/g, '').replace(/\s+/g, ' ').trim();
  output = output.replace(/=\s*any\s*\(\s*array\s*\[([\s\S]*?)\]\s*\)/g, 'IN ($1)');
  while (output.startsWith('(') && output.endsWith(')')) {
    let depth = 0; let quoteState = false; let enclosesAll = true;
    for (let index = 0; index < output.length; index++) {
      const character = output[index];
      if (character === "'" && output[index - 1] !== '\\') quoteState = !quoteState;
      if (quoteState) continue;
      if (character === '(') depth++;
      if (character === ')' && --depth === 0 && index < output.length - 1) { enclosesAll = false; break; }
    }
    if (!enclosesAll) break;
    output = output.slice(1, -1);
  }
  const andParts = splitTopLevelWord(output, 'and');
  if (andParts.length > 1) return andParts.map(normalizeSqlExpression).join(' and ');
  output = output.replace(/\bIN\b/g, 'in').replace(/\s*([(),=])\s*/g, '$1');
  return output;
}

function splitTopLevelWord(input, word) {
  const parts = []; let start = 0; let depth = 0; let inString = false;
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (character === "'" && input[index - 1] !== '\\') inString = !inString;
    if (inString) continue;
    if (character === '(') depth++;
    if (character === ')') depth--;
    if (depth === 0 && input.slice(index, index + word.length).toLowerCase() === word &&
      !/[a-z0-9_]/i.test(input[index - 1] ?? '') && !/[a-z0-9_]/i.test(input[index + word.length] ?? '')) {
      parts.push(input.slice(start, index).trim());
      start = index + word.length;
      index += word.length - 1;
    }
  }
  if (!parts.length) return [input];
  parts.push(input.slice(start).trim());
  return parts;
}

function objectKey(kind, object) {
  const fields = keyFields[kind];
  if (kind === 'indexes') {
    if (!object || typeof object.table !== 'string' || !Array.isArray(object.columns)) throw new Error(`Invalid ${kind} catalog object: ${JSON.stringify(object)}`);
    return `${object.table}.${object.columns.join(',')}.${Boolean(object.unique)}.${Boolean(object.partial)}.${object.predicate ?? ''}`;
  }
  if (kind === 'foreignKeys') {
    if (!object || typeof object.table !== 'string' || typeof object.refTable !== 'string' || !Array.isArray(object.columns) || !Array.isArray(object.refColumns)) throw new Error(`Invalid ${kind} catalog object: ${JSON.stringify(object)}`);
    return `${object.table}.${object.columns.join(',')}->${object.refTable}.${object.refColumns.join(',')}`;
  }
  if (kind === 'checks') {
    if (!object || typeof object.table !== 'string' || typeof object.expression !== 'string') throw new Error(`Invalid ${kind} catalog object: ${JSON.stringify(object)}`);
    return `${object.table}.${normalizeSqlExpression(object.expression.replace(/^CHECK\s*/i, ''))}`;
  }
  if (!fields || !object || fields.some(field => typeof object[field] !== 'string' || !object[field])) {
    throw new Error(`Invalid ${kind} catalog object: ${JSON.stringify(object)}`);
  }
  return fields.map(field => object[field]).join('.');
}

function normalizeCatalog(catalog, side) {
  if (!catalog || typeof catalog !== 'object') throw new Error('Catalog snapshot must be an object.');
  const normalized = {};
  for (const kind of objectKinds) {
    let items = catalog[kind] ?? [];
    if (!Array.isArray(items)) throw new Error(`Catalog field ${kind} must be an array.`);
    if (kind === 'triggers' && catalog.tables?.some(table => table?.name === 'mklms_replication_config')) {
      const names = new Set(items.map(item => item?.name));
      const applicationTables = catalog.tables
        .map(table => table?.name)
        .filter(name => typeof name === 'string' && !name.startsWith('mklms_replication_') && name !== 'mklms_d1_atomic_assertions' && !name.startsWith('_mklms_'));
      const missing = applicationTables.flatMap(table => replicationCaptureEvents
        .filter(event => !names.has(`mklms_replication_capture_${table}_${event}`))
        .map(event => `${table}:${event}`));
      if (missing.length) {
        normalized.unsupported ??= [];
        normalized.unsupported.push(`incomplete ${side} transactional replication capture: ${missing.join(', ')}`);
      }
    }
    if (kind === 'triggers' && side === 'd1') {
      const names = new Set(items.map(item => item?.name));
      const enrollmentCount = d1EnrollmentTriggerNames.filter(name => names.has(name)).length;
      const mediaCount = d1MediaGuardTriggerNames.filter(name => names.has(name)).length;
      if (enrollmentCount !== 0 && enrollmentCount !== d1EnrollmentTriggerNames.length) {
        normalized.unsupported ??= [];
        normalized.unsupported.push('incomplete D1 all-active enrollment trigger mapping');
      }
      if (mediaCount !== 0 && mediaCount !== d1MediaGuardTriggerNames.length) {
        normalized.unsupported ??= [];
        normalized.unsupported.push('incomplete D1 trigger-backed media foreign-key mapping');
      }
      items = items.filter(item =>
        !String(item?.name ?? '').startsWith('mklms_pk_guard_') &&
        !d1MediaGuardTriggerNames.includes(item?.name) &&
        !d1EnrollmentTriggerNames.includes(item?.name));
      if (enrollmentCount === d1EnrollmentTriggerNames.length) items = [...items, enrollmentTriggerMapping];
    }
    if (kind === 'triggers') {
      items = items.map(item => {
        if (item?.name === enrollmentTriggerMapping.name) return { ...item, definition: enrollmentTriggerMapping.definition };
        const capture = /^mklms_replication_capture_(.+)_(insert|update|delete)$/.exec(item?.name ?? '');
        if (capture) return { ...item, definition: `logical:transactional_replication_capture:${capture[1]}:${capture[2]}:v1` };
        return item;
      });
    }
    const seen = new Set();
    normalized[kind] = items.map(item => {
      let normalizedItem = kind === 'columns' ? normalizeColumn(item, side) : item;
      if (['indexes', 'foreignKeys', 'checks'].includes(kind)) {
        normalizedItem = { ...normalizedItem };
        delete normalizedItem.name;
        if (kind === 'foreignKeys') delete normalizedItem.enforcement;
      }
      if (kind === 'indexes') {
        normalizedItem.columns = normalizedItem.columns.map(normalizeSqlExpression);
        normalizedItem.predicate = normalizedItem.predicate === null ? null : normalizeSqlExpression(normalizedItem.predicate);
      }
      if (kind === 'checks') normalizedItem.expression = normalizeSqlExpression(normalizedItem.expression.replace(/^CHECK\s*/i, ''));
      const key = objectKey(kind, normalizedItem);
      if (seen.has(key)) throw new Error(`Duplicate ${kind} catalog key: ${key}`);
      seen.add(key);
      return { key, value: stable(normalizedItem) };
    }).sort((a, b) => a.key.localeCompare(b.key));
  }
  const unsupported = [...(normalized.unsupported ?? []), ...(Array.isArray(catalog.unsupported) ? catalog.unsupported.map(String) : [])];
  if (side === 'postgres' && catalog.triggers?.some(item => item?.name === enrollmentTriggerMapping.name)) {
    for (const routine of supportedPostgresTriggerFunctions) {
      const index = unsupported.indexOf(`postgres function ${routine}`);
      if (index >= 0) unsupported.splice(index, 1);
    }
  }
  normalized.unsupported = [...new Set(unsupported)].sort();
  return normalized;
}

export function buildSchemaParityReport(pgSchema, d1Schema) {
  const pg = normalizeCatalog(pgSchema, 'postgres');
  const d1 = normalizeCatalog(d1Schema, 'd1');
  const differences = [];
  for (const kind of objectKinds) {
    const pgMap = new Map(pg[kind].map(item => [item.key, item.value]));
    const d1Map = new Map(d1[kind].map(item => [item.key, item.value]));
    for (const [key, value] of pgMap) {
      if (!d1Map.has(key)) differences.push({ kind, key, difference: 'missing_in_d1', postgres: value });
      else if (JSON.stringify(value) !== JSON.stringify(d1Map.get(key))) differences.push({ kind, key, difference: 'definition_mismatch', postgres: value, d1: d1Map.get(key) });
    }
    for (const [key, value] of d1Map) {
      if (!pgMap.has(key)) differences.push({ kind, key, difference: 'missing_in_postgres', d1: value });
    }
  }
  const unsupported = [...new Set([...pg.unsupported, ...d1.unsupported])].sort();
  return {
    mode: 'normalized-catalog-comparison',
    postgresObjectCounts: Object.fromEntries(objectKinds.map(kind => [kind, pg[kind].length])),
    d1ObjectCounts: Object.fromEntries(objectKinds.map(kind => [kind, d1[kind].length])),
    differences,
    unsupported,
    semanticMappings: [
      'D1 primary-key NULL guard triggers implement PostgreSQL primary-key NOT NULL behavior; exporter fails closed when a guard is missing.',
      'D1 media-reference guard triggers plus synthetic foreign-key catalog entries implement PostgreSQL media-asset SET NULL constraints; exporter fails closed when any guard is missing.',
      'Two D1 all-active enrollment triggers are normalized to the single PostgreSQL student activation trigger; both D1 triggers must be present.',
      'The PostgreSQL all-active enrollment trigger function is treated as supported only when its known trigger is present; the D1 trigger pair must also be complete.',
      'Per-table D1/PostgreSQL row-capture triggers normalize to equivalent logical event triggers; all application tables must have insert/update/delete capture when the replication config table exists.',
    ],
    complete: differences.length === 0 && unsupported.length === 0,
  };
}

export function summarizeSchemaParityReport(report) {
  const differenceCounts = {};
  for (const difference of report.differences) {
    differenceCounts[difference.kind] ??= { missing_in_d1: 0, missing_in_postgres: 0, definition_mismatch: 0 };
    differenceCounts[difference.kind][difference.difference] = (differenceCounts[difference.kind][difference.difference] ?? 0) + 1;
  }
  return {
    mode: 'normalized-catalog-comparison-summary',
    postgresObjectCounts: report.postgresObjectCounts,
    d1ObjectCounts: report.d1ObjectCounts,
    differenceCount: report.differences.length,
    differenceCounts,
    unsupportedCount: report.unsupported.length,
    complete: report.complete,
  };
}

if (process.argv[1]?.endsWith('/d1-schema-parity.mjs')) {
  const args = process.argv.slice(2);
  const files = args.filter(arg => !arg.startsWith('--'));
  if (files.length !== 2) throw new Error('Provide PostgreSQL and D1 catalog JSON snapshot paths.');
  const [pgSchema, d1Schema] = await Promise.all(files.map(async file => JSON.parse(await readFile(file, 'utf8'))));
  const report = buildSchemaParityReport(pgSchema, d1Schema);
  console.log(JSON.stringify(args.includes('--summary-only') ? summarizeSchemaParityReport(report) : report, null, 2));
  if (args.includes('--require-complete') && !report.complete) process.exitCode = 1;
}
