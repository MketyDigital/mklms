#!/usr/bin/env node
/** Create only the explicitly named, empty MkLMS D1 targets. Never deletes or alters a database. */
import { pathToFileURL } from 'node:url';

const API_ROOT = 'https://api.cloudflare.com/client/v4';
const PAGE_SIZE = 100;
const MAX_PAGES = 100;
export const REQUIRED_D1_DATABASES = Object.freeze(['mklms-starpips', 'mklms-mkety-academy']);

function normalizeName(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function cloudflareJson(url, options, fetchImpl) {
  const response = await fetchImpl(url, options);
  if (!response.ok) throw new Error(`Cloudflare D1 API request failed with status ${response.status}`);
  const payload = await response.json();
  if (payload?.success !== true) throw new Error('Cloudflare D1 API returned an unsuccessful response');
  return payload;
}

async function listAllDatabases(accountId, apiToken, fetchImpl) {
  const databases = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(`${API_ROOT}/accounts/${encodeURIComponent(accountId)}/d1/database`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(PAGE_SIZE));
    const payload = await cloudflareJson(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    }, fetchImpl);
    if (!Array.isArray(payload.result)) throw new Error('Cloudflare D1 database list response was malformed');
    databases.push(...payload.result);
    const totalPages = Number(payload.result_info?.total_pages ?? 1);
    if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > MAX_PAGES) {
      throw new Error('Cloudflare D1 database list pagination was invalid');
    }
    if (page >= totalPages) return databases;
  }
  throw new Error('Cloudflare D1 database list exceeded the safe pagination limit');
}

export async function ensureCloudflareD1Databases({ accountId, apiToken, fetchImpl = fetch }) {
  if (typeof accountId !== 'string' || !accountId.trim()) throw new Error('CLOUDFLARE_ACCOUNT_ID is required');
  if (typeof apiToken !== 'string' || !apiToken.trim()) throw new Error('CLOUDFLARE_API_TOKEN is required');
  const databases = await listAllDatabases(accountId, apiToken, fetchImpl);
  const result = [];

  for (const expectedName of REQUIRED_D1_DATABASES) {
    const matches = databases.filter((database) => normalizeName(database.name) === normalizeName(expectedName));
    if (matches.length > 1) throw new Error(`ambiguous existing D1 database name for ${expectedName}`);
    if (matches.length === 1 && matches[0].name !== expectedName) {
      throw new Error(`ambiguous existing D1 database name for ${expectedName}`);
    }

    let database = matches[0];
    let action = 'reused';
    if (!database) {
      const payload = await cloudflareJson(`${API_ROOT}/accounts/${encodeURIComponent(accountId)}/d1/database`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: expectedName }),
      }, fetchImpl);
      database = payload.result;
      if (database?.name !== expectedName || typeof database.uuid !== 'string' || !database.uuid) {
        throw new Error(`Cloudflare did not confirm creation of the exact D1 database ${expectedName}`);
      }
      action = 'created';
      databases.push(database);
    }
    if (typeof database?.uuid !== 'string' || !database.uuid) {
      throw new Error(`Cloudflare D1 database ${expectedName} is missing its UUID`);
    }
    result.push({ name: expectedName, uuid: database.uuid, action });
  }

  return { databases: result };
}

async function main() {
  const result = await ensureCloudflareD1Databases({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  });
  // Database UUIDs are non-secret Wrangler configuration identifiers.
  process.stdout.write(`${JSON.stringify({ mode: 'ensure-empty-mklms-d1-targets', ...result }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
