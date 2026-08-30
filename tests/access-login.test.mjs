import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAccessCodeLookupHash,
  hashAccessCode,
} from '../src/features/access/domain/access-code.ts';
import { AccessLoginService } from '../src/features/access/services/access-login.service.ts';

class InMemoryLoginRepository {
  constructor(code) {
    this.code = code;
    this.credential = {
      studentId: 'student-1',
      status: 'ACTIVE',
      hash: hashAccessCode(code),
    };
    this.sessions = [];
  }

  async findActiveCredentialByLookupHash(lookupHash) {
    if (lookupHash !== getAccessCodeLookupHash(this.code)) return null;
    return this.credential;
  }

  async createSession(studentId, session) {
    this.sessions.push({ studentId, ...session });
  }

  async revokeSession() {}
}

test('valid access code creates a hashed server session and returns plaintext token once', async () => {
  const repo = new InMemoryLoginRepository('ACCESS-ABC123');
  const service = new AccessLoginService(repo, { sessionTtlSeconds: 3600 });

  const result = await service.login('ACCESS-ABC123', new Date('2026-08-30T12:00:00Z'));

  assert.equal(result.ok, true);
  assert.equal(result.studentId, 'student-1');
  assert.equal(repo.sessions.length, 1);
  assert.notEqual(repo.sessions[0].tokenHash, result.sessionToken);
  assert.equal(repo.sessions[0].expiresAt.toISOString(), '2026-08-30T13:00:00.000Z');
});

test('invalid access code returns a neutral error and creates no session', async () => {
  const repo = new InMemoryLoginRepository('ACCESS-ABC123');
  const service = new AccessLoginService(repo, { sessionTtlSeconds: 3600 });

  const result = await service.login('WRONG-CODE');

  assert.deepEqual(result, {
    ok: false,
    publicMessage: 'We could not sign you in with that access code.',
  });
  assert.equal(repo.sessions.length, 0);
});
