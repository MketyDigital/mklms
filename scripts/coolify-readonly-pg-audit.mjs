#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { verifiedPostgresUrl } from './verified-postgres-url.mjs';

export const centralPostgres = Object.freeze({
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

export function validateReadOnlyAuditSourceUrl(sourceUrl, configuredSslMode) {
  urlIdentity(sourceUrl);
  return verifiedPostgresUrl(sourceUrl, configuredSslMode);
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

export function classifyCoolifyFailure(...diagnostics) {
  const text = diagnostics.map(value => typeof value === 'string' ? value : '').join('\n');
  if (/repository not found|could not read from remote repository|authentication failed.*github|repository access denied/i.test(text)) return 'source_checkout';
  if (/failed to read dockerfile|dockerfile.*not found|no such file or directory.*dockerfile/i.test(text)) return 'dockerfile';
  if (/EAI_AGAIN|ENOTFOUND|could not resolve host|network is unreachable|connection timed out/i.test(text)) return 'network';
  if (/npm ERR|npm error|failed to solve|executor failed running/i.test(text)) return 'container_build';
  return 'unclassified';
}

export function safeCoolifyDiagnostic(...diagnostics) {
  const lines = [];
  const visit = (value, depth = 0) => {
    if (depth > 5 || value == null) return;
    if (Array.isArray(value)) { for (const entry of value) visit(entry, depth + 1); return; }
    if (typeof value === 'object') {
      for (const key of ['output', 'logs', 'log', 'message', 'stderr', 'error']) visit(value[key], depth + 1);
      return;
    }
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { visit(JSON.parse(trimmed), depth + 1); return; } catch {}
    }
    lines.push(...value.split(/\r?\n/));
  };
  for (const diagnostic of diagnostics) visit(diagnostic);
  const safeLines = lines
    .map(line => line
      .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, 'postgresql://***')
      .replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer ***')
      .replace(/(https?:\/\/)[^/@\s:]+:[^/@\s]+@/gi, '$1***@')
      .replace(/\b([A-Z0-9_]*(?:TOKEN|PASSWORD|SECRET|DATABASE_URL)[A-Z0-9_]*=)[^\s]+/gi, '$1***'))
    .filter(line => /dockerfile|error|failed|not found|npm ERR|npm error|no such file/i.test(line))
    .slice(-8)
    .map(line => line.slice(0, 240));
  return safeLines.length ? safeLines.join(' | ') : '(no safe error lines returned)';
}

export function isTerminalCoolifyAppStatus(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized.startsWith('exited:') || ['exited', 'stopped', 'failed', 'failure', 'error', 'crashed'].includes(normalized);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const token = process.env.OCI_COOLIFY_TOKEN;
  const baseUrl = (process.env.COOLIFY_URL || 'https://deploy.mkety.com').replace(/\/+$/, '');
  const configuredDatabaseUrl = process.env.MKLMS_DATABASE_URL;
  const configuredDatabaseSsl = process.env.MKLMS_DATABASE_SSL;
  const branch = process.env.MKLMS_COOLIFY_GIT_BRANCH;
  const sha = process.env.MKLMS_COOLIFY_GIT_SHA;
  const runId = process.env.GITHUB_RUN_ID || 'local';
  const outputPath = process.env.MKLMS_SCHEMA_AUDIT_OUTPUT || 'schema-audit-output/postgres-source.json';
  if (!token) throw new Error('Missing OCI_COOLIFY_TOKEN.');
  if (!configuredDatabaseUrl) throw new Error('Missing MKLMS_DATABASE_URL.');
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
    if (!response.ok) {
      const error = new Error(`Coolify API ${method} ${path} failed with HTTP ${response.status}.`);
      error.httpStatus = response.status;
      throw error;
    }
    if (!text) return {};
    try { return JSON.parse(text); } catch { throw new Error(`Coolify API ${method} ${path} returned invalid JSON.`); }
  };

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const readAppLogs = async () => {
    let lastStatus;
    for (const query of ['?lines=1000&show_timestamps=false', '?lines=100', '']) {
      try {
        const response = await request(`/applications/${appUuid}/logs${query}`, { timeoutMs: 5_000 });
        if (typeof response.logs === 'string') return { logs: response.logs, issue: null };
        lastStatus = 'invalid_response';
      } catch (error) { lastStatus = error?.httpStatus || 'unavailable'; }
    }
    return { logs: '', issue: lastStatus };
  };
  const health = await fetch(`${baseUrl}/api/v1/health`, { signal: AbortSignal.timeout(15_000) });
  if (!health.ok) throw new Error(`Coolify health check failed with HTTP ${health.status}.`);
  // This is the Supabase source URL. Do not replace its host with Coolify's
  // central PostgreSQL URL, which could identify a different empty database.
  const safeUrl = validateReadOnlyAuditSourceUrl(configuredDatabaseUrl, configuredDatabaseSsl);
  process.stdout.write(`::add-mask::${safeUrl}\n`);

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

    await request(`/applications/${appUuid}/envs`, {
      method: 'POST',
      body: {
        key: 'MKLMS_SCHEMA_AUDIT_DATABASE_SSL', value: configuredDatabaseSsl || new URL(safeUrl).searchParams.get('sslmode'),
        is_preview: false, is_literal: true, is_multiline: false, is_shown_once: true,
      },
    });

    const deployed = await request(`/deploy?uuid=${encodeURIComponent(appUuid)}&force=true`, { method: 'POST' });
    const deploymentUuid = Array.isArray(deployed.deployments) ? deployed.deployments[0]?.deployment_uuid : undefined;
    if (!deploymentUuid) throw new Error('Coolify did not return an executor deployment ID.');

    let finished = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const deployment = await request(`/deployments/${encodeURIComponent(deploymentUuid)}`);
      const status = String(deployment.status || '').toLowerCase();
      if (['finished', 'success', 'successful', 'succeeded', 'completed'].includes(status)) { finished = true; break; }
      if (['failed', 'failure', 'error', 'cancelled', 'canceled'].includes(status)) {
        const { logs: appLogs } = await readAppLogs();
        const failureClass = classifyCoolifyFailure(deployment.logs, deployment.message, appLogs);
        process.stderr.write(`Coolify executor build diagnostics: ${safeCoolifyDiagnostic(deployment.logs, deployment.message, appLogs)}\n`);
        throw new Error(`Coolify executor build failed (${status}; ${failureClass}).`);
      }
      await delay(5_000);
    }
    if (!finished) throw new Error('Timed out waiting for the Coolify executor build.');

    let catalog;
    let lastStatus = 'unknown';
    let lastLogsIssue;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const app = await request(`/applications/${appUuid}`, { timeoutMs: 10_000 });
      const status = String(app.status || '').toLowerCase();
      lastStatus = status || 'unknown';
      if (isTerminalCoolifyAppStatus(status)) {
        const { logs: appLogs } = await readAppLogs();
        const failureClass = classifyCoolifyFailure(appLogs);
        process.stderr.write(`Coolify executor runtime diagnostics: ${safeCoolifyDiagnostic(appLogs)}\n`);
        throw new Error(`Coolify executor exited before the catalog completed (${status}; ${failureClass}).`);
      }
      const { logs, issue } = await readAppLogs();
      if (issue) lastLogsIssue = issue;
      if (logs.includes('MKLMS_CATALOG_ERROR:')) {
        const errorCode = logs.match(/PostgreSQL catalog export failed \(([A-Z0-9_]+)/)?.[1] ?? 'UNKNOWN';
        const schemaDiagnostic = logs.match(/Could not select one PostgreSQL application schema safely \(\d+ schemas contain tables and no unique MkLMS migration ledger was found; metadata table counts (?:\d+(?:,\d+)*)?; D1 table matches (?:\d+(?:,\d+)*)?\)|Multiple MkLMS migration-ledger schemas (?:contain application tables|were found) \(\d+\)|Multiple PostgreSQL schemas share the strongest MkLMS table signature \(\d+\)/)?.[0];
        const schemaState = schemaDiagnostic ? schemaDiagnostic.replace(/[^A-Za-z0-9 _-]/g, '') : 'other';
        process.stderr.write(`Safe PostgreSQL catalog diagnostic: code=${errorCode}; schema=${schemaState}.\n`);
        throw new Error('Coolify executor reported a PostgreSQL schema metadata export failure.');
      }
      if (logs.includes('MKLMS_CATALOG_END')) {
        catalog = decodeCatalogChunks(logs);
        break;
      }
      await delay(2_000);
    }
    if (!catalog) throw new Error(`Timed out waiting for the read-only PostgreSQL catalog (app_status=${lastStatus}; logs_api=${lastLogsIssue || 'no_output'}).`);
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
