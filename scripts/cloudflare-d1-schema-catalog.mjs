#!/usr/bin/env node
/** Export a selected live D1 catalog using SQLite metadata only. */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchCloudflareD1Inventory } from './cloudflare-d1-live-inventory.mjs';

const excludedTables = new Set(['_mklms_migrations', 'mklms_d1_atomic_assertions', 'd1_migrations']);

function matchingParen(sql, start) {
  let depth = 0;
  let quote = null;
  for (let index = start; index < sql.length; index += 1) {
    const character = sql[index];
    if (quote) {
      if (character === quote && sql[index + 1] === quote) { index += 1; continue; }
      if (character === quote) quote = null;
      continue;
    }
    if (["'", '"', '`'].includes(character)) { quote = character; continue; }
    if (character === '(') depth += 1;
    if (character === ')' && --depth === 0) return index;
  }
  return -1;
}

function splitTopLevel(sql) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    if (quote) {
      if (character === quote && sql[index + 1] === quote) { index += 1; continue; }
      if (character === quote) quote = null;
      continue;
    }
    if (["'", '"', '`'].includes(character)) { quote = character; continue; }
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
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

function tableChecks(sql) {
  const checks = [];
  for (const match of String(sql || '').matchAll(/\bCHECK\s*\(/gi)) {
    const open = String(sql).indexOf('(', match.index);
    const close = matchingParen(String(sql), open);
    if (close >= 0) checks.push(String(sql).slice(open + 1, close).replace(/\s+/g, ' ').trim());
  }
  return checks;
}

export function buildD1SchemaCatalog(objects, metadataByTable) {
  const tables = objects.filter(item => item.type === 'table' && !item.name.startsWith('sqlite_') && !excludedTables.has(item.name));
  const tableNames = new Set(tables.map(item => item.name));
  const objectByName = new Map(objects.map(item => [item.name, item]));
  const catalog = { tables: tables.map(({ name }) => ({ name })), columns: [], indexes: [], foreignKeys: [], checks: [], triggers: [], unsupported: [] };

  for (const table of tables) {
    const metadata = metadataByTable[table.name];
    if (!metadata) throw new Error(`D1 metadata is missing for table ${table.name}.`);
    for (const column of metadata.columns) {
      catalog.columns.push({
        table: table.name,
        name: String(column.name),
        type: String(column.type || '').toUpperCase(),
        nullable: !Boolean(column.notnull),
        default: column.dflt_value === null ? null : String(column.dflt_value),
        primaryKeyPosition: Number(column.pk),
      });
    }

    const groupedFks = new Map();
    for (const fk of metadata.foreignKeys) {
      const group = groupedFks.get(fk.id) ?? { table: table.name, name: `fk_${fk.id}`, columns: [], refTable: fk.table, refColumns: [], onUpdate: fk.on_update, onDelete: fk.on_delete, parts: [] };
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

    for (const index of metadata.indexes) {
      if (index.origin === 'pk') continue;
      const indexObject = objectByName.get(index.name);
      const parsed = indexObject?.sql ? parseIndexDefinition(indexObject.sql) : null;
      if (index.columns.some(column => column.name === null) && !parsed) catalog.unsupported.push(`sqlite expression index ${table.name}.${index.name}`);
      catalog.indexes.push({
        table: table.name,
        name: index.name,
        unique: Boolean(index.unique),
        partial: Boolean(index.partial),
        columns: parsed?.columns ?? index.columns.map(column => column.name),
        predicate: index.partial ? (parsed?.predicate || '').replace(/\s+/g, ' ').trim() : null,
      });
    }

    const checks = tableChecks(table.sql);
    for (const expression of checks) catalog.checks.push({ table: table.name, name: `check_${catalog.checks.filter(item => item.table === table.name).length}`, expression });
    if (checks.length !== [...String(table.sql || '').matchAll(/\bCHECK\s*\(/gi)].length) catalog.unsupported.push(`unparsed SQLite CHECK expression ${table.name}`);
  }

  for (const trigger of objects.filter(item => item.type === 'trigger' && tableNames.has(item.table ?? item.tbl_name))) {
    if (typeof trigger.sql !== 'string' || !trigger.sql) catalog.unsupported.push(`unreadable SQLite trigger ${trigger.name}`);
    else catalog.triggers.push({ table: trigger.table ?? trigger.tbl_name, name: trigger.name, definition: trigger.sql.replace(/\s+/g, ' ').trim() });
  }

  for (const table of tables) {
    const columns = metadataByTable[table.name].columns;
    const primaryKeys = columns.filter(column => column.pk > 0 && !column.notnull && !/^INTEGER$/i.test(column.type));
    for (const column of primaryKeys) {
      const safe = `${table.name}_${column.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
      for (const event of ['insert', 'update']) {
        if (!catalog.triggers.some(trigger => trigger.name === `mklms_pk_guard_${safe}_${event}`)) catalog.unsupported.push(`missing SQLite primary-key NULL guard ${table.name}.${column.name}:${event}`);
      }
    }
  }

  for (const item of [
    { table: 'lessons', name: 'lessons_media_asset_fk', insert: 'lessons_media_asset_fk_insert', update: 'lessons_media_asset_fk_update', deletion: 'media_assets_lessons_set_null' },
    { table: 'live_sessions', name: 'live_sessions_media_asset_fk', insert: 'live_sessions_media_asset_fk_insert', update: 'live_sessions_media_asset_fk_update', deletion: 'media_assets_live_sessions_set_null' },
  ]) {
    if (!tableNames.has(item.table)) continue;
    const required = [item.insert, item.update, item.deletion];
    if (!required.every(name => catalog.triggers.some(trigger => trigger.name === name))) {
      catalog.unsupported.push(`incomplete trigger-backed media foreign key ${item.table}.media_asset_id`);
      continue;
    }
    catalog.foreignKeys.push({ table: item.table, name: item.name, columns: ['media_asset_id'], refTable: 'media_assets', refColumns: ['id'], onUpdate: 'NO ACTION', onDelete: 'SET NULL', enforcement: 'verified-triggers' });
  }
  return catalog;
}

async function queryD1({ accountId, databaseId, apiToken, sql, fetchImpl }) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!response.ok) throw new Error(`Cloudflare D1 metadata query failed (${response.status}).`);
  const body = await response.json();
  if (body?.success !== true || body.result?.some(result => result?.success === false)) throw new Error('Cloudflare D1 metadata query returned an unsuccessful response.');
  const results = body.result?.[0]?.results;
  if (!Array.isArray(results)) throw new Error('Cloudflare D1 metadata query returned an invalid result.');
  return results;
}

function sqlIdentifier(value) { return `"${String(value).replaceAll('"', '""')}"`; }

async function mapLimit(items, limit, callback) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await callback(items[index], index);
    }
  }));
  return results;
}

export async function fetchCloudflareD1SchemaCatalog({ accountId, apiToken, installationId, fetchImpl = globalThis.fetch }) {
  const inventory = await fetchCloudflareD1Inventory({ accountId, apiToken, installationId, fetchImpl });
  if (inventory.databases.length !== 1 || inventory.catalogs.length !== 1) throw new Error(`Expected exactly one D1 database for ${installationId}; found ${inventory.catalogs.length}.`);
  const database = inventory.databases[0];
  const objects = inventory.catalogs[0].objects;
  const tables = objects.filter(item => item.type === 'table' && !item.name.startsWith('sqlite_') && !excludedTables.has(item.name));
  const tableMetadata = await mapLimit(tables, 5, async table => {
    const identifier = sqlIdentifier(table.name);
    const [columns, foreignKeys, indexRows] = await Promise.all([
      queryD1({ accountId, databaseId: database.id, apiToken, sql: `PRAGMA table_info(${identifier})`, fetchImpl }),
      queryD1({ accountId, databaseId: database.id, apiToken, sql: `PRAGMA foreign_key_list(${identifier})`, fetchImpl }),
      queryD1({ accountId, databaseId: database.id, apiToken, sql: `PRAGMA index_list(${identifier})`, fetchImpl }),
    ]);
    const indexes = await mapLimit(indexRows, 5, async index => ({
      ...index,
      columns: await queryD1({ accountId, databaseId: database.id, apiToken, sql: `PRAGMA index_info(${sqlIdentifier(index.name)})`, fetchImpl }),
    }));
    return [table.name, { columns, foreignKeys, indexes }];
  });
  return {
    mode: 'read-only-cloudflare-d1-schema-catalog',
    installationId,
    databaseName: database.name,
    databaseId: database.id,
    capturedAt: new Date().toISOString(),
    ...buildD1SchemaCatalog(objects, Object.fromEntries(tableMetadata)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [installationId, outputPath] = process.argv.slice(2);
  if (!installationId || !outputPath) throw new Error('Usage: node scripts/cloudflare-d1-schema-catalog.mjs <installation> <output.json>');
  const catalog = await fetchCloudflareD1SchemaCatalog({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    installationId,
  });
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ mode: catalog.mode, installationId, tables: catalog.tables.length, columns: catalog.columns.length, indexes: catalog.indexes.length, foreignKeys: catalog.foreignKeys.length, checks: catalog.checks.length, triggers: catalog.triggers.length, unsupported: catalog.unsupported.length }));
}
