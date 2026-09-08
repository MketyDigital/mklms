import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/configure-installation-domain.yml';

test('SaaS domain onboarding is manual, installation-driven and confirmation-gated', () => {
  const source = readFileSync(workflowPath, 'utf8');
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /installation_id:/);
  assert.match(source, /confirmation:/);
  assert.match(source, /CONFIGURE/);
  assert.match(source, /loadConcreteInstallation/);
  assert.match(source, /loadSaasPlatform/);
});

test('SaaS onboarding reads existing hostname and routes before any writes and prints customer CNAME', () => {
  const source = readFileSync(workflowPath, 'utf8');
  assert.match(source, /custom_hostnames\?hostname|custom_hostnames/);
  assert.match(source, /workers\/routes/);
  assert.match(source, /resolveSaasDomainPlan/);
  assert.match(source, /customerCnameTarget|CNAME/);
  assert.match(source, /--request POST/);
  assert.match(source, /ssl.*method.*txt|method.*txt/si);
});

test('SaaS onboarding never manages customer DNS zones or unrelated fallback origin', () => {
  const source = readFileSync(workflowPath, 'utf8');
  assert.doesNotMatch(source, /saas-origin\.mkety\.com/);
  assert.doesNotMatch(source, /dnsZone|DNS_ZONE/);
  assert.doesNotMatch(source, /dns_records.*PUBLIC_DOMAIN|zones\?name=\$PUBLIC_DOMAIN/);
  assert.doesNotMatch(source, /--request DELETE|--request PATCH/);
});

test('SaaS onboarding verifies final idempotent state after writes', () => {
  const source = readFileSync(workflowPath, 'utf8');
  const occurrences = source.match(/resolveSaasDomainPlan/g) ?? [];
  assert.ok(occurrences.length >= 2, 'expected domain plan before and after writes');
  assert.match(source, /createCustomHostname.*false|createWorkerRoute.*false/si);
});
