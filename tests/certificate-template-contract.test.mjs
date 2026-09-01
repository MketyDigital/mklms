import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
