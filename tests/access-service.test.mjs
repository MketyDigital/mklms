import test from 'node:test';
import assert from 'node:assert/strict';

import { AccessService } from '../src/features/access/services/access.service.ts';

class MemoryAccessRepository {
  constructor(records, students = []) {
    this.records = records;
    this.students = [...students];
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

  async completeVerifiedClaim(input) {
    const preauthorization = this.records.find((record) => record.id === input.preauthorizationId && record.status === 'PREAUTHORIZED');
    if (!preauthorization) throw new Error('Preauthorization is no longer available for claiming.');
    let student = this.students.find((item) =>
      (input.student.email && item.email?.toLowerCase() === input.student.email.toLowerCase()) ||
      (input.student.phone && item.phone?.replace(/\D/g, '') === input.student.phone.replace(/\D/g, '')),
    );
    if (!student) {
      student = { id: `student-${this.students.length + 1}`, status: 'ACTIVE', ...input.student };
      this.students.push(student);
    }
    if (student.status !== 'ACTIVE') throw new Error('Existing student access is not active.');
    this.credentials = this.credentials.filter((item) => item.studentId !== student.id);
    this.credentials.push({ studentId: student.id, ...input.credential });
    if (input.courseId && !this.enrollments.some((item) => item.studentId === student.id && item.courseId === input.courseId)) {
      this.enrollments.push({ studentId: student.id, courseId: input.courseId, status: 'ACTIVE' });
    }
    preauthorization.status = 'CLAIMED';
    preauthorization.claimedByStudentId = student.id;
    return student;
  }
}

test('claim creates a student, activates enrollment, and stores only hashed access credential', async () => {
  const repository = new MemoryAccessRepository([{ id: 'pre-1', email: 'paid@example.com', courseId: 'course-1', status: 'PREAUTHORIZED' }]);
  const service = new AccessService(repository, { accessCodePrefix: 'LEARN' });
  const result = await service.completeVerifiedClaim({ identity: { email: 'paid@example.com' }, certificateName: 'Paid Student', certificateEmail: 'paid@example.com' });
  assert.equal(result.ok, true);
  assert.match(result.accessCode, /^LEARN-/);
  assert.equal(repository.students.length, 1);
  assert.equal(repository.enrollments[0].status, 'ACTIVE');
  assert.equal(repository.credentials.length, 1);
  assert.notEqual(repository.credentials[0].hash.hash, result.accessCode);
  assert.equal(repository.records[0].status, 'CLAIMED');
});

test('claim recovers a matching active student left behind by an earlier partial failure', async () => {
  const existingStudent = { id: 'student-existing', status: 'ACTIVE', displayName: 'Paid Student', email: 'paid@example.com', phone: null, certificateName: 'Paid Student', certificateEmail: 'paid@example.com' };
  const repository = new MemoryAccessRepository([{ id: 'pre-1', email: 'paid@example.com', courseId: 'course-1', status: 'PREAUTHORIZED' }], [existingStudent]);
  const service = new AccessService(repository, { accessCodePrefix: 'LEARN' });
  const result = await service.completeVerifiedClaim({ identity: { email: 'paid@example.com' }, certificateName: 'Paid Student', certificateEmail: 'paid@example.com' });
  assert.equal(result.ok, true);
  assert.equal(result.studentId, 'student-existing');
  assert.equal(repository.students.length, 1);
  assert.equal(repository.credentials.length, 1);
  assert.equal(repository.enrollments.length, 1);
  assert.equal(repository.records[0].status, 'CLAIMED');
});

test('claim failure uses a neutral public response and creates nothing', async () => {
  const repository = new MemoryAccessRepository([]);
  const service = new AccessService(repository, { accessCodePrefix: 'LEARN' });
  const result = await service.completeVerifiedClaim({ identity: { email: 'unknown@example.com' }, certificateName: 'Unknown Student', certificateEmail: 'unknown@example.com' });
  assert.deepEqual(result, { ok: false, publicMessage: "We couldn't verify access with those details." });
  assert.equal(repository.students.length, 0);
  assert.equal(repository.credentials.length, 0);
  assert.equal(repository.enrollments.length, 0);
});
