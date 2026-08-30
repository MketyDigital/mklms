import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSafeExternalUrl } from '../src/lib/security/external-url.ts';

test('external URLs allow ordinary http/https destinations and normalize whitespace', () => {
  assert.equal(normalizeSafeExternalUrl(' https://example.com/offer '), 'https://example.com/offer');
  assert.equal(normalizeSafeExternalUrl('http://localhost:3000/preview'), 'http://localhost:3000/preview');
  assert.equal(normalizeSafeExternalUrl(null), null);
  assert.equal(normalizeSafeExternalUrl('   '), null);
});

test('external URLs reject scriptable, local-file and malformed schemes', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
    '//evil.example/path',
    'not a url',
  ]) {
    assert.throws(() => normalizeSafeExternalUrl(value), /safe http or https URL/i);
  }
});
