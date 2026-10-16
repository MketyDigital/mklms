import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

test('D1 readiness inventory is read-only and finds current PostgreSQL coupling', () => {
  const script = fs.readFileSync('scripts/audit-d1-compat.mjs', 'utf8');
  assert.doesNotMatch(script, /(?:fetch\s*\(|\.query\s*\(|wrangler\s+d1\s+execute|DATABASE_URL\s*=)/);
  const report = JSON.parse(execFileSync(process.execPath, ['scripts/audit-d1-compat.mjs'], { encoding: 'utf8' }));
  assert.match(report.purpose, /read-only/);
  assert.ok(report.totals['postgres-connection'] > 0, 'existing PostgreSQL coupling must be reported');
  assert.ok(report.findings.some(item => item.file === 'src/lib/postgres.ts'));
  assert.ok(report.findings.some(item => item.file.startsWith('db/migrations/')));
});
