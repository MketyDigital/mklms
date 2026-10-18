import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { classifyCoolifyFailure, decodeCatalogChunks, resolveMatchingDatabaseUrl, safeCoolifyDiagnostic } from '../scripts/coolify-readonly-pg-audit.mjs';

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

test('executor obtains only the matching managed database catalog and suppresses the connection URL', () => {
  assert.match(coolify, /internal_db_url/);
  assert.match(auditJob, /MKLMS_PG_STAGING_DATABASE_URL/);
  assert.match(coolify, /resolveMatchingDatabaseUrl/);
  assert.match(coolify, /configured MkLMS database and user/);
  assert.match(auditJob, /MKLMS_SCHEMA_AUDIT_DATABASE_URL/);
  assert.match(dockerfile, /export-postgres-schema-catalog\.mjs/);
  assert.match(runner, /gzipSync/);
  assert.match(runner, /MKLMS_CATALOG_CHUNK/);
  assert.match(container, /MKLMS_SCHEMA_AUDIT_DATABASE_URL/);
  assert.match(pgExporter, /default_transaction_read_only=on/);
  assert.match(pgExporter, /BEGIN READ ONLY/);
  assert.match(pgExporter, /information_schema/);
  assert.doesNotMatch(container, /(?:INSERT|UPDATE|DELETE|DROP|ALTER)\s+(?:INTO|FROM|TABLE|DATABASE)/i);
});

test('Coolify URL selection requires the same database and user without exposing the configured URL', () => {
  const internal = 'postgresql://mklms_user:internal-secret@postgres:5432/mklms?sslmode=require';
  assert.equal(resolveMatchingDatabaseUrl('postgresql://mklms_user:external-secret@db.example/mklms', internal), internal);
  assert.throws(() => resolveMatchingDatabaseUrl('postgresql://other:mklms-secret@db.example/mklms', internal), /database and user/);
  assert.throws(() => resolveMatchingDatabaseUrl('not-a-url-with-mklms-secret', internal), /URL is invalid/);
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
