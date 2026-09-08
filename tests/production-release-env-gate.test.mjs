import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('production release pointer validation runs after manifest target values become step environment', () => {
  const source = readFileSync('.github/workflows/deploy-installation-production.yml', 'utf8');
  const resolveIndex = source.indexOf('Resolve selected production target');
  const validateIndex = source.indexOf('Validate production branch ownership and release pointer');

  assert.ok(resolveIndex >= 0, 'workflow must have a distinct target-resolution step');
  assert.ok(validateIndex > resolveIndex, 'release-pointer validation must run in a later step after GITHUB_ENV is applied');

  const validateSection = source.slice(validateIndex, source.indexOf('\n      - name:', validateIndex + 1));
  assert.match(validateSection, /git fetch origin "\$PRODUCTION_BRANCH/);
  assert.match(validateSection, /origin\/\$PRODUCTION_BRANCH/);
});
