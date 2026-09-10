import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adminRoute = readFileSync('src/app/api/admin/certificates/[certificateId]/download/route.ts', 'utf8');
const studentRoute = readFileSync('src/app/api/certificates/[certificateId]/download/route.ts', 'utf8');
const adminUi = readFileSync('src/features/certificates/components/admin-certificate-manager.tsx', 'utf8');
const studentUi = readFileSync('src/app/(member)/certificates/page.tsx', 'utf8');

for (const [label, source] of [
  ['admin', adminRoute],
  ['student', studentRoute],
]) {
  test(`${label} certificate download streams PDF bytes from configured storage`, () => {
    assert.match(source, /storage\.getObject\(certificate\.pdfAssetId\)/);
    assert.match(source, /Content-Type/);
    assert.match(source, /application\/pdf/);
    assert.match(source, /Content-Disposition/);
    assert.doesNotMatch(source, /if \(!storage\.createReadAuthorization\)/);
  });
}

test('admin view and download use different content dispositions', () => {
  assert.match(adminUi, /\/download\?disposition=inline/);
  assert.match(adminUi, /\/download\?disposition=attachment/);
});

test('student download explicitly requests attachment disposition', () => {
  assert.match(studentUi, /\/download\?disposition=attachment/);
});
