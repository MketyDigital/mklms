#!/usr/bin/env node
/** Export DDL metadata only; never selects application row data or prints credentials. */
import { writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { selectPostgresCatalogSchema } from './postgres-schema-catalog-selection.mjs';

const output = process.argv[2];
const connectionString = process.env.MKLMS_SCHEMA_AUDIT_DATABASE_URL;
if (!output || !connectionString) throw new Error('Set MKLMS_SCHEMA_AUDIT_DATABASE_URL to a read-only PostgreSQL schema and provide <output.json>.');
const { Pool } = pg;
const caFile = process.env.MKLMS_SCHEMA_AUDIT_PG_CA_FILE;
const poolOptions = { connectionString, max: 1, application_name: 'mklms-schema-audit', options: '-c default_transaction_read_only=on' };
if (caFile) {
  // pg's connection-string sslmode parsing can override an explicit ssl object.
  // Remove URL SSL parameters and force certificate validation against the mounted Coolify CA.
  const secureUrl = new URL(connectionString);
  for (const name of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) secureUrl.searchParams.delete(name);
  poolOptions.connectionString = secureUrl.toString();
  poolOptions.ssl = { ca: await readFile(caFile, 'utf8'), rejectUnauthorized: true };
}
const pool = new Pool(poolOptions);
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN READ ONLY');
  const readOnly = await client.query('SHOW transaction_read_only');
  if (readOnly.rows[0]?.transaction_read_only !== 'on') throw new Error('Unable to enforce read-only PostgreSQL transaction.');
  const schemaRows = await client.query(`SELECT table_schema AS name,BOOL_OR(table_name='_mklms_migrations') AS "hasMigrationLedger",COUNT(*) FILTER (WHERE table_name <> '_mklms_migrations') AS "applicationTableCount" FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema') AND table_schema NOT LIKE 'pg_toast%' GROUP BY table_schema ORDER BY table_schema`);
  const schemaName = selectPostgresCatalogSchema(schemaRows.rows);
  const tableRows = await client.query(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' AND table_name <> '_mklms_migrations' ORDER BY table_name`, [schemaName]);
  const columns = await client.query(`SELECT c.table_name AS "table",c.column_name AS name,CASE WHEN c.data_type='numeric' THEN format('numeric(%s,%s)',c.numeric_precision,c.numeric_scale) WHEN c.data_type='character varying' THEN format('varchar(%s)',c.character_maximum_length) WHEN c.data_type='character' THEN format('char(%s)',c.character_maximum_length) WHEN c.data_type LIKE 'timestamp%' THEN format('%s(%s)',c.udt_name,c.datetime_precision) ELSE c.udt_name END AS type,c.is_nullable='YES' AS nullable,c.column_default AS "default",c.ordinal_position AS position,COALESCE(pk.primary_key_position,0) AS "primaryKeyPosition" FROM information_schema.columns c LEFT JOIN LATERAL (SELECT array_position(k.conkey,a.attnum) AS primary_key_position FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid AND a.attname=c.column_name WHERE k.contype='p' AND n.nspname=c.table_schema AND t.relname=c.table_name AND a.attnum=ANY(k.conkey) LIMIT 1) pk ON true WHERE c.table_schema=$1 AND c.table_name <> '_mklms_migrations' ORDER BY c.table_name,c.ordinal_position`, [schemaName]);
  const indexes = await client.query(`SELECT t.relname AS "table",i.relname AS name,ix.indisunique AS "unique",ix.indpred IS NOT NULL AS partial,ARRAY(SELECT COALESCE(a.attname,pg_get_indexdef(ix.indexrelid,k.ord::int,true)) FROM unnest(ix.indkey) WITH ORDINALITY k(attnum,ord) LEFT JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum WHERE k.ord<=ix.indnkeyatts ORDER BY k.ord) AS columns,pg_get_expr(ix.indpred,ix.indrelid) AS predicate,EXISTS(SELECT 1 FROM unnest(ix.indkey) k(attnum) WHERE k.attnum=0) AS has_expressions FROM pg_index ix JOIN pg_class t ON t.oid=ix.indrelid JOIN pg_class i ON i.oid=ix.indexrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1 AND t.relname <> '_mklms_migrations' AND NOT ix.indisprimary ORDER BY t.relname,i.relname`, [schemaName]);
  const fks = await client.query(`SELECT t.relname AS "table",c.conname AS name,array_agg(a.attname ORDER BY k.ord) AS columns,r.relname AS "refTable",array_agg(ra.attname ORDER BY k.ord) AS "refColumns",CASE c.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS "onUpdate",CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS "onDelete" FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_class r ON r.oid=c.confrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY k(attnum,refattnum,ord) ON true JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum JOIN pg_attribute ra ON ra.attrelid=r.oid AND ra.attnum=k.refattnum WHERE c.contype='f' AND n.nspname=$1 AND t.relname <> '_mklms_migrations' GROUP BY t.relname,c.conname,r.relname,c.confupdtype,c.confdeltype ORDER BY t.relname,c.conname`, [schemaName]);
  const checks = await client.query(`SELECT t.relname AS "table",c.conname AS name,pg_get_constraintdef(c.oid) AS expression FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.contype='c' AND n.nspname=$1 AND t.relname <> '_mklms_migrations' ORDER BY t.relname,c.conname`, [schemaName]);
  const triggers = await client.query(`SELECT t.relname AS "table",g.tgname AS name,pg_get_triggerdef(g.oid,true) AS definition FROM pg_trigger g JOIN pg_class t ON t.oid=g.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE NOT g.tgisinternal AND n.nspname=$1 AND t.relname <> '_mklms_migrations' ORDER BY t.relname,g.tgname`, [schemaName]);
  const routines = await client.query(`SELECT p.proname,p.prokind FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.prokind IN ('f','p') ORDER BY p.proname`, [schemaName]);
  const enums = await client.query(`SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=$1 AND t.typtype='e' ORDER BY t.typname`, [schemaName]);
  const sequences = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='S' ORDER BY c.relname`, [schemaName]);
  const catalog = {
    tables: tableRows.rows,
    columns: columns.rows.map(row => ({ ...row, nullable: Boolean(row.nullable), position: Number(row.position), primaryKeyPosition: Number(row.primaryKeyPosition) })),
    indexes: indexes.rows.map(row => ({ ...row, unique: Boolean(row.unique), partial: Boolean(row.partial), columns: row.columns.map(String), predicate: row.predicate?.replace(/\s+/g, ' ').trim() ?? null })),
    foreignKeys: fks.rows,
    checks: checks.rows,
    triggers: triggers.rows,
    unsupported: [
      ...routines.rows.map(row => `postgres ${row.prokind === 'p' ? 'procedure' : 'function'} ${row.proname}`),
      ...enums.rows.map(row => `postgres enum ${row.typname}`),
      ...sequences.rows.map(row => `postgres sequence ${row.relname}`),
    ],
  };
  await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(JSON.stringify({ mode: 'read-only-postgres-catalog', output, tables: catalog.tables.length, columns: catalog.columns.length, indexes: catalog.indexes.length, foreignKeys: catalog.foreignKeys.length, checks: catalog.checks.length, triggers: catalog.triggers.length, unsupported: catalog.unsupported.length }) + '\n');
  await client.query('COMMIT');
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => {});
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'UNKNOWN';
  const schemaSelectionFailure = /^(?:Multiple MkLMS migration-ledger schemas|Could not select one PostgreSQL application schema safely)/.test(String(error?.message));
  process.stderr.write(`PostgreSQL catalog export failed (${code}${schemaSelectionFailure ? '; schema selection is missing or ambiguous' : ''}); connection details suppressed.\n`);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
