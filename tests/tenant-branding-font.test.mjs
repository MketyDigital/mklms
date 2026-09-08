import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('platform branding persists an owner-selected font and applies saved colors globally', async () => {
  const [migration, settingsType, repository, route, form, layout, css] = await Promise.all([
    source('db/migrations/017_tenant_font_branding.sql'),
    source('src/features/settings/platform-settings.ts'),
    source('src/features/settings/repositories/postgres-settings.repository.ts'),
    source('src/app/api/admin/settings/platform/route.ts'),
    source('src/features/settings/components/settings-form.tsx'),
    source('src/app/layout.tsx'),
    source('src/app/globals.css'),
  ]);

  assert.match(migration, /font_family\s+TEXT/i);
  assert.match(settingsType, /fontFamily\??:\s*string/);
  assert.match(repository, /font_family/);
  assert.match(route, /fontFamily/);
  assert.match(form, /Portal font/);
  assert.match(form, /Ubuntu/);
  assert.match(layout, /fontFamily/);
  assert.match(layout, /fonts\.googleapis\.com/);
  assert.match(layout, /--portal-font-family/);
  assert.match(layout, /--primary/);
  assert.match(layout, /--secondary/);
  assert.match(css, /--font-sans:\s*var\(--portal-font-family\)/);
});

test('font branding accepts arbitrary safe Google family names while rejecting CSS or URL injection', async () => {
  const fontModule = await import('../src/features/settings/font-branding.ts');
  const { normalizePortalFontFamily, googleFontStylesheetUrl } = fontModule;

  assert.equal(normalizePortalFontFamily(' Ubuntu '), 'Ubuntu');
  assert.equal(normalizePortalFontFamily('Playfair Display'), 'Playfair Display');
  assert.equal(normalizePortalFontFamily('IBM Plex Sans'), 'IBM Plex Sans');
  assert.equal(normalizePortalFontFamily('system-ui'), 'system-ui');
  assert.equal(normalizePortalFontFamily('Roboto; background:red'), null);
  assert.equal(normalizePortalFontFamily('https://evil.example/font.css'), null);
  assert.equal(
    googleFontStylesheetUrl('Ubuntu'),
    'https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;600;700&display=swap',
  );
  assert.equal(googleFontStylesheetUrl('system-ui'), null);
});
