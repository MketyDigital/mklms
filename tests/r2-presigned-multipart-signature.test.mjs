import assert from 'node:assert/strict';
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
