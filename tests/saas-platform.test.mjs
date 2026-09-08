import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const platformModulePath = '../scripts/saas-platform.mjs';

test('MkLMS SaaS platform contains only the product routing topology', async () => {
  const platform = JSON.parse(readFileSync('deploy/platforms/mkety-saas.json', 'utf8'));
  assert.deepEqual(platform, {
    schemaVersion: 1,
    kind: 'saas-platform',
    id: 'mkety-saas',
    providerZone: 'mkety.com',
    customerCnameTarget: 'customers.mkety.com',
    routingOrigin: 'origin.mkety.com',
  });
  assert.doesNotMatch(JSON.stringify(platform), /saas-origin\.mkety\.com/i);
});

test('SaaS platform module validates and loads provider-owned topology', async () => {
  const mod = await import(platformModulePath);
  assert.equal(typeof mod.validateSaasPlatform, 'function');
  assert.equal(typeof mod.loadSaasPlatform, 'function');
  const { platform } = await mod.loadSaasPlatform('mkety-saas');
  assert.equal(platform.providerZone, 'mkety.com');
  assert.equal(platform.customerCnameTarget, 'customers.mkety.com');
  assert.equal(platform.routingOrigin, 'origin.mkety.com');
});

test('SaaS platform rejects unrelated fallback-origin topology', async () => {
  const { validateSaasPlatform } = await import(platformModulePath);
  const errors = validateSaasPlatform({
    schemaVersion: 1,
    kind: 'saas-platform',
    id: 'mkety-saas',
    providerZone: 'mkety.com',
    customerCnameTarget: 'customers.mkety.com',
    routingOrigin: 'saas-origin.mkety.com',
  });
  assert.ok(errors.some((error) => /saas-origin\.mkety\.com/i.test(error)));
});

test('Starpips is modeled as an external SaaS custom hostname', () => {
  const manifest = JSON.parse(readFileSync('deploy/installations/starpips.json', 'utf8'));
  assert.equal(manifest.publicDomain, 'learn.starpipsforex.com');
  assert.deepEqual(manifest.domain, {
    mode: 'saas-custom-hostname',
    platformId: 'mkety-saas',
  });
  assert.equal(manifest.dnsZone, undefined);
});

test('Mkety Academy is modeled as a provider-owned hostname', () => {
  const manifest = JSON.parse(readFileSync('deploy/installations/mkety-academy.json', 'utf8'));
  assert.equal(manifest.publicDomain, 'academy.mkety.com');
  assert.deepEqual(manifest.domain, {
    mode: 'provider-domain',
    platformId: 'mkety-saas',
  });
  assert.equal(manifest.dnsZone, undefined);
});
