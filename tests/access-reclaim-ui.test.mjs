import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('admin access panel exposes an explicit reclaim action separate from code reset', () => {
  const source = readFileSync('src/features/access/components/admin/admin-access-panel.tsx', 'utf8');
  assert.match(source, /Allow reclaim/);
  assert.match(source, /\/reclaim/);
  assert.match(source, /claimCode/);
  assert.match(source, /onboarding/);
});

test('admin reclaim route uses platform claim strategy and returns one-time claim code when present', () => {
  const source = readFileSync('src/app/api/admin/access/students/[studentId]/reclaim/route.ts', 'utf8');
  assert.match(source, /claimVerificationStrategy/);
  assert.match(source, /prepareStudentReclaim/);
  assert.match(source, /claimCode/);
  assert.match(source, /hasValidAdminSession/);
});
