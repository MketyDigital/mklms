import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const path of [
  '.github/workflows/deploy-installation-preview.yml',
  '.github/workflows/deploy-installation-production.yml',
]) {
  test(`${path} retries transient HTTP errors during post-deploy smoke checks`, () => {
    const source = readFileSync(path, 'utf8');
    const smoke = source.slice(source.indexOf('Smoke test installation'));
    assert.match(smoke, /curl[^\n]*--retry-all-errors/);
  });
}
