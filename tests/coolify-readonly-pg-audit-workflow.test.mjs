import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { classifyCoolifyFailure, decodeCatalogChunks, isTerminalCoolifyAppStatus, safeCoolifyDiagnostic, validateReadOnlyAuditSourceUrl } from '../scripts/coolify-readonly-pg-audit.mjs';

const workflow = readFileSync('.github/workflows/phase1-ci.yml', 'utf8');
const auditJob = (workflow.split('  live-readonly-schema-audit:\n')[1] ?? '').split('\n  provision-empty-d1-targets:\n')[0];
const runner = readFileSync('scripts/run-coolify-pg-catalog-audit.mjs', 'utf8');
const coolify = readFileSync('scripts/coolify-readonly-pg-audit.mjs', 'utf8');
const container = readFileSync('ops/coolify-readonly-audit/run.sh', 'utf8');
const dockerfile = readFileSync('ops/coolify-readonly-audit/Dockerfile', 'utf8');
const auditPackage = JSON.parse(readFileSync('ops/coolify-readonly-audit/package.json', 'utf8'));
const pgExporter = readFileSync('scripts/export-postgres-schema-catalog.mjs', 'utf8');

test('Coolify fallback is limited to the same-repository migration PR and uses the supplied token', () => {
  assert.match(auditJob, /github\.event\.pull_request\.number == 149/);
  assert.match(auditJob, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(auditJob, /OCI_COOLIFY_TOKEN/);
  assert.match(auditJob, /https:\/\/deploy\.mkety\.com/);
  assert.match(auditJob, /steps\.postgres-catalog\.outcome == 'failure'/);
  assert.match(auditJob, /MKLMS_COOLIFY_GIT_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
});

test('Coolify executor is pinned, private, ephemeral, and always cleaned up', () => {
  assert.match(coolify, /git_commit_sha:\s*sha/);
  assert.match(coolify, /connect_to_docker_network:\s*true/);
  assert.match(coolify, /autogenerate_domain:\s*false/);
  assert.match(coolify, /instant_deploy:\s*false/);
  assert.match(coolify, /method:\s*'DELETE'/);
  assert.match(coolify, /finally\s*\{/);
  assert.match(coolify, /readAppLogs/);
  assert.match(coolify, /\?lines=100/);
  assert.doesNotMatch(dockerfile, /package-lock\.json/);
  assert.equal(auditPackage.dependencies.pg, '8.16.3');
  assert.match(auditJob, /if:\s*always\(\)/);
});

test('executor reads the exact configured production source without logging the connection URL', () => {
  assert.match(auditJob, /MKLMS_PG_STAGING_DATABASE_URL/);
  assert.match(coolify, /validateReadOnlyAuditSourceUrl\(configuredDatabaseUrl\)/);
  assert.match(coolify, /Do not replace its host with Coolify's/);
  assert.doesNotMatch(coolify, /internal_db_url/);
  assert.doesNotMatch(coolify, /MKLMS_SCHEMA_AUDIT_PG_CA_FILE/);
  assert.match(auditJob, /MKLMS_SCHEMA_AUDIT_DATABASE_URL/);
  assert.match(dockerfile, /export-postgres-schema-catalog\.mjs/);
  assert.match(dockerfile, /postgres-schema-catalog-selection\.mjs/);
  assert.match(runner, /gzipSync/);
  assert.match(runner, /MKLMS_CATALOG_CHUNK/);
  assert.match(container, /MKLMS_SCHEMA_AUDIT_DATABASE_URL/);
  assert.match(container, /MKLMS_CATALOG_ERROR/);
  assert.match(container, /run-coolify-pg-catalog-audit\.mjs 2>&1/);
  assert.match(coolify, /Coolify executor reported a PostgreSQL schema metadata export failure/);
  assert.match(coolify, /Safe PostgreSQL catalog diagnostic/);
  assert.match(coolify, /schemas contain tables and no unique MkLMS migration ledger was found/);
  assert.match(pgExporter, /process\.stdout\.write\(`PostgreSQL catalog export failed/);
  assert.match(pgExporter, /default_transaction_read_only=on/);
  assert.match(pgExporter, /BEGIN READ ONLY/);
  assert.match(pgExporter, /options: '-c default_transaction_read_only=on'/);
  assert.match(pgExporter, /information_schema/);
  assert.doesNotMatch(container, /(?:INSERT|UPDATE|DELETE|DROP|ALTER)\s+(?:INTO|FROM|TABLE|DATABASE)/i);
});

test('production source URL is preserved and requires verified TLS', () => {
  const source = 'postgresql://mklms_user:source-secret@source.example/mklms?sslmode=require';
  assert.equal(validateReadOnlyAuditSourceUrl(source), source);
  assert.throws(() => validateReadOnlyAuditSourceUrl('postgresql://user:secret@source.example/mklms'), /verified TLS/);
  assert.throws(() => validateReadOnlyAuditSourceUrl('postgresql://user:secret@source.example/mklms?sslmode=disable'), /verified TLS/);
});

test('Coolify log transport reconstructs only a complete compressed schema catalog', () => {
  const catalog = { tables: [], columns: [], indexes: [], foreignKeys: [], checks: [], triggers: [], unsupported: [] };
  const encoded = gzipSync(Buffer.from(JSON.stringify(catalog))).toString('base64');
  const chunks = encoded.match(/.{1,11}/g);
  const logs = chunks.map((chunk, index) => `MKLMS_CATALOG_CHUNK:${index + 1}/${chunks.length}:${chunk}`).join('\n');
  assert.deepEqual(decodeCatalogChunks(logs), catalog);
  assert.throws(() => decodeCatalogChunks(logs.split('\n').slice(0, -1).join('\n')), /complete PostgreSQL catalog/);
});

test('Coolify deployment failures are reduced to a safe diagnostic class', () => {
  assert.equal(classifyCoolifyFailure('fatal: repository not found'), 'source_checkout');
  assert.equal(classifyCoolifyFailure('failed to read dockerfile'), 'dockerfile');
  assert.equal(classifyCoolifyFailure('getaddrinfo EAI_AGAIN'), 'network');
  assert.equal(classifyCoolifyFailure('private value should never be printed'), 'unclassified');
});

test('Coolify executor exits for all terminal application status forms', () => {
  for (const status of ['exited', 'exited:1', 'stopped', 'failed', 'crashed']) assert.equal(isTerminalCoolifyAppStatus(status), true);
  for (const status of ['running', 'running:healthy', 'running:unknown', 'starting']) assert.equal(isTerminalCoolifyAppStatus(status), false);
});

test('Coolify build diagnostics retain error context while masking credentials', () => {
  const diagnostic = safeCoolifyDiagnostic('failed to read dockerfile: postgresql://dbuser:dbpass@pg.internal/mklms Bearer abc123 SECRET_KEY=hidden');
  assert.match(diagnostic, /failed to read dockerfile/);
  assert.doesNotMatch(diagnostic, /dbuser|dbpass|abc123|hidden/);
  assert.match(diagnostic, /postgresql:\/\/\*\*\*/);
  assert.match(diagnostic, /Bearer \*\*\*/);
  const encoded = safeCoolifyDiagnostic(JSON.stringify([{ output: `BuildKit ${'ordinary output '.repeat(60)}` }, { output: 'failed to read dockerfile: path not found' }, { output: 'postgresql://user:secret@db/mklms' }]));
  assert.match(encoded, /path not found/);
  assert.doesNotMatch(encoded, /user:secret/);
});
