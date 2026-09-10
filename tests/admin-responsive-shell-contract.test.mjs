import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin layout stacks on mobile and returns to sidebar row at lg', async () => {
  const layout = await source('src/components/layout/app-layout.tsx');
  const sidebar = await source('src/components/layout/app-sidebar.tsx');
  assert.match(layout, /flex-col lg:flex-row/);
  assert.match(layout, /min-w-0 flex-1 overflow-x-hidden/);
  assert.doesNotMatch(layout, /isAdmin \? "flex-row"/);
  assert.match(sidebar, /lg:hidden/);
  assert.match(sidebar, /hidden w-60 shrink-0 border-r bg-background lg:block/);
  assert.match(sidebar, /SheetContent/);
});

test('new certificate and hosting admin controls use mobile-safe widths', async () => {
  const certificates = await source('src/features/certificates/components/admin-certificate-manager.tsx');
  const templates = await source('src/features/certificates/components/admin-certificate-template-manager.tsx');
  const hosting = await source('src/app/(admin)/admin/hosting/page.tsx');
  const operator = await source('src/app/operator/hosting/page.tsx');
  assert.match(certificates, /w-full sm:w-auto/);
  assert.match(templates, /w-full sm:w-auto/);
  assert.match(hosting, /px-3 py-4 sm:px-6/);
  assert.match(operator, /w-full sm:w-auto/);
});

test('admin can view and download issued certificates without losing existing actions', async () => {
  const manager = await source('src/features/certificates/components/admin-certificate-manager.tsx');
  const route = await source('src/app/api/admin/certificates/[certificateId]/download/route.ts');
  assert.match(manager, /View certificate/);
  assert.match(manager, /Download PDF/);
  assert.match(manager, /Generate \/ resend/);
  assert.match(manager, /Send in Messages/);
  assert.match(manager, /Revoke/);
  assert.match(route, /hasValidAdminSession/);
  assert.match(route, /findListItemById/);
  assert.match(route, /storage\.getObject\(certificate\.pdfAssetId\)/);
  assert.match(route, /Content-Disposition/);
});
