BEGIN;

CREATE TABLE IF NOT EXISTS managed_hosting_months (
  month_key TEXT PRIMARY KEY,
  minimum_floor_usd NUMERIC(12,2) NOT NULL DEFAULT 15,
  operator_note TEXT,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT managed_hosting_month_floor_check CHECK (minimum_floor_usd >= 0),
  CONSTRAINT managed_hosting_month_status_check CHECK (
    payment_status IN ('PENDING','PAID','WAIVED')
  )
);

CREATE INDEX IF NOT EXISTS managed_hosting_months_updated_idx
  ON managed_hosting_months (updated_at DESC);

COMMIT;
