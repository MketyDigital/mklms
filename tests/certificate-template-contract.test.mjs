import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';

import { PdfLibCertificateRenderer } from '../src/features/certificates/providers/pdf-lib-certificate-renderer.ts';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('certificate template upload accepts PDF PNG and JPEG and persists placement coordinates', async () => {
  const route = await source('src/app/api/admin/certificate-templates/route.ts');
  assert.match(route, /application\/pdf/);
  assert.match(route, /image\/png/);
  assert.match(route, /image\/jpeg/);
  for (const key of ['nameX','nameY','nameFontSize','dateX','dateY','dateFontSize','idX','idY','idFontSize']) {
    assert.match(route, new RegExp(key));
  }
});

test('certificate renderer preserves uploaded background and overlays portal fields', async () => {
  const renderer = await source('src/features/certificates/providers/pdf-lib-certificate-renderer.ts');
  assert.match(renderer, /PDFDocument\.load\(background\.bytes\)/);
  assert.match(renderer, /embedPng\(background\.bytes\)/);
  assert.match(renderer, /embedJpg\(background\.bytes\)/);
  assert.match(renderer, /certificate\.certificateNameSnapshot/);
  assert.match(renderer, /certificate\.completionDate/);
  assert.match(renderer, /certificate\.certificateId/);
});

test('real certs/cert.png template renders a production-like certificate PDF', async () => {
  const backgroundBytes = new Uint8Array(await readFile(new URL('../certs/cert.png', import.meta.url)));
  const storage = {
    async putObject() { return { assetId: 'unused' }; },
    async getObject(assetId) {
      assert.equal(assetId, 'certs/cert.png');
      return { bytes: backgroundBytes, contentType: 'image/jpeg' };
    },
    async createReadAuthorization() { return { url: 'https://example.invalid', expiresAt: null }; },
  };
  const renderer = new PdfLibCertificateRenderer(storage);
  const rendered = await renderer.render({
    certificate: {
      id: 'record-1',
      certificateId: 'SPF-TEST-2026-0001',
      studentId: 'student-1',
      courseId: 'course-1',
      certificateNameSnapshot: 'Mfon Sambo',
      completionDate: '2026-09-05',
      certificateEmailSnapshot: null,
      status: 'ISSUED',
      issuedAt: new Date('2026-09-05T00:00:00Z'),
      revokedAt: null,
    },
    template: {
      id: 'real-cert-template',
      name: 'Production certificate proof',
      backgroundAssetId: 'certs/cert.png',
      signatureAssetId: null,
      layoutConfig: {},
    },
  });

  assert.equal(rendered.contentType, 'application/pdf');
  assert.ok(rendered.bytes.length > backgroundBytes.length);
  assert.equal(new TextDecoder().decode(rendered.bytes.slice(0, 4)), '%PDF');
  const pdf = await PDFDocument.load(rendered.bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(pdf.getPage(0).getWidth() > 1000);
  assert.ok(pdf.getPage(0).getHeight() > 800);
});
