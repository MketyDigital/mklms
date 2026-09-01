import test from 'node:test';
import assert from 'node:assert/strict';

import { AccessAdminService } from '../src/features/access/services/access-admin.service.ts';

class Repo {
  constructor() { this.rows = []; }
  async createPreauthorization(input) {
    const existing = this.rows.find((row) => row.courseId === input.courseId && ((row.email && row.email === input.email) || (row.phone && row.phone === input.phone)));
    if (existing) return { record: existing, created: false };
    const record = { id: `pre-${this.rows.length + 1}`, ...input, status: 'PREAUTHORIZED' };
    this.rows.push(record);
    return { record, created: true };
  }
}

test('copy-paste import creates one distinct claim code per newly authorized line', async () => {
  const repo = new Repo();
  const service = new AccessAdminService(repo, { accessCodePrefix: 'LEARN', claimCodePrefix: 'CLAIM' });
  const result = await service.bulkPreauthorize({
    mode: 'paste',
    content: 'ada@example.com\n+234 803 000 0001\nsam@example.com',
    courseId: 'course-1',
    claimStrategy: 'claim-code',
  });

  assert.equal(result.createdCount, 3);
  assert.equal(result.created.length, 3);
  const codes = result.created.map((row) => row.claimCode);
  assert.ok(codes.every((code) => /^CLAIM-/.test(code)));
  assert.equal(new Set(codes).size, 3);
  assert.deepEqual(result.created.map((row) => row.courseId), ['course-1', 'course-1', 'course-1']);
});

test('duplicate pasted identity is skipped and does not create an extra returned code', async () => {
  const repo = new Repo();
  const service = new AccessAdminService(repo, { accessCodePrefix: 'LEARN', claimCodePrefix: 'CLAIM' });
  const result = await service.bulkPreauthorize({
    mode: 'paste',
    content: 'ada@example.com\nADA@example.com\nsam@example.com',
    courseId: 'course-1',
    claimStrategy: 'claim-code',
  });

  assert.equal(result.createdCount, 2);
  assert.equal(result.created.length, 2);
  assert.equal(new Set(result.created.map((row) => row.claimCode)).size, 2);
  assert.ok(result.errors.some((error) => error.code === 'DUPLICATE_IDENTITY'));
});
