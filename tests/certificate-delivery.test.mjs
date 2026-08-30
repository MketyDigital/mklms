import test from 'node:test';
import assert from 'node:assert/strict';

import { CertificateDeliveryService } from '../src/features/certificates/services/certificate-delivery.service.ts';

const certificate = {
  id: 'certificate-1',
  certificateId: 'CERT-ABC123ABC123',
  studentId: 'student-1',
  courseId: 'course-1',
  certificateNameSnapshot: 'Ada Example',
  certificateEmailSnapshot: 'ada@example.com',
  completionDate: '2026-08-30',
  status: 'ISSUED',
  issuedAt: new Date('2026-08-30T10:00:00.000Z'),
  revokedAt: null,
};

const template = {
  id: 'template-1',
  name: 'Default Certificate',
  layoutConfig: {},
};

class Renderer {
  async render(input) {
    assert.equal(input.certificate.certificateId, certificate.certificateId);
    return {
      bytes: new Uint8Array([37, 80, 68, 70]),
      contentType: 'application/pdf',
      fileName: `${input.certificate.certificateId}.pdf`,
    };
  }
}

class Storage {
  constructor() { this.objects = []; }
  async putObject(input) {
    this.objects.push(input);
    return { assetId: 'asset-pdf-1' };
  }
}

class Email {
  constructor({ fail = false } = {}) { this.fail = fail; this.messages = []; }
  async sendEmail(input) {
    if (this.fail) throw new Error('SMTP unavailable');
    this.messages.push(input);
    return { messageId: 'message-1' };
  }
}

class Repo {
  constructor() { this.pdfAssetId = null; this.email = null; }
  async setPdfAsset(_certificateId, assetId) { this.pdfAssetId = assetId; }
  async markEmailSent(_certificateId, sentAt) { this.email = { status: 'SENT', sentAt }; }
  async markEmailFailed(_certificateId, error) { this.email = { status: 'FAILED', error }; }
}

test('certificate PDF is rendered, privately stored, and emailed through provider contracts', async () => {
  const storage = new Storage();
  const email = new Email();
  const repo = new Repo();
  const service = new CertificateDeliveryService({
    renderer: new Renderer(), storage, email, repository: repo,
  });

  const result = await service.deliver(certificate, template);

  assert.deepEqual(result, { ok: true, pdfAssetId: 'asset-pdf-1', emailStatus: 'SENT' });
  assert.equal(storage.objects.length, 1);
  assert.equal(storage.objects[0].visibility, 'private');
  assert.equal(repo.pdfAssetId, 'asset-pdf-1');
  assert.equal(email.messages[0].to, 'ada@example.com');
  assert.equal(repo.email.status, 'SENT');
});

test('email delivery failure does not roll back issued/stored certificate', async () => {
  const storage = new Storage();
  const repo = new Repo();
  const service = new CertificateDeliveryService({
    renderer: new Renderer(), storage, email: new Email({ fail: true }), repository: repo,
  });

  const result = await service.deliver(certificate, template);

  assert.deepEqual(result, { ok: true, pdfAssetId: 'asset-pdf-1', emailStatus: 'FAILED' });
  assert.equal(repo.pdfAssetId, 'asset-pdf-1');
  assert.equal(repo.email.status, 'FAILED');
  assert.match(repo.email.error, /SMTP unavailable/);
});
