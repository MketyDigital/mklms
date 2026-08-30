import test from 'node:test';
import assert from 'node:assert/strict';

import { CertificateIssuanceService } from '../src/features/certificates/services/certificate-issuance.service.ts';

class InMemoryCertificateRepository {
  constructor({ enrollmentStatus = 'COMPLETED' } = {}) {
    this.enrollment = {
      studentId: 'student-1',
      courseId: 'course-1',
      status: enrollmentStatus,
      completedAt: new Date('2026-08-30T10:00:00.000Z'),
    };
    this.identity = {
      studentId: 'student-1',
      certificateName: 'Ada Example',
      certificateEmail: 'ada@example.com',
      lockedAt: new Date('2026-08-01T10:00:00.000Z'),
    };
    this.certificates = [];
  }

  async findByStudentCourse(studentId, courseId) {
    return this.certificates.find(
      (certificate) => certificate.studentId === studentId && certificate.courseId === courseId,
    ) ?? null;
  }

  async getEnrollment(studentId, courseId) {
    return studentId === 'student-1' && courseId === 'course-1' ? this.enrollment : null;
  }

  async getCertificateIdentity(studentId) {
    return studentId === 'student-1' ? this.identity : null;
  }

  async createCertificate(input) {
    const certificate = {
      id: `certificate-${this.certificates.length + 1}`,
      status: 'ISSUED',
      revokedAt: null,
      ...input,
    };
    this.certificates.push(certificate);
    return certificate;
  }
}

test('completed enrollment issues one certificate using the locked certificate identity', async () => {
  const repository = new InMemoryCertificateRepository();
  const service = new CertificateIssuanceService(repository, {
    certificatePrefix: 'ACADEMY',
  });

  const result = await service.issueForCompletedEnrollment('student-1', 'course-1');

  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.match(result.certificate.certificateId, /^ACADEMY-[A-Z0-9]{12}$/);
  assert.equal(result.certificate.certificateNameSnapshot, 'Ada Example');
  assert.equal(result.certificate.completionDate, '2026-08-30');
  assert.equal(repository.certificates.length, 1);
});

test('automatic issuance is idempotent for the same student and course', async () => {
  const repository = new InMemoryCertificateRepository();
  const service = new CertificateIssuanceService(repository, {
    certificatePrefix: 'CERT',
  });

  const first = await service.issueForCompletedEnrollment('student-1', 'course-1');
  const second = await service.issueForCompletedEnrollment('student-1', 'course-1');

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.created, false);
  assert.equal(second.certificate.id, first.certificate.id);
  assert.equal(repository.certificates.length, 1);
});

test('certificate is not issued before enrollment completion', async () => {
  const repository = new InMemoryCertificateRepository({ enrollmentStatus: 'ACTIVE' });
  const service = new CertificateIssuanceService(repository, {
    certificatePrefix: 'CERT',
  });

  const result = await service.issueForCompletedEnrollment('student-1', 'course-1');

  assert.deepEqual(result, { ok: false, reason: 'COURSE_NOT_COMPLETED' });
  assert.equal(repository.certificates.length, 0);
});

test('certificate is not issued without a locked certificate identity', async () => {
  const repository = new InMemoryCertificateRepository();
  repository.identity.lockedAt = null;
  const service = new CertificateIssuanceService(repository, {
    certificatePrefix: 'CERT',
  });

  const result = await service.issueForCompletedEnrollment('student-1', 'course-1');

  assert.deepEqual(result, { ok: false, reason: 'CERTIFICATE_IDENTITY_NOT_LOCKED' });
  assert.equal(repository.certificates.length, 0);
});
