import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('managed-hosting usage excludes future live sessions and only accrues elapsed live duration', async () => {
  const repository = await read('src/features/hosting/repositories/postgres-managed-hosting.repository.ts');
  assert.match(repository, /const effectiveEnd = now < nextMonth \? now : nextMonth/);
  assert.match(repository, /ls\.starts_at >= \$1 AND ls\.starts_at < \$2/);
  assert.match(repository, /EXTRACT\(EPOCH FROM \(\$2::timestamptz - ls\.starts_at\)\)/);
  assert.match(repository, /LEAST\([\s\S]*ls\.duration_seconds/);
});

test('daily automatic billing balance cannot move backwards within a month', async () => {
  const ledger = await read('src/features/hosting/repositories/postgres-managed-hosting-ledger.repository.ts');
  const page = await read('src/app/(admin)/admin/hosting/page.tsx');
  const checkout = await read('src/app/api/managed-hosting/checkout/route.ts');
  assert.match(ledger, /GREATEST\([\s\S]*automatic_balance_usd/);
  assert.match(ledger, /getMonthPeakAutomaticBalance/);
  assert.match(page, /Math\.max\(automatic\.amountDueUsd, peakAutomaticBalanceUsd\)/);
  assert.match(checkout, /Math\.max\(billing\.amountDueUsd, peakAutomaticBalanceUsd\)/);
});

test('checkout locks invoice amount before exposing the provider invoice URL', async () => {
  const checkout = await read('src/app/api/managed-hosting/checkout/route.ts');
  assert.match(checkout, /finalizeMonthInvoice/);
  assert.match(checkout, /different invoice amount is already locked/i);
  assert.match(checkout, /return NextResponse\.json\(\{ ok: true, invoiceUrl/);
});

test('settlement validates the locked invoice and stores payment metadata', async () => {
  const settlement = await read('src/app/api/managed-hosting/settlement/route.ts');
  const repository = await read('src/features/hosting/repositories/postgres-managed-hosting.repository.ts');
  const migration = await read('db/migrations/020_managed_hosting_payment_settlement.sql');
  assert.match(settlement, /Settlement amount does not match the locked invoice/);
  assert.match(settlement, /priceCurrency\.trim\(\)\.toLowerCase\(\) !== "usd"/);
  assert.match(repository, /payment_id = COALESCE\(payment_id, \$3\)/);
  assert.match(repository, /settled_amount_usd = COALESCE\(settled_amount_usd, \$4\)/);
  assert.match(migration, /paid_at TIMESTAMPTZ/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS managed_hosting_months_payment_id_idx/);
});

test('paid or waived month displays zero amount due', async () => {
  const panel = await read('src/features/hosting/components/managed-hosting-panel.tsx');
  assert.match(panel, /const isSettled = status === "PAID" \|\| status === "WAIVED"/);
  assert.match(panel, /const amountDueUsd = isSettled[\s\S]*\? 0/);
});
