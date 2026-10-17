#!/usr/bin/env node
/** Build a local SQLite catalog snapshot by applying D1 migrations in memory. */
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/export-d1-schema-catalog.mjs <output.json>');
const directory = path.join(process.cwd(), 'db/d1-migrations');
const migrations = (await readdir(directory)).filter(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
const db = new DatabaseSync(':memory:');
function matchingParen(sql, start) {
  let depth = 0; let quote = null;
  for (let index = start; index < sql.length; index++) {
    const character = sql[index];
    if (quote) {
      if (character === quote && sql[index + 1] === quote) { index++; continue; }
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') { quote = character; continue; }
    if (character === '(') depth++;
    if (character === ')' && --depth === 0) return index;
  }
  return -1;
}
function splitTopLevel(sql) {
  const parts = []; let start = 0; let depth = 0; let quote = null;
  for (let index = 0; index < sql.length; index++) {
    const character = sql[index];
    if (quote) {
      if (character === quote && sql[index + 1] === quote) { index++; continue; }
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') { quote = character; continue; }
    if (character === '(') depth++;
    if (character === ')') depth--;
    if (character === ',' && depth === 0) { parts.push(sql.slice(start, index).trim()); start = index + 1; }
  }
  parts.push(sql.slice(start).trim());
  return parts;
}
function parseIndexDefinition(sql) {
  const on = /\bON\s+["`\w]+\s*\(/i.exec(sql || '');
  if (!on) return null;
  const open = sql.indexOf('(', on.index);
  const close = matchingParen(sql, open);
  if (close < 0) return null;
  const predicate = sql.slice(close + 1).match(/\bWHERE\b([\s\S]*)$/i)?.[1]?.trim() ?? null;
  return { columns: splitTopLevel(sql.slice(open + 1, close)), predicate };
}
try {
  db.exec('PRAGMA foreign_keys=ON');
  for (const name of migrations) db.exec(await readFile(path.join(directory, name), 'utf8'));
  // The assertion guard is D1 batch-control plumbing, not application schema.
  const tables = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'mklms_d1_atomic_assertions' ORDER BY name").all();
  const catalog = { tables: tables.map(({ name }) => ({ name })), columns: [], indexes: [], foreignKeys: [], checks: [], triggers: [], unsupported: [] };
  for (const { name, sql } of tables) {
    for (const column of db.prepare(`PRAGMA table_info("${name.replaceAll('"', '""')}")`).all()) {
      catalog.columns.push({ table: name, name: column.name, type: String(column.type || '').toUpperCase(), nullable: !Boolean(column.notnull), default: column.dflt_value === null ? null : String(column.dflt_value), primaryKeyPosition: Number(column.pk) });
    }
    const groupedFks = new Map();
    for (const fk of db.prepare(`PRAGMA foreign_key_list("${name.replaceAll('"', '""')}")`).all()) {
      const group = groupedFks.get(fk.id) ?? { table: name, name: `fk_${fk.id}`, columns: [], refTable: fk.table, refColumns: [], onUpdate: fk.on_update, onDelete: fk.on_delete, parts: [] };
      group.parts.push(fk);
      groupedFks.set(fk.id, group);
    }
    for (const group of groupedFks.values()) {
      group.parts.sort((a, b) => a.seq - b.seq);
      group.columns = group.parts.map(part => part.from);
      group.refColumns = group.parts.map(part => part.to);
      delete group.parts;
      catalog.foreignKeys.push(group);
    }
    for (const index of db.prepare(`PRAGMA index_list("${name.replaceAll('"', '""')}")`).all()) {
      if (index.origin === 'pk') continue; // Primary-key order is recorded on each column.
      const indexName = index.name;
      const indexColumns = db.prepare(`PRAGMA index_info("${indexName.replaceAll('"', '""')}")`).all().sort((a, b) => a.seqno - b.seqno);
      const definition = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name=?").get(indexName)?.sql || '';
      const parsed = definition ? parseIndexDefinition(definition) : null;
      if (indexColumns.some(column => column.name === null) && !parsed) catalog.unsupported.push(`sqlite expression index ${name}.${indexName}`);
      const predicate = index.partial ? (parsed?.predicate || '').replace(/\s+/g, ' ').trim() : null;
      const columns = parsed?.columns ?? indexColumns.map(column => column.name);
      catalog.indexes.push({ table: name, name: indexName, unique: Boolean(index.unique), partial: Boolean(index.partial), columns, predicate });
    }
    const parsedChecks = [];
    for (const match of sql.matchAll(/CHECK\s*\(/gi)) {
      const open = sql.indexOf('(', match.index);
      const close = matchingParen(sql, open);
      if (close >= 0) parsedChecks.push(sql.slice(open + 1, close).trim());
    }
    for (const expression of parsedChecks) catalog.checks.push({ table: name, name: `check_${catalog.checks.filter(item => item.table === name).length}`, expression: expression.replace(/\s+/g, ' ').trim() });
    const declaredCheckCount = [...sql.matchAll(/\bCHECK\s*\(/gi)].length;
    if (parsedChecks.length !== declaredCheckCount) catalog.unsupported.push(`unparsed SQLite CHECK expression ${name}`);
  }
  for (const trigger of db.prepare("SELECT name,tbl_name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all()) {
    catalog.triggers.push({ table: trigger.tbl_name, name: trigger.name, definition: trigger.sql.replace(/\s+/g, ' ').trim() });
  }
  for (const { name } of tables) {
    const primaryKeys = db.prepare(`PRAGMA table_info("${name.replaceAll('"', '""')}")`).all().filter(column => column.pk > 0 && !column.notnull && !/^INTEGER$/i.test(column.type));
    for (const column of primaryKeys) {
      const safe = `${name}_${column.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
      for (const event of ['insert', 'update']) {
        if (!catalog.triggers.some(trigger => trigger.name === `mklms_pk_guard_${safe}_${event}`)) catalog.unsupported.push(`missing SQLite primary-key NULL guard ${name}.${column.name}:${event}`);
      }
    }
  }
  const triggerBackedForeignKeys = [
    { table: 'lessons', name: 'lessons_media_asset_fk', guard: 'lessons_media_asset_fk_insert', columns: ['media_asset_id'] },
    { table: 'live_sessions', name: 'live_sessions_media_asset_fk', guard: 'live_sessions_media_asset_fk_insert', columns: ['media_asset_id'] },
  ];
  for (const item of triggerBackedForeignKeys) {
    const deleteGuard = item.table === 'lessons' ? 'media_assets_lessons_set_null' : 'media_assets_live_sessions_set_null';
    const required = [item.guard, `${item.table}_media_asset_fk_update`, deleteGuard];
    if (!required.every(name => catalog.triggers.some(trigger => trigger.name === name))) {
      catalog.unsupported.push(`incomplete trigger-backed media foreign key ${item.table}.media_asset_id`);
      continue;
    }
    catalog.foreignKeys.push({ table: item.table, name: item.name, columns: item.columns, refTable: 'media_assets', refColumns: ['id'], onUpdate: 'NO ACTION', onDelete: 'SET NULL', enforcement: 'verified-triggers' });
  }
  await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(JSON.stringify({ mode: 'offline-only', output, tables: catalog.tables.length, columns: catalog.columns.length, indexes: catalog.indexes.length, foreignKeys: catalog.foreignKeys.length, checks: catalog.checks.length, triggers: catalog.triggers.length }) + '\n');
} finally { db.close(); }
