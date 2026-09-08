import test from 'node:test';
import assert from 'node:assert/strict';

const modulePath = '../scripts/cloudflare-saas-domain.mjs';
const manifest = {
  id: 'customer-a',
  appWorker: 'mklms-customer-a',
  publicDomain: 'learn.customer.example',
  domain: { mode: 'saas-custom-hostname', platformId: 'mkety-saas' },
};
const platform = {
  id: 'mkety-saas',
  providerZone: 'mkety.com',
  customerCnameTarget: 'customers.mkety.com',
  routingOrigin: 'origin.mkety.com',
};

test('absent SaaS hostname and route produce create actions plus customer CNAME instruction', async () => {
  const { resolveSaasDomainPlan } = await import(modulePath);
  const plan = resolveSaasDomainPlan({ manifest, platform, customHostnames: [], workerRoutes: [] });
  assert.equal(plan.createCustomHostname, true);
  assert.equal(plan.createWorkerRoute, true);
  assert.equal(plan.routePattern, 'learn.customer.example/*');
  assert.equal(plan.cnameInstruction, 'CNAME learn.customer.example -> customers.mkety.com');
});

test('matching existing hostname and Worker route are idempotently reused', async () => {
  const { resolveSaasDomainPlan } = await import(modulePath);
  const plan = resolveSaasDomainPlan({
    manifest,
    platform,
    customHostnames: [{ id: 'host-1', hostname: manifest.publicDomain, status: 'active' }],
    workerRoutes: [{ id: 'route-1', pattern: `${manifest.publicDomain}/*`, script: manifest.appWorker }],
  });
  assert.equal(plan.createCustomHostname, false);
  assert.equal(plan.createWorkerRoute, false);
  assert.equal(plan.customHostnameId, 'host-1');
  assert.equal(plan.workerRouteId, 'route-1');
});

test('conflicting Worker route fails closed', async () => {
  const { resolveSaasDomainPlan } = await import(modulePath);
  assert.throws(() => resolveSaasDomainPlan({
    manifest,
    platform,
    customHostnames: [{ id: 'host-1', hostname: manifest.publicDomain }],
    workerRoutes: [{ id: 'route-1', pattern: `${manifest.publicDomain}/*`, script: 'other-worker' }],
  }), /another Worker|conflict/i);
});

test('duplicate matching custom hostnames fail closed instead of guessing ownership', async () => {
  const { resolveSaasDomainPlan } = await import(modulePath);
  assert.throws(() => resolveSaasDomainPlan({
    manifest,
    platform,
    customHostnames: [{ id: 'a', hostname: manifest.publicDomain }, { id: 'b', hostname: manifest.publicDomain }],
    workerRoutes: [],
  }), /custom hostname|multiple|duplicate/i);
});
