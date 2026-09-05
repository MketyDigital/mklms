import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  calculateManagedHostingAmountDue,
  normalizeManagedHostingPolicy,
} from '../src/features/hosting/domain/managed-hosting.ts';

const read = (path) => fs.readFileSync(path, 'utf8');

test('managed-hosting minimum accrues through the month instead of showing the full minimum on day one', () => {
  const policy = normalizeManagedHostingPolicy({
    enabled: true,
    minimumMonthlyFeeUsd: 15,
    maximumMonthlyFeeUsd: 50,
  });
  const early = calculateManagedHostingAmountDue({
    watchMinutes: 0,
    policy,
    now: new Date('2026-09-01T12:00:00Z'),
  });
  const end = calculateManagedHostingAmountDue({
    watchMinutes: 0,
    policy,
    now: new Date('2026-09-30T12:00:00Z'),
  });
  assert.equal(early.accruedMinimumUsd, 0.5);
  assert.equal(early.amountDueUsd, 0.5);
  assert.equal(end.accruedMinimumUsd, 15);
  assert.equal(end.amountDueUsd, 15);
});

test('a higher operator monthly floor remains immediately authoritative', () => {
  const policy = normalizeManagedHostingPolicy({
    enabled: true,
    minimumMonthlyFeeUsd: 15,
    maximumMonthlyFeeUsd: 50,
  });
  const result = calculateManagedHostingAmountDue({
    watchMinutes: 0,
    policy,
    monthlyMinimumFloorUsd: 30,
    now: new Date('2026-09-01T12:00:00Z'),
  });
  assert.equal(result.minimumFloorUsd, 30);
  assert.equal(result.amountDueUsd, 30);
});

test('tenant admin hosting panel is read-only and does not render operator billing editor', () => {
  const panel = read('src/features/hosting/components/managed-hosting-panel.tsx');
  assert.doesNotMatch(panel, /ManagedHostingMonthEditor/);
  assert.match(panel, /Amount due/);
});

test('admin media uses a direct-to-R2 initiate PUT finalize handshake and server-owned media keys', () => {
  assert.ok(fs.existsSync('src/app/api/admin/media/direct-upload/initiate/route.ts'));
  assert.ok(fs.existsSync('src/app/api/admin/media/direct-upload/finalize/route.ts'));
  assert.ok(fs.existsSync('src/features/media/server/r2-direct-upload.ts'));
  const initiate = read('src/app/api/admin/media/direct-upload/initiate/route.ts');
  const finalize = read('src/app/api/admin/media/direct-upload/finalize/route.ts');
  const panel = read('src/features/media/components/media-upload-panel.tsx');
  assert.match(initiate, /media\//);
  assert.doesNotMatch(initiate, /body\.bucket|body\.objectKey|body\.key/);
  assert.match(finalize, /verifyDirectR2Object/);
  assert.match(panel, /direct-upload\/initiate/);
  assert.match(panel, /method:\s*["']PUT["']/);
  assert.match(panel, /direct-upload\/finalize/);
  assert.doesNotMatch(panel, /api\/admin\/media\/upload["']/);
});

test('migration 013 adds first-class quizzes and paid-course live without altering free-live tables', () => {
  assert.ok(fs.existsSync('db/migrations/013_quizzes_and_paid_course_live.sql'));
  const migration = read('db/migrations/013_quizzes_and_paid_course_live.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS quizzes/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS quiz_questions/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS quiz_choices/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS quiz_attempts/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS paid_course_live_sessions/i);
  assert.doesNotMatch(migration, /ALTER TABLE\s+live_classes/i);
  assert.doesNotMatch(migration, /ALTER TABLE\s+live_class_sessions/i);
});

test('course editing no longer relies on browser prompt dialogs', () => {
  const manager = read('src/features/courses/components/admin/admin-course-manager.tsx');
  const builder = read('src/features/courses/components/admin/admin-course-builder.tsx');
  assert.doesNotMatch(manager, /window\.prompt/);
  assert.doesNotMatch(builder, /window\.prompt/);
  assert.match(builder, /completionThresholdPercent/);
  assert.match(builder, /mediaAssetId/);
});

test('paid live is course-owned and enrollment gated while free-live routes stay separate', () => {
  assert.ok(fs.existsSync('src/features/paid-live/repositories/postgres-paid-live.repository.ts'));
  assert.ok(fs.existsSync('src/app/api/courses/[courseId]/paid-live/[sessionId]/playback/route.ts'));
  const route = read('src/app/api/courses/[courseId]/paid-live/[sessionId]/playback/route.ts');
  assert.match(route, /getCurrentStudentSession/);
  assert.match(route, /enrollment/i);
  assert.match(route, /resolvePaidLiveState/);
  assert.doesNotMatch(route, /PostgresLiveClassRepository/);

  const freeState = read('src/app/api/live/[slug]/state/route.ts');
  const freePlayback = read('src/app/api/live/[slug]/playback/route.ts');
  assert.match(freeState, /PostgresLiveClassRepository|LiveClass/);
  assert.match(freePlayback, /PostgresLiveClassRepository|LiveClass/);
});

test('real certificate template is wired into a production-like renderer test', () => {
  assert.ok(fs.existsSync('certs/cert.png'));
  assert.ok(fs.existsSync('src/features/certificates/providers/default-certificate-layout.ts'));
  const renderer = read('src/features/certificates/providers/pdf-lib-certificate-renderer.ts');
  const allTests = fs.readdirSync('tests')
    .filter((name) => name.endsWith('.test.mjs'))
    .map((name) => read(`tests/${name}`))
    .join('\n');
  assert.match(renderer, /REAL_CERTIFICATE_DEFAULT_LAYOUT/);
  assert.match(allTests, /certs\/cert\.png/);
  assert.match(allTests, /PdfLibCertificateRenderer/);
});