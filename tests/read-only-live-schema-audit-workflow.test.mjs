import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/phase1-ci.yml', 'utf8');
const auditJob = (workflow.split('  live-readonly-schema-audit:\n')[1] ?? '').split('\n  provision-empty-d1-targets:\n')[0];
const pgExporter = readFileSync('scripts/export-postgres-schema-catalog.mjs', 'utf8');

test('live schema audit is scoped to the current same-repository migration PR', () => {
  assert.match(workflow, /live-readonly-schema-audit:\n\s+needs: provision-empty-d1-targets/);
  assert.match(workflow, /github\.event_name == 'pull_request'/);
  assert.match(workflow, /github\.event\.pull_request\.number == 149/);
  assert.match(workflow, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /MKLMS_PG_STAGING_DATABASE_URL/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
});

test('live schema audit exports only catalog metadata and never applies migrations or deploys', () => {
  assert.match(auditJob, /export-postgres-schema-catalog\.mjs/);
  assert.match(auditJob, /cloudflare-d1-schema-catalog\.mjs starpips/);
  assert.match(auditJob, /cloudflare-d1-schema-catalog\.mjs mkety-academy/);
  assert.match(auditJob, /--summary-only --require-complete/);
  assert.match(auditJob, /Require PostgreSQL parity with each live D1 schema/);
  assert.match(auditJob, /GITHUB_STEP_SUMMARY/);
  assert.match(auditJob, /continue-on-error: true/);
  assert.match(auditJob, /if: always\(\)/);
  assert.match(auditJob, /Verify all read-only schema snapshots were captured/);
  assert.match(auditJob, /postgres-production\.json/);
  assert.doesNotMatch(auditJob, /upload-artifact@/);
  assert.doesNotMatch(auditJob, /(?:wrangler\s+deploy|wrangler\s+d1\s+migrations\s+apply|npm\s+run\s+(?:db:migrate|deploy)|\b(?:INSERT|UPDATE|DELETE|DROP|ALTER)\s+(?:INTO|FROM|TABLE|DATABASE))/i);
  assert.doesNotMatch(auditJob, /echo\s+.*\$\{?(?:MKLMS_SCHEMA_AUDIT_DATABASE_URL|CLOUDFLARE_API_TOKEN)/i);
  assert.match(pgExporter, /default_transaction_read_only=on/);
  assert.match(pgExporter, /BEGIN READ ONLY/);
  assert.match(pgExporter, /transaction_read_only/);
  assert.match(pgExporter, /table_name='_mklms_migrations'/);
  assert.match(pgExporter, /schemaRows\.rows\.length !== 1/);
  assert.doesNotMatch(pgExporter, /current_schema\(\)/);
  assert.match(pgExporter, /n\.nspname=\$1/);
  assert.match(pgExporter, /connection details suppressed/);
  assert.doesNotMatch(pgExporter, /console\.(?:error|log)\([^\n]*(?:error\.message|error\.hostname)/);
  assert.doesNotMatch(pgExporter, /SELECT\s+\*|SELECT\s+.+\bFROM\s+(?!information_schema|pg_catalog|pg_|unnest|LATERAL)/i);
});
