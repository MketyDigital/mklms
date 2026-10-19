import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureCloudflareD1Databases, REQUIRED_D1_DATABASES } from '../scripts/ensure-cloudflare-d1-databases.mjs';

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('only creates the two allowlisted installation databases and returns their IDs', async () => {
  const calls = [];
  const result = await ensureCloudflareD1Databases({
    accountId: 'account',
    apiToken: 'token',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (options.method === 'POST') {
        const { name } = JSON.parse(options.body);
        return response({ success: true, result: { name, uuid: `uuid-${name}` } });
      }
      return response({ success: true, result: [], result_info: { total_pages: 1 } });
    },
  });

  assert.deepEqual(result.databases, REQUIRED_D1_DATABASES.map((name) => ({ name, uuid: `uuid-${name}`, action: 'created' })));
  assert.equal(calls.filter(({ options }) => options.method === 'POST').length, 2);
  assert.deepEqual(calls.filter(({ options }) => options.method === 'POST').map(({ options }) => JSON.parse(options.body).name), REQUIRED_D1_DATABASES);
  assert.ok(calls.every(({ options }) => options.headers.Authorization === 'Bearer token'));
});

test('reuses exact existing names and does not create duplicates', async () => {
  const calls = [];
  const result = await ensureCloudflareD1Databases({
    accountId: 'account',
    apiToken: 'token',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return response({
        success: true,
        result: REQUIRED_D1_DATABASES.map((name) => ({ name, uuid: `existing-${name}` })),
        result_info: { total_pages: 1 },
      });
    },
  });

  assert.deepEqual(result.databases.map(({ action }) => action), ['reused', 'reused']);
  assert.equal(calls.filter(({ options }) => options.method === 'POST').length, 0);
});

test('rejects normalized lookalikes instead of provisioning a duplicate', async () => {
  await assert.rejects(() => ensureCloudflareD1Databases({
    accountId: 'account',
    apiToken: 'token',
    fetchImpl: async () => response({
      success: true,
      result: [{ name: 'mklms_starpips', uuid: 'unexpected' }],
      result_info: { total_pages: 1 },
    }),
  }), /ambiguous existing D1 database name/);
});

test('fails closed when Cloudflare returns an unsuccessful response', async () => {
  await assert.rejects(() => ensureCloudflareD1Databases({
    accountId: 'account',
    apiToken: 'token',
    fetchImpl: async () => response({ success: false, errors: [{ message: 'denied' }] }, 403),
  }), /Cloudflare D1 API request failed with status 403/);
});
