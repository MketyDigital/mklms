#!/usr/bin/env node
/** Read-only Cloudflare D1 metadata and schema inventory; never reads application rows. */
import { appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const API_ROOT = 'https://api.cloudflare.com/client/v4';
const PAGE_SIZE = 100;
const MAX_PAGES = 100;
export const D1_SCHEMA_SQL = "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name";

function normalizeName(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchesInstallation(databaseName, installationId) {
  const actual = normalizeName(databaseName);
  const installation = normalizeName(installationId);
  return actual === installation || actual === `mklms${installation}`;
}

async function cloudflareJson(url, options, fetchImpl) {
  const response = await fetchImpl(url, options);
  if (!response.ok) throw new Error(`Cloudflare D1 request failed (${response.status})`);
  const body = await response.json();
  if (body?.success !== true) throw new Error('Cloudflare D1 request returned an unsuccessful response');
  return body;
}

export async function fetchCloudflareD1Inventory({ accountId, apiToken, installationId, fetchImpl = globalThis.fetch }) {
  if (!accountId || !apiToken) throw new Error('Cloudflare account ID and API token are required');
  if (!['starpips', 'mkety-academy'].includes(installationId)) throw new Error(`Unsupported installation: ${installationId}`);
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');

  const headers = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' };
  const accountDatabases = [];
  let totalCount = Infinity;
  for (let page = 1; page <= MAX_PAGES && accountDatabases.length < totalCount; page++) {
    const url = new URL(`${API_ROOT}/accounts/${encodeURIComponent(accountId)}/d1/database`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(PAGE_SIZE));
    const body = await cloudflareJson(url, { method: 'GET', headers }, fetchImpl);
    const rows = Array.isArray(body.result) ? body.result : [];
    accountDatabases.push(...rows.map((database) => ({
      id: String(database.uuid ?? ''),
      name: String(database.name ?? ''),
      version: database.version ?? null,
      jurisdiction: database.jurisdiction ?? null,
      createdAt: database.created_at ?? null,
    })));
    const reportedTotal = Number(body.result_info?.total_count);
    totalCount = Number.isFinite(reportedTotal) ? reportedTotal : accountDatabases.length;
    if (rows.length === 0) break;
  }
  if (accountDatabases.length < totalCount) throw new Error(`Cloudflare D1 listing exceeded the ${MAX_PAGES}-page safety limit`);

  const databases = accountDatabases.filter((database) => matchesInstallation(database.name, installationId));
  const catalogs = await Promise.all(databases.map(async (database) => {
    if (!database.id) throw new Error(`Cloudflare D1 database ${database.name || '(unnamed)'} has no ID`);
    const url = `${API_ROOT}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(database.id)}/query`;
    const body = await cloudflareJson(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sql: D1_SCHEMA_SQL }),
    }, fetchImpl);
    const results = body.result?.[0]?.results;
    if (!Array.isArray(results)) throw new Error(`Cloudflare D1 schema query returned an invalid result for ${database.name}`);
    if (body.result.some((result) => result?.success === false)) throw new Error(`Cloudflare D1 schema query failed for ${database.name}`);
    const objects = results.map((item) => ({
      type: String(item.type ?? ''),
      name: String(item.name ?? ''),
      table: String(item.tbl_name ?? ''),
      sql: item.sql == null ? null : String(item.sql),
    }));
    return { databaseId: database.id, databaseName: database.name, objects };
  }));

  return {
    mode: 'read-only-cloudflare-d1-inventory',
    installationId,
    accountDatabaseCount: accountDatabases.length,
    databases,
    catalogs,
    capturedAt: new Date().toISOString(),
  };
}

export function markdownSummary(inventory, { countsOnly = false } = {}) {
  const targetNames = new Set(inventory.catalogs.map(({ databaseName }) => databaseName));
  if (countsOnly) {
    const objectCount = inventory.catalogs.reduce((total, catalog) => total + catalog.objects.length, 0);
    return [
      `## Cloudflare D1 schema audit: ${inventory.installationId}`,
      '',
      `Databases visible in the account: ${inventory.accountDatabaseCount}. Exact installation matches: ${targetNames.size}. Schema objects across matching databases: ${objectCount}.`,
      '',
      'Only SQLite schema metadata was queried; application rows were not read. Database names, identifiers, and DDL are omitted from this summary.',
      '',
    ].join('\n');
  }
  const lines = [
    `## Cloudflare D1 inventory: ${inventory.installationId}`,
    '',
    `D1 databases visible in the account: ${inventory.accountDatabaseCount}. Installation name matches: ${targetNames.size}.`,
    '',
    '| Database | ID | Version | Schema objects |',
    '| --- | --- | --- | ---: |',
  ];
  for (const database of inventory.databases) {
    const catalog = inventory.catalogs.find((item) => item.databaseId === database.id);
    if (catalog) lines.push(`| ${database.name} | ${database.id} | ${database.version ?? 'unknown'} | ${catalog.objects.length} |`);
  }
  if (targetNames.size === 0) lines.push('', 'No D1 database name matched this installation. No database was queried.');
  lines.push('', 'Only SQLite schema metadata was queried; application rows were not read.');
  return `${lines.join('\n')}\n`;
}

export async function writeCloudflareD1Inventory(inventory, outputPath, summaryPath) {
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, { flag: 'wx' });
  const summary = markdownSummary(inventory, { countsOnly: process.env.D1_SCHEMA_SUMMARY_COUNTS_ONLY === '1' });
  if (summaryPath) await appendFile(summaryPath, summary);
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const installationId = process.env.INSTALLATION_ID;
  const inventory = await fetchCloudflareD1Inventory({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    installationId,
  });
  const outputPath = process.env.D1_SCHEMA_REPORT_PATH;
  await writeCloudflareD1Inventory(inventory, outputPath, process.env.GITHUB_STEP_SUMMARY);
  console.log(`D1 databases: ${inventory.databases.length}; matching schema catalogs: ${inventory.catalogs.length}.`);
  if (outputPath) console.log(`Schema inventory written to ${path.basename(outputPath)}.`);
}
