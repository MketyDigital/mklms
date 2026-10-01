BEGIN;

ALTER TABLE managed_hosting_months
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_id TEXT,
  ADD COLUMN IF NOT EXISTS settled_amount_usd NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS settled_currency TEXT;

ALTER TABLE managed_hosting_months
  DROP CONSTRAINT IF EXISTS managed_hosting_month_settled_amount_check;
ALTER TABLE managed_hosting_months
  ADD CONSTRAINT managed_hosting_month_settled_amount_check
  CHECK (settled_amount_usd IS NULL OR settled_amount_usd >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS managed_hosting_months_payment_id_idx
  ON managed_hosting_months (payment_id)
  WHERE payment_id IS NOT NULL;

COMMIT;
