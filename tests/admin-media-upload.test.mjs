import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { CloudflareR2StorageProvider } from '../src/providers/cloudflare-r2-storage-provider.ts';
import {
  createMediaUploadKey,
  validateAdminMediaUpload,
} from '../src/features/media/domain/admin-media-upload.ts';

class FakeMultipartUpload {
  constructor(bucket, key, uploadId) {
    this.bucket = bucket;
    this.key = key;
    this.uploadId = uploadId;
  }
  async uploadPart(partNumber, bytes) {
    const etag = `etag-${partNumber}`;
    this.bucket.parts.set(partNumber, { bytes: new Uint8Array(bytes), etag });
    return { partNumber, etag };
  }
  async complete(parts) {
    this.bucket.completed = { key: this.key, uploadId: this.uploadId, parts };
    return { key: this.key };
  }
  async abort() {
    this.bucket.aborted = { key: this.key, uploadId: this.uploadId };
  }
}

class FakeBucket {
  constructor() {
    this.parts = new Map();
    this.uploadId = 'upload-123';
    this.completed = null;
    this.aborted = null;
  }
  async put() {}
  async get() { return null; }
  async delete() {}
  async createMultipartUpload(key) {
    return new FakeMultipartUpload(this, key, this.uploadId);
  }
  resumeMultipartUpload(key, uploadId) {
    return new FakeMultipartUpload(this, key, uploadId);
  }
}

test('admin media upload validation accepts private MP4-sized inputs and rejects other files', () => {
  assert.deepEqual(
    validateAdminMediaUpload({ filename: 'Day 1.mp4', contentType: 'video/mp4', sizeBytes: 250 * 1024 * 1024 }),
    { filename: 'Day 1.mp4', contentType: 'video/mp4', sizeBytes: 250 * 1024 * 1024 },
  );
  assert.throws(
    () => validateAdminMediaUpload({ filename: 'notes.pdf', contentType: 'application/pdf', sizeBytes: 1024 }),
    /MP4/i,
  );
  assert.throws(
    () => validateAdminMediaUpload({ filename: 'empty.mp4', contentType: 'video/mp4', sizeBytes: 0 }),
    /empty|size/i,
  );
});

test('server-generated media upload key owns the media/uploads prefix and sanitizes filename', () => {
  const key = createMediaUploadKey(
    '../../My Lesson 01!!.mp4',
    new Date('2026-08-31T12:00:00Z'),
    '123e4567-e89b-12d3-a456-426614174000',
  );
  assert.equal(
    key,
    'media/uploads/2026/08/123e4567-e89b-12d3-a456-426614174000-my-lesson-01.mp4',
  );
  assert.equal(key.includes('..'), false);
});

test('Cloudflare R2 provider supports create, part upload, complete and abort multipart operations', async () => {
  const bucket = new FakeBucket();
  const provider = new CloudflareR2StorageProvider(bucket);

  const created = await provider.createMultipartUpload({
    key: 'media/uploads/2026/08/video.mp4',
    contentType: 'video/mp4',
    visibility: 'private',
  });
  assert.deepEqual(created, { key: 'media/uploads/2026/08/video.mp4', uploadId: 'upload-123' });

  const uploaded = await provider.uploadPart({
    key: created.key,
    uploadId: created.uploadId,
    partNumber: 1,
    bytes: new Uint8Array([1, 2, 3]),
  });
  assert.deepEqual(uploaded, { partNumber: 1, etag: 'etag-1' });

  await provider.completeMultipartUpload({
    key: created.key,
    uploadId: created.uploadId,
    parts: [uploaded],
  });
  assert.deepEqual(bucket.completed.parts, [uploaded]);

  await provider.abortMultipartUpload({ key: created.key, uploadId: created.uploadId });
  assert.deepEqual(bucket.aborted, { key: created.key, uploadId: created.uploadId });
});

test('non-Cloudflare storage fallback implements S3 multipart commands', () => {
  const source = fs.readFileSync('src/providers/s3-compatible-storage-provider.ts', 'utf8');
  assert.match(source, /CreateMultipartUploadCommand/);
  assert.match(source, /UploadPartCommand/);
  assert.match(source, /CompleteMultipartUploadCommand/);
  assert.match(source, /AbortMultipartUploadCommand/);
  assert.match(source, /MultipartStorageProvider/);
});

test('admin upload API is admin-only, multipart, and registers completed media as DIRECT storage', () => {
  const route = fs.readFileSync('src/app/api/admin/media/upload/route.ts', 'utf8');
  assert.match(route, /hasValidAdminSession/);
  assert.match(route, /createMultipartUpload/);
  assert.match(route, /uploadPart/);
  assert.match(route, /completeMultipartUpload/);
  assert.match(route, /abortMultipartUpload/);
  assert.match(route, /provider:\s*["']storage["']/);
  assert.match(route, /sourceType:\s*["']DIRECT["']/);
  assert.match(route, /status:\s*["']READY["']/);
  assert.match(route, /deleteObject/);
});

test('admin media page contract replaces OCI ingest panel with storage upload UI while preserving manual registration', () => {
  const page = fs.readFileSync('src/app/(admin)/admin/media/page.tsx', 'utf8');
  assert.match(page, /AdminMediaUpload/);
  assert.doesNotMatch(page, /MediaIngestPanel/);
  assert.doesNotMatch(page, /OCI Media Flow/);
  assert.match(page, /AdminMediaManager/);
});
