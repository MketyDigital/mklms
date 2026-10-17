-- Offline D1 conversion of PostgreSQL migrations 019 and 020.
-- Money represented as integer cents, not float. PostgreSQL NUMERIC-to-cents
-- conversion must be validated before data migration; no production cutover.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS managed_hosting_daily_ledger(
 billing_date TEXT PRIMARY KEY,
 month_key TEXT NOT NULL,
 measured_watch_minutes INTEGER NOT NULL DEFAULT 0 CHECK(measured_watch_minutes>=0),
 estimated_live_audience_minutes INTEGER NOT NULL DEFAULT 0 CHECK(estimated_live_audience_minutes>=0),
 streaming_activity_band TEXT NOT NULL DEFAULT 'Low' CHECK(streaming_activity_band IN ('Low','High')),
 automatic_balance_cents INTEGER NOT NULL DEFAULT 0,
 operator_adjustment_cents INTEGER NOT NULL DEFAULT 0,
 operator_reason TEXT,
 calculation_version TEXT NOT NULL DEFAULT 'streaming-v2',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS managed_hosting_daily_ledger_month_idx
 ON managed_hosting_daily_ledger(month_key,billing_date);
ALTER TABLE managed_hosting_months ADD COLUMN paid_at TEXT;
ALTER TABLE managed_hosting_months ADD COLUMN payment_id TEXT;
ALTER TABLE managed_hosting_months ADD COLUMN settled_amount_cents INTEGER
 CHECK(settled_amount_cents IS NULL OR settled_amount_cents>=0);
ALTER TABLE managed_hosting_months ADD COLUMN settled_currency TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS managed_hosting_months_payment_id_idx
 ON managed_hosting_months(payment_id) WHERE payment_id IS NOT NULL;
