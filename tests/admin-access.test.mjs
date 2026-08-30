import test from 'node:test';
import assert from 'node:assert/strict';

import { AdminAccessService } from '../src/features/access/services/admin-access.service.ts';

class InMemoryAdminAccessRepository {
  constructor() {
    this.preauthorizations = [];
    this.students = [{ id: 'student-1', displayName: 'Ada', status: 'ACTIVE' }];
    this.credentials = [];
  }

  async createPreauthorization(input) {
    const duplicate = this.preauthorizations.find((item) =>
      item.courseId === input.courseId &&
      ((input.email && item.email === input.email) || (input.phone && item.phone === input.phone))
    );
    if (duplicate) return { record: duplicate, created: false };
    const record = { id: String(this.preauthorizations.length + 1), status: 'PREAUTHORIZED', ...input };
    this.preauthorizations.push(record);
    return { record, created: true };
  }

  async listPreauthorizations() { return this.preauthorizations; }
  async listStudents() { return this.students; }
  async replaceAccessCredential(studentId, credential) {
    this.credentials = [{ studentId, ...credential }];
  }
  async setStudentStatus(studentId, status) {
    const student = this.students.find((item) => item.id === studentId);
    if (student) student.status = status;
  }
}

test('bulkAuthorize normalizes and creates valid paid-student preauthorizations', async () => {
  const repo = new InMemoryAdminAccessRepository();
  const service = new AdminAccessService(repo, { accessCodePrefix: 'LEARN' });

  const result = await service.bulkAuthorize({
    mode: 'paste',
    input: ' Student@Example.com\n+234 803 123 4567',
    courseId: 'course-1',
    claimStrategy: 'preauth-only',
    source: 'admin-paste',
  });

  assert.equal(result.created, 2);
  assert.equal(result.skippedDuplicates, 0);
  assert.equal(result.errors.length, 0);
  assert.equal(repo.preauthorizations[0].email, 'student@example.com');
  assert.equal(repo.preauthorizations[1].phone, '2348031234567');
});

test('bulkAuthorize reports already-authorized identities as skipped duplicates', async () => {
  const repo = new InMemoryAdminAccessRepository();
  const service = new AdminAccessService(repo, { accessCodePrefix: 'LEARN' });

  await service.bulkAuthorize({
    mode: 'paste',
    input: 'student@example.com',
    courseId: 'course-1',
    claimStrategy: 'preauth-only',
    source: 'first-import',
  });
  const result = await service.bulkAuthorize({
    mode: 'paste',
    input: 'STUDENT@example.com',
    courseId: 'course-1',
    claimStrategy: 'preauth-only',
    source: 'repeat-import',
  });

  assert.equal(result.created, 0);
  assert.equal(result.skippedDuplicates, 1);
  assert.equal(repo.preauthorizations.length, 1);
});

test('resetAccessCode returns a new code once and stores only hashed credential material', async () => {
  const repo = new InMemoryAdminAccessRepository();
  const service = new AdminAccessService(repo, { accessCodePrefix: 'LEARN' });

  const result = await service.resetAccessCode('student-1');

  assert.match(result.accessCode, /^LEARN-[A-Z0-9]+$/);
  assert.equal(repo.credentials.length, 1);
  assert.notEqual(repo.credentials[0].hash.hash, result.accessCode);
  assert.equal(repo.credentials[0].studentId, 'student-1');
});
