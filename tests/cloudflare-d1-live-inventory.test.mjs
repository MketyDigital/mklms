import test from 'node:test';
import assert from 'node:assert/strict';
import { D1_SCHEMA_SQL, fetchCloudflareD1Inventory } from '../scripts/cloudflare-d1-live-inventory.mjs';

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return body; },
});

test('lists D1 databases and reads schema metadata only for the selected installation', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/d1/database?')) return response({
      success: true,
      result: [
        { uuid: 'db-starpips', name: 'mklms-starpips', version: 'production' },
        { uuid: 'db-academy', name: 'mklms-mkety-academy', version: 'production' },
        { uuid: 'db-other', name: 'unrelated-app', version: 'production' },
      ],
      result_info: { page: 1, per_page: 100, total_count: 3 },
    });
    return response({ success: true, result: [{ success: true, results: [
      { type: 'table', name: 'students', tbl_name: 'students', sql: 'CREATE TABLE students (id TEXT PRIMARY KEY)' },
      { type: 'index', name: 'students_name', tbl_name: 'students', sql: 'CREATE INDEX students_name ON students(id)' },
    ] }] });
  };

  const inventory = await fetchCloudflareD1Inventory({
    accountId: 'account-id',
    apiToken: 'private-test-token',
    installationId: 'starpips',
    fetchImpl,
  });

  assert.deepEqual(inventory.databases.map(({ name }) => name), ['mklms-starpips', 'mklms-mkety-academy', 'unrelated-app']);
  assert.deepEqual(inventory.catalogs.map(({ databaseName }) => databaseName), ['mklms-starpips']);
  assert.deepEqual(inventory.catalogs[0].objects.map(({ type, name }) => [type, name]), [
    ['table', 'students'],
    ['index', 'students_name'],
  ]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer private-test-token');
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].options.body), { sql: D1_SCHEMA_SQL });
  assert.doesNotMatch(JSON.stringify(inventory), /private-test-token/);
});

test('paginates the D1 database listing before selecting matching targets', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/query')) return response({
      success: true,
      result: [{ success: true, results: [{ type: 'table', name: 'students', tbl_name: 'students', sql: 'CREATE TABLE students (id TEXT)' }] }],
    });
    const page = Number(new URL(String(url)).searchParams.get('page'));
    return page === 1
      ? response({ success: true, result: [{ uuid: 'db-a', name: 'other' }], result_info: { page: 1, per_page: 100, total_count: 2 } })
      : response({ success: true, result: [{ uuid: 'db-b', name: 'starpips' }], result_info: { page: 2, per_page: 100, total_count: 2 } });
  };
  const inventory = await fetchCloudflareD1Inventory({
    accountId: 'account-id', apiToken: 'token', installationId: 'starpips', fetchImpl,
  });
  assert.equal(calls.length, 3);
  assert.match(calls[1], /page=2/);
  assert.deepEqual(inventory.catalogs.map(({ databaseId }) => databaseId), ['db-b']);
});

test('does not query unrelated D1 databases and validates credentials and installation', async () => {
  let postCount = 0;
  const fetchImpl = async (url, options = {}) => {
    if (options.method === 'POST') postCount++;
    return response({ success: true, result: [{ uuid: 'db-other', name: 'unrelated-app' }], result_info: { total_count: 1 } });
  };
  const inventory = await fetchCloudflareD1Inventory({ accountId: 'a', apiToken: 't', installationId: 'mkety-academy', fetchImpl });
  assert.deepEqual(inventory.catalogs, []);
  assert.equal(postCount, 0);
  await assert.rejects(fetchCloudflareD1Inventory({ accountId: '', apiToken: 't', installationId: 'starpips', fetchImpl }), /Cloudflare account ID and API token are required/);
  await assert.rejects(fetchCloudflareD1Inventory({ accountId: 'a', apiToken: 't', installationId: 'unknown', fetchImpl }), /Unsupported installation/);
});

test('rejects API errors without echoing response content or credentials', async () => {
  const fetchImpl = async () => response({ success: false, errors: [{ message: 'private-test-token rejected' }] }, 403);
  await assert.rejects(
    fetchCloudflareD1Inventory({ accountId: 'a', apiToken: 'private-test-token', installationId: 'starpips', fetchImpl }),
    (error) => error.message.includes('Cloudflare D1 request failed (403)') && !error.message.includes('private-test-token'),
  );
});
