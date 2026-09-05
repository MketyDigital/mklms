import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const checkout = fs.readFileSync('src/app/api/managed-hosting/checkout/route.ts', 'utf8');
const panel = fs.readFileSync('src/features/hosting/components/managed-hosting-panel.tsx', 'utf8');
const page = fs.readFileSync('src/app/(admin)/admin/hosting/page.tsx', 'utf8');

test('managed-hosting checkout derives amount from server usage and existing policy', () => {
  assert.match(checkout, /getCurrentMonthUsage\(\)/);
  assert.match(checkout, /getMonthOverride\(monthKey\)/);
  assert.match(checkout, /calculateManagedHostingAmountDue/);
  assert.match(checkout, /hasValidAdminSession/);
  assert.doesNotMatch(checkout, /request\.json/);
});

test('hosting page prefers automatic checkout, preserves payment fallback, and exposes no operator editor to tenant admin', () => {
  assert.match(page, /isManagedHostingBillingAutomationConfigured/);
  assert.match(page, /billingAutomationEnabled=\{billingAutomationEnabled\}/);
  assert.match(panel, /ManagedHostingPayButton/);
  assert.match(panel, /policy\.paymentUrl/);
  assert.doesNotMatch(panel, /ManagedHostingMonthEditor/);
  assert.match(panel, /paymentStatus === "PENDING"/);
});
