import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCertificateSnapshot,
  generateCertificateId,
  isCertificateActive,
} from '../src/features/certificates/domain/certificate.ts';

test('certificate IDs use the configured reusable prefix without hardcoded customer identity', () => {
  const certificateId = generateCertificateId('ACADEMY');

  assert.match(certificateId, /^ACADEMY-[A-Z0-9]{12}$/);
  assert.equal(certificateId.includes('STAR'), false);
});

test('certificate identity is snapshotted from the locked claim-time identity', () => {
  const snapshot = createCertificateSnapshot({
    studentId: 'student-1',
    courseId: 'course-1',
    certificateName: 'Ada Example',
    completionDate: new Date('2026-08-30T10:00:00.000Z'),
  });

  assert.deepEqual(snapshot, {
    studentId: 'student-1',
    courseId: 'course-1',
    certificateNameSnapshot: 'Ada Example',
    completionDate: '2026-08-30',
  });
});

test('active certificate state excludes revoked certificates', () => {
  assert.equal(isCertificateActive({ status: 'ISSUED', revokedAt: null }), true);
  assert.equal(isCertificateActive({ status: 'REVOKED', revokedAt: new Date() }), false);
});
