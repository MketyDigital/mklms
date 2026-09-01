import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('mobile live shell follows the visual viewport so name/comment focus cannot pan the player away', async () => {
  const liveRoom = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const anchor = await source('src/features/live-classes/components/live-mobile-viewport-anchor.tsx');
  const livePage = await source('src/app/(public)/live/[slug]/page.tsx');
  const globals = await source('src/app/globals.css');

  assert.match(liveRoom, /--live-visual-viewport-height/);
  assert.match(liveRoom, /viewport\.height/);
  assert.match(anchor, /viewport\.offsetTop/);
  assert.match(anchor, /shell\.style\.top/);
  assert.match(anchor, /shell\.style\.height/);
  assert.match(anchor, /shell\.style\.bottom\s*=\s*"auto"/);
  assert.match(anchor, /viewport\.addEventListener\("resize"/);
  assert.match(anchor, /viewport\.addEventListener\("scroll"/);
  assert.match(livePage, /<LiveMobileViewportAnchor\s*\/>/);
  assert.match(globals, /\[data-live-mobile-viewport\][\s\S]*position:\s*fixed/);
  assert.match(globals, /height:\s*var\(--live-visual-viewport-height/);
  assert.match(globals, /overflow:\s*hidden/);
});
