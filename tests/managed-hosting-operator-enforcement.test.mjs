import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import * as hosting from '../src/features/hosting/domain/managed-hosting.ts';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('existing managed-hosting accrual and usage calculation remains unchanged', () => {
  const policy = {
    enabled: true,
    minimumMonthlyFeeUsd: 15,
    maximumMonthlyFeeUsd: 50,
  };
  assert.equal(hosting.calculateManagedHostingFee({ watchMinutes: 5000, policy }), 0);
  assert.equal(hosting.calculateManagedHostingFee({ watchMinutes: 10000, policy }), 17.5);
  assert.equal(hosting.calculateManagedHostingFee({ watchMinutes: 50000, policy }), 35);
  assert.equal(hosting.calculateManagedHostingFee({ watchMinutes: 150000, policy }), 50);
  assert.equal(hosting.calculateAccruedMonthlyMinimum({
    policy,
    now: new Date('2026-09-15T12:00:00Z'),
  }), 7.5);
});

test('operator can intentionally configure any non-negative monthly minimum while legacy default remains 15', () => {
  const custom = hosting.normalizeManagedHostingPolicy({ enabled: true, minimumMonthlyFeeUsd: 3, maximumMonthlyFeeUsd: 20 });
  assert.equal(custom.minimumMonthlyFeeUsd, 3);
  assert.equal(custom.maximumMonthlyFeeUsd, 20);
  const fallback = hosting.normalizeManagedHostingPolicy({ enabled: true, minimumMonthlyFeeUsd: Number.NaN, maximumMonthlyFeeUsd: Number.NaN });
  assert.equal(fallback.minimumMonthlyFeeUsd, 15);
  assert.equal(fallback.maximumMonthlyFeeUsd, 50);
});

test('billing standing supports due overdue restricted paid and waived states', () => {
  const resolve = hosting.resolveManagedHostingStanding;
  const dueAt = new Date('2026-10-05T23:59:59Z');
  const graceEndsAt = new Date('2026-10-10T23:59:59Z');
  assert.equal(resolve({ paymentStatus: 'PENDING', dueAt, graceEndsAt, enforcementEnabled: true, now: new Date('2026-10-04T00:00:00Z') }).status, 'DUE');
  assert.equal(resolve({ paymentStatus: 'PENDING', dueAt, graceEndsAt, enforcementEnabled: true, now: new Date('2026-10-07T00:00:00Z') }).status, 'OVERDUE');
  assert.equal(resolve({ paymentStatus: 'PENDING', dueAt, graceEndsAt, enforcementEnabled: true, now: new Date('2026-10-11T00:00:00Z') }).status, 'RESTRICTED');
  assert.equal(resolve({ paymentStatus: 'PENDING', dueAt, graceEndsAt, enforcementEnabled: false, now: new Date('2026-10-11T00:00:00Z') }).status, 'OVERDUE');
  assert.equal(resolve({ paymentStatus: 'PAID', dueAt, graceEndsAt, enforcementEnabled: true, now: new Date('2026-10-20T00:00:00Z') }).status, 'PAID');
  assert.equal(resolve({ paymentStatus: 'WAIVED', dueAt, graceEndsAt, enforcementEnabled: true, now: new Date('2026-10-20T00:00:00Z') }).status, 'WAIVED');
});

test('operator policy is database-backed and not exposed through tenant admin controls', async () => {
  const migrationPath = new URL('../db/migrations/015_managed_hosting_operator_policy_and_enforcement.sql', import.meta.url);
  assert.equal(existsSync(migrationPath), true);
  const migration = await readFile(migrationPath, 'utf8');
  assert.match(migration, /managed_hosting_operator_policy/);
  assert.match(migration, /amount_due_usd/);
  assert.match(migration, /due_at/);
  assert.match(migration, /grace_ends_at/);

  const tenantPanel = await source('src/features/hosting/components/managed-hosting-panel.tsx');
  assert.doesNotMatch(tenantPanel, /Accrued minimum|Usage-derived amount|minimumMonthlyFeeUsd|maximumMonthlyFeeUsd/);
  assert.match(tenantPanel, /Managed Video Hosting & Maintenance/);
  assert.match(tenantPanel, /Amount due|Current hosting balance/);

  const operatorApiPath = new URL('../src/app/api/operator/hosting/policy/route.ts', import.meta.url);
  const operatorPagePath = new URL('../src/app/operator/hosting/page.tsx', import.meta.url);
  assert.equal(existsSync(operatorApiPath), true);
  assert.equal(existsSync(operatorPagePath), true);
  const operatorApi = await readFile(operatorApiPath, 'utf8');
  assert.match(operatorApi, /isValidManagedHostingOperatorKey/);
  assert.doesNotMatch(operatorApi, /hasValidAdminSession/);
});

test('non-payment restriction gates all hosted upload paths and protected paid media while leaving free-live and Zoom join untouched', async () => {
  const restriction = await source('src/features/hosting/server/managed-hosting-access.ts');
  assert.match(restriction, /resolveManagedHostingStanding/);
  assert.match(restriction, /standing\.restricted/);

  const initiate = await source('src/app/api/admin/media/direct-upload/initiate/route.ts');
  const finalize = await source('src/app/api/admin/media/direct-upload/finalize/route.ts');
  const legacyUpload = await source('src/app/api/admin/media/upload/route.ts');
  const lessonPlayback = await source('src/app/api/courses/[courseId]/lessons/[lessonId]/playback/route.ts');
  const paidPlayback = await source('src/app/api/courses/[courseId]/paid-live/[sessionId]/playback/route.ts');
  const paidZoomJoin = await source('src/app/api/courses/[courseId]/paid-live/[sessionId]/join/route.ts');
  const freePlayback = await source('src/app/api/live/[slug]/playback/route.ts');
  assert.match(initiate, /managed-hosting-access/);
  assert.match(finalize, /managed-hosting-access/);
  assert.match(legacyUpload, /managed-hosting-access/);
  assert.match(lessonPlayback, /managed-hosting-access/);
  assert.match(paidPlayback, /managed-hosting-access/);
  assert.doesNotMatch(paidZoomJoin, /managed-hosting-access|HOSTING_PAYMENT_REQUIRED/);
  assert.doesNotMatch(freePlayback, /managed-hosting-access|RESTRICTED|hosting payment/i);
});
