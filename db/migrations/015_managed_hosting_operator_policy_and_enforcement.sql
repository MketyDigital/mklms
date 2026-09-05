BEGIN;

CREATE TABLE IF NOT EXISTS managed_hosting_operator_policy (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  configured BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  minimum_monthly_fee_usd NUMERIC(12,2) NOT NULL DEFAULT 15,
  maximum_monthly_fee_usd NUMERIC(12,2) NOT NULL DEFAULT 50,
  display_title TEXT NOT NULL DEFAULT 'Managed Video Hosting & Maintenance',
  display_description TEXT,
  notice TEXT,
  overdue_warning TEXT,
  due_days_after_month_end INTEGER NOT NULL DEFAULT 5,
  grace_days INTEGER NOT NULL DEFAULT 5,
  enforcement_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT managed_hosting_operator_policy_singleton CHECK (id = 1),
  CONSTRAINT managed_hosting_operator_policy_min_check CHECK (minimum_monthly_fee_usd >= 0),
  CONSTRAINT managed_hosting_operator_policy_max_check CHECK (maximum_monthly_fee_usd >= minimum_monthly_fee_usd),
  CONSTRAINT managed_hosting_operator_policy_due_days_check CHECK (due_days_after_month_end BETWEEN 0 AND 31),
  CONSTRAINT managed_hosting_operator_policy_grace_days_check CHECK (grace_days BETWEEN 0 AND 31)
);

INSERT INTO managed_hosting_operator_policy (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE managed_hosting_months
  ADD COLUMN IF NOT EXISTS amount_due_usd NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

ALTER TABLE managed_hosting_months
  DROP CONSTRAINT IF EXISTS managed_hosting_month_amount_due_check;
ALTER TABLE managed_hosting_months
  ADD CONSTRAINT managed_hosting_month_amount_due_check
  CHECK (amount_due_usd IS NULL OR amount_due_usd >= 0);

COMMIT;
