import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { S3Client, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

test('R2 multipart presigned UploadPart omits unsupported flexible-checksum parameters', async () => {
  const client = new S3Client({
    region: 'auto',
    endpoint: 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: 'example-access-key',
      secretAccessKey: 'example-secret-key',
    },
  });

  const signed = await getSignedUrl(
    client,
    new UploadPartCommand({
      Bucket: 'spf-media',
      Key: 'media/00000000-0000-4000-8000-000000000000.mp4',
      UploadId: 'example-upload-id',
      PartNumber: 1,
    }),
    { expiresIn: 1800 },
  );

  const url = new URL(signed);
  assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
  assert.equal(url.searchParams.get('X-Amz-Credential')?.includes('/auto/s3/aws4_request'), true);
  assert.equal(url.searchParams.get('X-Amz-Content-Sha256'), 'UNSIGNED-PAYLOAD');
  assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'host');
  assert.equal(url.searchParams.has('x-amz-sdk-checksum-algorithm'), false);
  assert.equal(url.searchParams.has('x-amz-checksum-crc32'), false);
  assert.equal(url.searchParams.has('x-amz-checksum-crc32c'), false);
  assert.equal(url.searchParams.has('x-amz-checksum-sha1'), false);
  assert.equal(url.searchParams.has('x-amz-checksum-sha256'), false);
});

test('R2 checksum compatibility covers multipart operations while preserving direct PutObject signing', () => {
  const helper = fs.readFileSync('src/features/media/server/r2-direct-upload.ts', 'utf8');
  const directStart = helper.indexOf('export async function createDirectR2UploadAuthorization');
  const partStart = helper.indexOf('export async function createDirectR2MultipartPartAuthorization');
  const completeStart = helper.indexOf('export async function completeDirectR2MultipartUpload');
  const abortStart = helper.indexOf('export async function abortDirectR2MultipartUpload');
  const verifyStart = helper.indexOf('export async function verifyDirectR2Object');
  assert.ok(directStart >= 0 && partStart > directStart && completeStart > partStart && abortStart > completeStart && verifyStart > abortStart);

  const initiate = helper.slice(directStart, partStart);
  const partSigning = helper.slice(partStart, completeStart);
  const completion = helper.slice(completeStart, abortStart);
  const abort = helper.slice(abortStart, verifyStart);
  assert.match(helper, /function getClient\\(\\s*config: DirectR2Config,\\s*options\\?: \\{ multipartUploadPart\\?: boolean \\},?\\s*\\): S3Client/);
  assert.match(helper, /options\\?\\.multipartUploadPart[\\s\\S]*requestChecksumCalculation: "WHEN_REQUIRED"/);
  assert.match(initiate, /getClient\\(config, \\{ multipartUploadPart: true \\}\\)\\.send\\(\\s*new CreateMultipartUploadCommand/);
  assert.match(partSigning, /getClient\\(config, \\{ multipartUploadPart: true \\}\\)/);
  assert.match(completion, /getClient\\(config, \\{ multipartUploadPart: true \\}\\)\\.send\\(\\s*new CompleteMultipartUploadCommand/);
  assert.match(abort, /getClient\\(config, \\{ multipartUploadPart: true \\}\\)\\.send\\(\\s*new AbortMultipartUploadCommand/);
  const singleUpload = initiate.slice(0, initiate.indexOf('const created'));
  assert.match(singleUpload, /getClient\\(config\\)/);
  assert.doesNotMatch(singleUpload, /multipartUploadPart|requestChecksumCalculation|responseChecksumValidation/);
});
