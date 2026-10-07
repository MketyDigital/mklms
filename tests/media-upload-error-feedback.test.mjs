import assert from 'node:assert/strict';
import test from 'node:test';

import { getUploadPreparationMessage } from '../src/features/media/components/upload-errors.ts';

test('preparation errors tell admins when the portal session expired', () => {
  assert.match(getUploadPreparationMessage(401, {}), /session expired/i);
});

test('preparation errors preserve rate-limit and hosting restriction guidance', () => {
  assert.equal(
    getUploadPreparationMessage(429, { message: 'Too many upload requests. Please try again shortly.' }),
    'Too many upload requests. Please try again shortly.',
  );
  assert.equal(
    getUploadPreparationMessage(402, { message: 'Uploads are temporarily restricted.' }),
    'Uploads are temporarily restricted.',
  );
});

test('storage preparation failures include a stable diagnosis and request reference without leaking internals', () => {
  const message = getUploadPreparationMessage(
    503,
    { code: 'UPLOAD_SESSION_FAILED', detailCode: 'AccessDenied', requestId: 'cf-ray-123', message: 'Internal raw storage details' },
  );
  assert.match(message, /Streaming Storage/i);
  assert.match(message, /cf-ray-123/);
  assert.match(message, /AccessDenied/);
  assert.doesNotMatch(message, /Internal raw storage details/);
});

test('network failures explain that preparation did not reach the portal', () => {
  assert.match(getUploadPreparationMessage(0, {}), /connection/i);
});
