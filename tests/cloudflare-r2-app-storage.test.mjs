import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { CloudflareR2StorageProvider } from '../src/providers/cloudflare-r2-storage-provider.ts';

class FakeBucket {
  constructor() { this.objects = new Map(); }
  async put(key, bytes, options) {
    this.objects.set(key, { bytes: new Uint8Array(bytes), httpMetadata: options?.httpMetadata ?? {} });
  }
  async get(key) {
    const item = this.objects.get(key);
    if (!item) return null;
    return {
      body: new Response(item.bytes).body,
      httpMetadata: item.httpMetadata,
    };
  }
  async delete(key) { this.objects.delete(key); }
}

test('Cloudflare R2 provider stores, reads and deletes private application objects through a binding', async () => {
  const bucket = new FakeBucket();
  const provider = new CloudflareR2StorageProvider(bucket);
  const stored = await provider.putObject({
    key: 'certificates/student-1/cert.pdf',
    bytes: new Uint8Array([1, 2, 3]),
    contentType: 'application/pdf',
    visibility: 'private',
  });
  assert.equal(stored.assetId, 'certificates/student-1/cert.pdf');
  assert.equal(bucket.objects.get(stored.assetId).httpMetadata.cacheControl, 'private, no-store');
  const read = await provider.getObject(stored.assetId);
  assert.deepEqual([...read.bytes], [1, 2, 3]);
  assert.equal(read.contentType, 'application/pdf');
  await provider.deleteObject(stored.assetId);
  assert.equal(bucket.objects.has(stored.assetId), false);
});

test('main Cloudflare Worker binds APP_STORAGE_BUCKET to spf-media', () => {
  const wrangler = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));
  const binding = wrangler.r2_buckets?.find((item) => item.binding === 'APP_STORAGE_BUCKET');
  assert.deepEqual(binding, { binding: 'APP_STORAGE_BUCKET', bucket_name: 'spf-media' });
});

test('portable storage factory keeps S3 credential fallback for non-Cloudflare hosts', () => {
  const source = fs.readFileSync('src/providers/s3-compatible-storage-provider.ts', 'utf8');
  assert.match(source, /APP_STORAGE_BUCKET/);
  assert.match(source, /MKLMS_STORAGE_ACCESS_KEY_ID/);
  assert.match(source, /MKLMS_STORAGE_SECRET_ACCESS_KEY/);
  assert.match(source, /CloudflareR2StorageProvider/);
});
