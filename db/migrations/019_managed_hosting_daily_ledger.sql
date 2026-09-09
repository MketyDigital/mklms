BEGIN;

CREATE TABLE IF NOT EXISTS managed_hosting_daily_ledger (
  billing_date DATE PRIMARY KEY,
  month_key TEXT NOT NULL,
  measured_watch_minutes BIGINT NOT NULL DEFAULT 0 CHECK (measured_watch_minutes >= 0),
  estimated_live_audience_minutes BIGINT NOT NULL DEFAULT 0 CHECK (estimated_live_audience_minutes >= 0),
  streaming_activity_band TEXT NOT NULL DEFAULT 'Low' CHECK (streaming_activity_band IN ('Low', 'High')),
  automatic_balance_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  operator_adjustment_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  operator_reason TEXT,
  calculation_version TEXT NOT NULL DEFAULT 'streaming-v2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS managed_hosting_daily_ledger_month_idx
  ON managed_hosting_daily_ledger (month_key, billing_date);

COMMIT;
