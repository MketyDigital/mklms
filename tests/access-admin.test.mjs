import test from 'node:test';
import assert from 'node:assert/strict';

import { verifyAccessCode } from '../src/features/access/domain/access-code.ts';
import { AccessAdminService } from '../src/features/access/services/access-admin.service.ts';

class InMemoryAdminRepository {
  constructor() {
    this.credentials = [];
    this.preauthorizations = [];
  }

  async createPreauthorization(input) {
    const existing = this.preauthorizations.find((row) =>
      row.courseId === input.courseId &&
      ((row.email && input.email && row.email === input.email) || (row.phone && input.phone && row.phone === input.phone))
    );
    if (existing) return { record: existing, created: false };
    const row = { id: `pre-${this.preauthorizations.length + 1}`, ...input, status: 'PREAUTHORIZED' };
    this.preauthorizations.push(row);
    return { record: row, created: true };
  }

  async replaceAccessCredential(studentId, credential) {
    this.credentials.push({ studentId, ...credential });
  }

  async setStudentStatus(studentId, status) {
    this.studentStatus = { studentId, status };
  }
}

test('admin can preauthorize a paid student without a payment-provider dependency', async () => {
  const repo = new InMemoryAdminRepository();
  const service = new AccessAdminService(repo, { accessCodePrefix: 'LEARN' });

  const result = await service.preauthorize({
    email: ' PAID@example.com ',
    phone: '+234 803 000 0000',
    courseId: 'course-1',
    claimStrategy: 'preauth-only',
    source: 'manual',
  });

  assert.equal(result.email, 'paid@example.com');
  assert.equal(result.phone, '2348030000000');
  assert.equal(result.status, 'PREAUTHORIZED');
  assert.equal(result.created, true);
});

test('bulk import uses explicitly selected admin course instead of conflicting CSV course', async () => {
  const repo = new InMemoryAdminRepository();
  const service = new AccessAdminService(repo, {
    accessCodePrefix: 'LEARN',
    claimCodePrefix: 'CLAIM',
    validCourseIds: new Set(['course-selected', 'course-csv']),
  });

  const result = await service.bulkPreauthorize({
    mode: 'csv',
    content: 'name,email,course\nAda,ada@example.com,course-csv',
    courseId: 'course-selected',
    claimStrategy: 'claim-code',
  });

  assert.equal(repo.preauthorizations[0].courseId, 'course-selected');
  assert.equal(result.created[0].courseId, 'course-selected');
  assert.equal(result.created[0].name, 'Ada');
  assert.match(result.created[0].claimCode, /^CLAIM-/);
});

test('duplicate bulk rows do not issue a second claim code', async () => {
  const repo = new InMemoryAdminRepository();
  const service = new AccessAdminService(repo, { accessCodePrefix: 'LEARN', claimCodePrefix: 'CLAIM' });
  const result = await service.bulkPreauthorize({
    mode: 'csv',
    content: 'name,email\nAda,ada@example.com\nAda Again,ADA@example.com',
    claimStrategy: 'claim-code',
  });

  assert.equal(result.createdCount, 1);
  assert.equal(result.created.length, 1);
  assert.equal(repo.preauthorizations.length, 1);
});

test('admin reset issues a new access code while persisting only secure credential material', async () => {
  const repo = new InMemoryAdminRepository();
  const service = new AccessAdminService(repo, { accessCodePrefix: 'LEARN' });

  const result = await service.resetStudentAccessCode('student-1');

  assert.match(result.accessCode, /^LEARN-/);
  assert.equal(repo.credentials.length, 1);
  assert.notEqual(repo.credentials[0].hash.hash, result.accessCode);
  assert.equal(verifyAccessCode(result.accessCode, repo.credentials[0].hash), true);
});

test('admin can suspend a student access identity', async () => {
  const repo = new InMemoryAdminRepository();
  const service = new AccessAdminService(repo, { accessCodePrefix: 'LEARN' });

  await service.setStudentStatus('student-1', 'SUSPENDED');
  assert.deepEqual(repo.studentStatus, { studentId: 'student-1', status: 'SUSPENDED' });
});
