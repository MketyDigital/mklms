import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { parse as parsePostgresConnectionString } from 'pg-connection-string';
import { classifyCoolifyFailure, decodeCatalogChunks, isTerminalCoolifyAppStatus, safeCoolifyDiagnostic, validateReadOnlyAuditSourceUrl } from '../scripts/coolify-readonly-pg-audit.mjs';
import { verifiedPostgresUrl } from '../scripts/verified-postgres-url.mjs';

const workflow = readFileSync('.github/workflows/phase1-ci.yml', 'utf8');
const auditJob = (workflow.split('  live-readonly-schema-audit:\n')[1] ?? '').split('\n  provision-empty-d1-targets:\n')[0];
const runner = readFileSync('scripts/run-coolify-pg-catalog-audit.mjs', 'utf8');
const coolify = readFileSync('scripts/coolify-readonly-pg-audit.mjs', 'utf8');
const container = readFileSync('ops/coolify-readonly-audit/run.sh', 'utf8');
const dockerfile = readFileSync('ops/coolify-readonly-audit/Dockerfile', 'utf8');
const auditPackage = JSON.parse(readFileSync('ops/coolify-readonly-audit/package.json', 'utf8'));
const pgExporter = readFileSync('scripts/export-postgres-schema-catalog.mjs', 'utf8');

test('live audit uses the two explicit schemas on the Starpips PostgreSQL database', () => {
  assert.match(auditJob, /github\.event\.pull_request\.number == 149/);
  assert.match(auditJob, /MKLMS_DATABASE_URL/);
  assert.match(auditJob, /MKLMS_SCHEMA_AUDIT_SCHEMA: mkety_academy/);
  assert.match(auditJob, /MKLMS_SCHEMA_AUDIT_SCHEMA: public/);
  assert.doesNotMatch(auditJob, /OCI_COOLIFY_TOKEN|MKLMS_SUPABASE_SOURCE_DATABASE_URL|MKLMS_SUPABASE_SOURCE_DATABASE_SSL/);
  assert.match(auditJob, /environment: database-migrations/);
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

test('read-only audit schema selection and TLS safeguards remain explicit', () => {
  assert.match(auditJob, /MKLMS_SCHEMA_AUDIT_DATABASE_URL: \$\{\{ secrets\.MKLMS_DATABASE_URL \}\}/);
  assert.match(auditJob, /MKLMS_SCHEMA_AUDIT_DATABASE_SSL: \$\{\{ secrets\.MKLMS_DATABASE_SSL \}\}/);
  assert.match(auditJob, /MKLMS_SCHEMA_AUDIT_ALLOW_UNVERIFIED_TLS: 'true'/);
  assert.match(auditJob, /MKLMS_DATABASE_SSL_CA/);
  assert.match(auditJob, /umask 077[\s\S]*mktemp[\s\S]*MKLMS_SCHEMA_AUDIT_PG_CA_FILE/);
  assert.match(pgExporter, /process\.env\.MKLMS_SCHEMA_AUDIT_SCHEMA/);
  assert.match(pgExporter, /selectPostgresCatalogSchema\(schemaRows\.rows, process\.env\.MKLMS_SCHEMA_AUDIT_SCHEMA\)/);
  assert.match(pgExporter, /default_transaction_read_only=on/);
  assert.match(pgExporter, /BEGIN READ ONLY/);
  assert.match(pgExporter, /rejectUnauthorized:\s*true/);
  assert.match(pgExporter, /allowUnverifiedRequire[\s\S]*poolOptions\.ssl = \{ rejectUnauthorized: false \}/);
  assert.match(pgExporter, /verifiedPostgresUrl\(configuredUrl, process\.env\.MKLMS_SCHEMA_AUDIT_DATABASE_SSL, \{ allowUnverifiedRequire \}\)/);
  assert.match(pgExporter, /information_schema/);
  assert.match(pgExporter, /n\.nspname=\$1/);
  assert.match(pgExporter, /connection details suppressed/);
  assert.doesNotMatch(pgExporter, /console\.(?:error|log)\([^\n]*(?:error\.message|error\.hostname)/);
  assert.doesNotMatch(pgExporter, /SELECT\s+\*|SELECT\s+.+\bFROM\s+(?!information_schema|pg_catalog|pg_|unnest|LATERAL)/i);
});

test('production source URL is preserved and requires verified TLS', () => {
  const source = 'postgresql://mklms_user:source-secret@source.example/mklms?sslmode=require';
  const verified = new URL(validateReadOnlyAuditSourceUrl(source));
  assert.equal(verified.hostname, 'source.example');
  assert.equal(verified.searchParams.get('sslmode'), 'verify-full');
  assert.throws(() => validateReadOnlyAuditSourceUrl('postgresql://user:secret@source.example/mklms'), /verified TLS/);
  assert.throws(() => validateReadOnlyAuditSourceUrl('postgresql://user:secret@source.example/mklms?sslmode=disable'), /verified TLS/);
});

test('source URL adds the separately configured TLS mode without changing its host', () => {
  const source = 'postgresql://mklms_user:source-secret@source.example:5432/mklms?application_name=audit';
  const verified = new URL(verifiedPostgresUrl(source, 'require'));
  assert.equal(verified.hostname, 'source.example');
  assert.equal(verified.port, '5432');
  assert.equal(verified.searchParams.get('sslmode'), 'verify-full');
  const compatible = new URL(verifiedPostgresUrl(source, 'require', { allowUnverifiedRequire: true }));
  assert.equal(compatible.searchParams.get('sslmode'), 'require');
  assert.equal(compatible.searchParams.get('uselibpqcompat'), 'true');
  assert.equal(parsePostgresConnectionString(compatible.toString()).ssl.rejectUnauthorized, false);
  assert.equal(new URL(verifiedPostgresUrl(source, 'verify-full', { allowUnverifiedRequire: true })).searchParams.get('sslmode'), 'verify-full');
  assert.equal(verified.searchParams.get('application_name'), 'audit');
  assert.equal(verifiedPostgresUrl('postgresql://mklms:secret@source.example/mklms?sslmode=verify-full', 'verify-full'), 'postgresql://mklms:secret@source.example/mklms?sslmode=verify-full');
  assert.throws(() => verifiedPostgresUrl(source, undefined), /verified TLS/);
  assert.throws(() => verifiedPostgresUrl(source, 'disable'), /verified TLS/);
  assert.throws(() => verifiedPostgresUrl(`${source}&sslmode=disable`, 'require'), /conflicts/);
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
