#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const centralPostgres = Object.freeze({
  uuid: 'hgxwkiyxgbmb2i3pl57kmxc8',
  projectUuid: '0zqhpkprlhtvlacmsgmfyyhs',
  environmentUuid: 'rtebcetyfvzlaiqitzcp0gl8',
  serverUuid: 'ynkdc4tx6bi7cyxf0kuy8kte',
});

function urlIdentity(value) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('Configured PostgreSQL connection URL is invalid.'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('PostgreSQL URL required.');
  return {
    database: decodeURIComponent(parsed.pathname.replace(/^\/+/, '')),
    user: decodeURIComponent(parsed.username),
  };
}

export function resolveMatchingDatabaseUrl(configuredUrl, internalUrl) {
  const configured = urlIdentity(configuredUrl);
  const internal = urlIdentity(internalUrl);
  if (!configured.database || !configured.user || configured.database !== internal.database || configured.user !== internal.user) {
    throw new Error('Coolify PostgreSQL identity does not match the configured MkLMS database and user.');
  }
  return internalUrl;
}

export function decodeCatalogChunks(logs) {
  const found = new Map();
  let expected;
  for (const match of logs.matchAll(/MKLMS_CATALOG_CHUNK:(\d+)\/(\d+):([A-Za-z0-9+/=]+)/g)) {
    const index = Number(match[1]);
    const total = Number(match[2]);
    if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total) || total < 1 || index < 1 || index > total) {
      throw new Error('Malformed PostgreSQL catalog chunks.');
    }
    if (expected !== undefined && expected !== total) throw new Error('Inconsistent PostgreSQL catalog chunk count.');
    expected = total;
    if (found.has(index)) throw new Error('Duplicate PostgreSQL catalog chunk.');
    found.set(index, match[3]);
  }
  if (!expected || found.size !== expected) throw new Error('Coolify executor did not return a complete PostgreSQL catalog.');
  const encoded = Array.from({ length: expected }, (_, i) => {
    const chunk = found.get(i + 1);
    if (!chunk) throw new Error('Coolify executor returned an incomplete PostgreSQL catalog.');
    return chunk;
  }).join('');
  const catalog = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
  for (const key of ['tables', 'columns', 'indexes', 'foreignKeys', 'checks', 'triggers', 'unsupported']) {
    if (!Array.isArray(catalog[key])) throw new Error(`PostgreSQL catalog is missing ${key}.`);
  }
  return catalog;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const token = process.env.OCI_COOLIFY_TOKEN;
  const baseUrl = (process.env.COOLIFY_URL || 'https://deploy.mkety.com').replace(/\/+$/, '');
  const configuredDatabaseUrl = process.env.MKLMS_PG_STAGING_DATABASE_URL;
  const branch = process.env.MKLMS_COOLIFY_GIT_BRANCH;
  const sha = process.env.MKLMS_COOLIFY_GIT_SHA;
  const runId = process.env.GITHUB_RUN_ID || 'local';
  const outputPath = process.env.MKLMS_SCHEMA_AUDIT_OUTPUT || 'schema-audit-output/postgres-production.json';
  if (!token) throw new Error('Missing OCI_COOLIFY_TOKEN.');
  if (!configuredDatabaseUrl) throw new Error('Missing MKLMS_PG_STAGING_DATABASE_URL.');
  if (!branch || !/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('An exact repository branch and 40-character commit SHA are required.');
  if (new URL(baseUrl).origin !== 'https://deploy.mkety.com') throw new Error('Coolify URL must use https://deploy.mkety.com.');

  const apiRoot = `${baseUrl}/api/v1`;
  const headers = { Authorization: `Bearer ${token}` };
  let appUuid;
  const request = async (path, { method = 'GET', body, timeoutMs = 30_000 } = {}) => {
    const response = await fetch(`${apiRoot}${path}`, {
      method,
      headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Coolify API ${method} ${path} failed with HTTP ${response.status}.`);
    if (!text) return {};
    try { return JSON.parse(text); } catch { throw new Error(`Coolify API ${method} ${path} returned invalid JSON.`); }
  };

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const safeUrl = await (async () => {
    const health = await fetch(`${baseUrl}/api/v1/health`, { signal: AbortSignal.timeout(15_000) });
    if (!health.ok) throw new Error(`Coolify health check failed with HTTP ${health.status}.`);
    const database = await request(`/databases/${centralPostgres.uuid}`);
    const healthy = String(database.status || '').toLowerCase().includes('healthy');
    if (database.is_public !== false || database.enable_ssl !== true || !healthy || typeof database.internal_db_url !== 'string') {
      throw new Error('Coolify central PostgreSQL did not pass private, TLS, and healthy preflight checks.');
    }
    const match = resolveMatchingDatabaseUrl(configuredDatabaseUrl, database.internal_db_url);
    process.stdout.write(`::add-mask::${match}\n`);
    return match;
  })();

  try {
    const created = await request('/applications/public', {
      method: 'POST',
      body: {
        project_uuid: centralPostgres.projectUuid,
        server_uuid: centralPostgres.serverUuid,
        environment_uuid: centralPostgres.environmentUuid,
        git_repository: 'https://github.com/MketyDigital/mklms',
        git_branch: branch,
        git_commit_sha: sha,
        build_pack: 'dockerfile',
        dockerfile_location: '/ops/coolify-readonly-audit/Dockerfile',
        ports_exposes: '3000',
        name: `mklms-pg-ro-${sha.slice(0, 8)}-${runId}`,
        description: `Ephemeral read-only MkLMS PostgreSQL catalog audit for ${sha}`,
        autogenerate_domain: false,
        connect_to_docker_network: true,
        instant_deploy: false,
      },
    });
    if (!created.uuid) throw new Error('Coolify did not return the ephemeral executor UUID.');
    appUuid = created.uuid;
    process.stdout.write('::add-mask::' + appUuid + '\n');

    const env = await request(`/applications/${appUuid}/envs`, {
      method: 'POST',
      body: {
        key: 'DATABASE_URL', value: safeUrl, is_preview: false, is_literal: true,
        is_multiline: false, is_shown_once: true,
      },
    });
    void env;

    const deployed = await request(`/deploy?uuid=${encodeURIComponent(appUuid)}&force=true`, { method: 'POST' });
    const deploymentUuid = Array.isArray(deployed.deployments) ? deployed.deployments[0]?.deployment_uuid : undefined;
    if (!deploymentUuid) throw new Error('Coolify did not return an executor deployment ID.');

    let finished = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const deployment = await request(`/deployments/${encodeURIComponent(deploymentUuid)}`);
      const status = String(deployment.status || '').toLowerCase();
      if (['finished', 'success', 'successful', 'succeeded', 'completed'].includes(status)) { finished = true; break; }
      if (['failed', 'failure', 'error', 'cancelled', 'canceled'].includes(status)) throw new Error(`Coolify executor build failed (${status}).`);
      await delay(5_000);
    }
    if (!finished) throw new Error('Timed out waiting for the Coolify executor build.');

    let catalog;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const logs = await request(`/applications/${appUuid}/logs?lines=1000&show_timestamps=false`);
      if (typeof logs.logs === 'string' && logs.logs.includes('MKLMS_CATALOG_END')) {
        catalog = decodeCatalogChunks(logs.logs);
        break;
      }
      const app = await request(`/applications/${appUuid}`);
      const status = String(app.status || '').toLowerCase();
      if (status.startsWith('exited:') || ['failed', 'error'].includes(status)) throw new Error(`Coolify executor exited before the catalog completed (${status}).`);
      await delay(3_000);
    }
    if (!catalog) throw new Error('Timed out waiting for the read-only PostgreSQL catalog.');
    await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, { flag: 'wx' });
    process.stdout.write(JSON.stringify({
      source: 'coolify-private-postgres-read-only',
      tables: catalog.tables.length,
      columns: catalog.columns.length,
      indexes: catalog.indexes.length,
      foreignKeys: catalog.foreignKeys.length,
      checks: catalog.checks.length,
      triggers: catalog.triggers.length,
      unsupported: catalog.unsupported.length,
    }) + '\n');
  } finally {
    if (appUuid) {
      try {
        await request(`/applications/${appUuid}`, { method: 'DELETE' });
        process.stdout.write('Deleted ephemeral Coolify PostgreSQL audit executor.\n');
      } catch {
        process.stderr.write('Could not confirm Coolify executor cleanup; inspect the ephemeral mklms-pg-ro application.\n');
        process.exitCode = 1;
      }
    }
  }
}
