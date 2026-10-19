import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCertificateRepositoryForBackend,
  createCertificateTemplateRepositoryForBackend,
  createPostgresCertificateRepository,
  createPostgresCertificateTemplateRepository,
} from '../src/features/certificates/repositories/certificate-repository.factory.ts';
import { D1CertificateRepository } from '../src/features/certificates/repositories/d1-certificate.repository.ts';
import { D1CertificateTemplateRepository } from '../src/features/certificates/repositories/d1-certificate-template.repository.ts';
import { PostgresCertificateRepository } from '../src/features/certificates/repositories/postgres-certificate.repository.ts';
import { PostgresCertificateTemplateRepository } from '../src/features/certificates/repositories/postgres-certificate-template.repository.ts';

test('certificate factories select only the requested backend', () => {
  const postgresPool = {};
  const d1 = { prepare() {}, batch() {} };
  assert.ok(createCertificateRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresCertificateRepository);
  assert.ok(createCertificateRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1CertificateRepository);
  assert.ok(createCertificateTemplateRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresCertificateTemplateRepository);
  assert.ok(createCertificateTemplateRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1CertificateTemplateRepository);
  assert.ok(createPostgresCertificateRepository(postgresPool) instanceof PostgresCertificateRepository);
  assert.ok(createPostgresCertificateTemplateRepository(postgresPool) instanceof PostgresCertificateTemplateRepository);
});

test('certificate factories fail closed without selected backend dependencies', () => {
  assert.throws(() => createCertificateRepositoryForBackend('postgresql', {}), /PostgreSQL pool is required/);
  assert.throws(() => createCertificateRepositoryForBackend('d1', {}), /D1 binding is required/);
  assert.throws(() => createCertificateTemplateRepositoryForBackend('postgresql', {}), /PostgreSQL pool is required/);
  assert.throws(() => createCertificateTemplateRepositoryForBackend('d1', {}), /D1 binding is required/);
  assert.throws(() => createCertificateRepositoryForBackend('other', {}), /Unsupported database backend/);
  assert.throws(() => createCertificateTemplateRepositoryForBackend('other', {}), /Unsupported database backend/);
});
