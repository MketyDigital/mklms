import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/lib/database-backend-policy.ts', 'utf8');

test('PostgreSQL remains the default; D1 cannot be automatically selected', () => {
  assert.match(source, /config\.backend \?\? "postgresql"/);
  assert.match(source, /if \(backend === "postgresql"\) return "postgresql"/);
});
test('D1 requires all explicit cutover gates and fails closed', () => {
  for (const gate of ['d1BindingPresent', 'schemaReady', 'reconciliationPassed', 'cutoverApproved']) {
    assert.match(source, new RegExp('!config\\.' + gate));
  }
  assert.match(source, /throw new Error\(/);
});
test('Selection policy does not connect to databases or mutate live traffic', () => {
  assert.doesNotMatch(source, /getCloudflareContext|wrangler|\.query\(|\.execute\(|fetch\(/);
});
