import test from 'node:test';
import assert from 'node:assert/strict';

import { AccessAdminService } from '../src/features/access/services/access-admin.service.ts';

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

test('bulkPreauthorize normalizes and creates valid paid-student preauthorizations', async () => {
  const repo = new InMemoryAdminAccessRepository();
  const service = new AccessAdminService(repo, { accessCodePrefix: 'LEARN' });

  const result = await service.bulkPreauthorize({
    mode: 'paste',
    content: ' Student@Example.com\n+234 803 123 4567',
    courseId: 'course-1',
    claimStrategy: 'preauth-only',
    source: 'admin-paste',
  });

  assert.equal(result.createdCount, 2);
  assert.equal(result.skippedDuplicates, 0);
  assert.equal(result.errors.length, 0);
  assert.equal(repo.preauthorizations[0].email, 'student@example.com');
  assert.equal(repo.preauthorizations[1].phone, '2348031234567');
});

test('bulkPreauthorize reports already-authorized identities as skipped duplicates', async () => {
  const repo = new InMemoryAdminAccessRepository();
  const service = new AccessAdminService(repo, { accessCodePrefix: 'LEARN' });

  await service.bulkPreauthorize({
    mode: 'paste',
    content: 'student@example.com',
    courseId: 'course-1',
    claimStrategy: 'preauth-only',
    source: 'first-import',
  });
  const result = await service.bulkPreauthorize({
    mode: 'paste',
    content: 'STUDENT@example.com',
    courseId: 'course-1',
    claimStrategy: 'preauth-only',
    source: 'repeat-import',
  });

  assert.equal(result.createdCount, 0);
  assert.equal(result.skippedDuplicates, 1);
  assert.equal(repo.preauthorizations.length, 1);
});

test('resetStudentAccessCode returns a new code once and stores only hashed credential material', async () => {
  const repo = new InMemoryAdminAccessRepository();
  const service = new AccessAdminService(repo, { accessCodePrefix: 'LEARN' });

  const result = await service.resetStudentAccessCode('student-1');

  assert.match(result.accessCode, /^LEARN-[A-Z0-9]+$/);
  assert.equal(repo.credentials.length, 1);
  assert.notEqual(repo.credentials[0].hash.hash, result.accessCode);
  assert.equal(repo.credentials[0].studentId, 'student-1');
});
