import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('ESLint excludes generated OpenNext output from repository linting', async () => {
  const config = await readFile(new URL('../eslint.config.mjs', import.meta.url), 'utf8');
  assert.match(config, /"\.open-next\/\*\*"/);
});
