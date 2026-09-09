import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import * as hosting from '../src/features/hosting/domain/managed-hosting.ts';

const policy = { enabled: true, minimumMonthlyFeeUsd: 30, maximumMonthlyFeeUsd: 100 };

test('streaming usage is weighted more heavily than ordinary portal visits', () => {
  const visits = hosting.calculateWeightedStreamingUsage({ portalVisits: 10000 });
  const video = hosting.calculateWeightedStreamingUsage({ courseWatchMinutesMeasured: 10000 });
  assert.ok(video > visits);
  assert.equal(hosting.getStreamingActivityBand({ portalVisits: 100 }), 'Low');
  assert.equal(hosting.getStreamingActivityBand({ courseWatchMinutesMeasured: 12000 }), 'High');
});

test('usage-sensitive amount rises faster on high streaming activity while internal floor still accrues', () => {
  const now = new Date('2026-09-15T12:00:00Z');
  const quiet = hosting.calculateManagedHostingAmountDue({
    watchMinutes: 0,
    usageSignals: { portalVisits: 100 },
    policy,
    now,
  });
  const busy = hosting.calculateManagedHostingAmountDue({
    watchMinutes: 70000,
    usageSignals: { courseWatchMinutesMeasured: 70000 },
    policy,
    now,
  });
  assert.equal(quiet.accruedMinimumUsd, 15);
  assert.ok(quiet.amountDueUsd >= 15);
  assert.ok(busy.amountDueUsd > quiet.amountDueUsd);
});

test('manual adjustment applies once on top of automatic balance', () => {
  const base = hosting.calculateManagedHostingAmountDue({
    watchMinutes: 0,
    usageSignals: {},
    policy,
    now: new Date('2026-09-15T00:00:00Z'),
  });
  const adjusted = hosting.calculateManagedHostingAmountDue({
    watchMinutes: 0,
    usageSignals: {},
    policy,
    operatorAdjustmentUsd: 5,
    now: new Date('2026-09-15T00:00:00Z'),
  });
  assert.equal(adjusted.amountDueUsd, base.amountDueUsd + 5);
  assert.equal(adjusted.operatorAdjustmentUsd, 5);
});

test('checkout opens on day 30 except February which opens on its final day', () => {
  assert.equal(hosting.resolveManagedHostingPaymentWindow(new Date('2026-09-29T23:59:59Z')).isOpen, false);
  assert.equal(hosting.resolveManagedHostingPaymentWindow(new Date('2026-09-30T00:00:00Z')).isOpen, true);
  assert.equal(hosting.resolveManagedHostingPaymentWindow(new Date('2027-02-27T23:59:59Z')).isOpen, false);
  assert.equal(hosting.resolveManagedHostingPaymentWindow(new Date('2027-02-28T00:00:00Z')).isOpen, true);
  assert.equal(hosting.resolveManagedHostingPaymentWindow(new Date('2028-02-28T12:00:00Z')).isOpen, false);
  assert.equal(hosting.resolveManagedHostingPaymentWindow(new Date('2028-02-29T00:00:00Z')).isOpen, true);
});

test('customer billing copy hides commercial floor/cap mechanics and shows only activity band', async () => {
  const panel = await readFile(new URL('../src/features/hosting/components/managed-hosting-panel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /Streaming activity/);
  assert.match(panel, /High|activityBand/);
  assert.match(panel, /Current hosting balance/);
  assert.doesNotMatch(panel, /Monthly minimum|minimumMonthlyFeeUsd|maximumMonthlyFeeUsd|operatorAdjustmentUsd\.toFixed/);
  assert.doesNotMatch(panel, /operatorNote/);
});

test('checkout route enforces payment window server-side', async () => {
  const route = await readFile(new URL('../src/app/api/managed-hosting/checkout/route.ts', import.meta.url), 'utf8');
  assert.match(route, /resolveManagedHostingPaymentWindow/);
  assert.match(route, /Payment becomes available/);
  assert.match(route, /status: 409/);
});
