import test from 'node:test';
import assert from 'node:assert/strict';

import { AccessService } from '../src/features/access/services/access.service.ts';

class MemoryAccessRepository {
  constructor(records) {
    this.records = records;
    this.students = [];
    this.credentials = [];
    this.enrollments = [];
  }

  async findPreauthorization(identity) {
    return this.records.find((record) =>
      record.status === 'PREAUTHORIZED' &&
      ((identity.email && record.email?.toLowerCase() === identity.email.toLowerCase()) ||
        (identity.phone && record.phone?.replace(/\D/g, '') === identity.phone.replace(/\D/g, ''))),
    ) ?? null;
  }

  async createStudent(input) {
    const student = { id: `student-${this.students.length + 1}`, ...input };
    this.students.push(student);
    return student;
  }

  async markPreauthorizationClaimed(preauthorizationId, studentId) {
    const record = this.records.find((item) => item.id === preauthorizationId);
    record.status = 'CLAIMED';
    record.claimedByStudentId = studentId;
  }

  async replaceAccessCredential(studentId, credential) {
    this.credentials = this.credentials.filter((item) => item.studentId !== studentId);
    this.credentials.push({ studentId, ...credential });
  }

  async activateEnrollment(studentId, courseId) {
    this.enrollments.push({ studentId, courseId, status: 'ACTIVE' });
  }
}

test('claim creates a student, activates enrollment, and stores only hashed access credential', async () => {
  const repository = new MemoryAccessRepository([
    {
      id: 'pre-1',
      email: 'paid@example.com',
      courseId: 'course-1',
      status: 'PREAUTHORIZED',
    },
  ]);
  const service = new AccessService(repository, { accessCodePrefix: 'LEARN' });

  const result = await service.completeVerifiedClaim({
    identity: { email: 'paid@example.com' },
    certificateName: 'Paid Student',
    certificateEmail: 'paid@example.com',
  });

  assert.equal(result.ok, true);
  assert.match(result.accessCode, /^LEARN-/);
  assert.equal(repository.students.length, 1);
  assert.equal(repository.enrollments[0].status, 'ACTIVE');
  assert.equal(repository.credentials.length, 1);
  assert.notEqual(repository.credentials[0].hash.hash, result.accessCode);
  assert.equal(repository.records[0].status, 'CLAIMED');
});

test('claim failure uses a neutral public response and creates nothing', async () => {
  const repository = new MemoryAccessRepository([]);
  const service = new AccessService(repository, { accessCodePrefix: 'LEARN' });

  const result = await service.completeVerifiedClaim({
    identity: { email: 'unknown@example.com' },
    certificateName: 'Unknown Student',
    certificateEmail: 'unknown@example.com',
  });

  assert.deepEqual(result, {
    ok: false,
    publicMessage: "We couldn't verify access with those details.",
  });
  assert.equal(repository.students.length, 0);
  assert.equal(repository.credentials.length, 0);
  assert.equal(repository.enrollments.length, 0);
});
