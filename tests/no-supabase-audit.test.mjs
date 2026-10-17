import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('strict Supabase audit finds no active dependency', () => {
  const result = spawnSync(process.execPath, ['scripts/audit-no-supabase.mjs', '--strict'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.active, []);
  assert.ok(report.historical.length > 0);
  assert.ok(report.historical.every((item) => item.allowlisted === true));
});
