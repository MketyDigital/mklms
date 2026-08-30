import test from 'node:test';
import assert from 'node:assert/strict';

import { CertificateVerificationService } from '../src/features/certificates/services/certificate-verification.service.ts';

class Repo {
  constructor(record = null) { this.record = record; }
  async findPublicVerification(certificateId) {
    return certificateId === this.record?.certificateId ? this.record : null;
  }
}

const issued = {
  certificateId: 'CERT-ABC123',
  certificateNameSnapshot: 'Ada Student',
  courseTitle: 'Course One',
  completionDate: '2026-08-30',
  status: 'ISSUED',
  issuedAt: new Date('2026-08-30T12:00:00.000Z'),
  revokedAt: null,
};

test('public verification exposes only safe issued-certificate fields', async () => {
  const service = new CertificateVerificationService(new Repo(issued));
  const result = await service.verify('CERT-ABC123');

  assert.deepEqual(result, {
    state: 'VERIFIED',
    certificateId: 'CERT-ABC123',
    holderName: 'Ada Student',
    courseTitle: 'Course One',
    completionDate: '2026-08-30',
    issuedAt: new Date('2026-08-30T12:00:00.000Z'),
  });
  assert.equal('email' in result, false);
  assert.equal('studentId' in result, false);
});

test('revoked certificate is publicly distinguishable from a valid certificate', async () => {
  const service = new CertificateVerificationService(new Repo({
    ...issued,
    status: 'REVOKED',
    revokedAt: new Date('2026-08-31T12:00:00.000Z'),
  }));

  const result = await service.verify('CERT-ABC123');

  assert.equal(result.state, 'REVOKED');
  assert.equal(result.certificateId, 'CERT-ABC123');
  assert.equal(result.holderName, 'Ada Student');
});

test('unknown certificate returns a neutral not-found state', async () => {
  const service = new CertificateVerificationService(new Repo());
  const result = await service.verify('MISSING');

  assert.deepEqual(result, { state: 'NOT_FOUND' });
});
