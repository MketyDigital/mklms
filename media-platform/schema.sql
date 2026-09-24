-- Mkety Media Platform: separate database/schema from MkLMS.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS media_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  plan_code text NOT NULL DEFAULT 'enterprise',
  storage_quota_bytes bigint NOT NULL DEFAULT 10737418240,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES media_tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('r2','oci','aws','gcs','azure')),
  label text NOT NULL,
  endpoint text,
  region text,
  physical_bucket text NOT NULL,
  credential_ref text NOT NULL,
  is_platform_managed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES media_tenants(id) ON DELETE CASCADE,
  provider_account_id uuid NOT NULL REFERENCES media_provider_accounts(id),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  prefix text NOT NULL,
  public_read boolean NOT NULL DEFAULT true,
  cache_control text NOT NULL DEFAULT 'public, max-age=31536000, immutable',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug),
  UNIQUE (provider_account_id, prefix)
);

CREATE TABLE IF NOT EXISTS media_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id uuid NOT NULL REFERENCES media_buckets(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  content_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  etag text,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('pending','ready','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (bucket_id, object_key)
);

CREATE TABLE IF NOT EXISTS media_usage_daily (
  tenant_id uuid NOT NULL REFERENCES media_tenants(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  stored_bytes bigint NOT NULL DEFAULT 0,
  uploads bigint NOT NULL DEFAULT 0,
  deletes bigint NOT NULL DEFAULT 0,
  delivery_requests bigint NOT NULL DEFAULT 0,
  delivered_bytes bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, usage_date)
);

CREATE TABLE IF NOT EXISTS media_subscriptions (
  tenant_id uuid PRIMARY KEY REFERENCES media_tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'manual' CHECK (status IN ('trial','active','past_due','manual','cancelled')),
  payment_provider text CHECK (payment_provider IN ('nowpayments','bank_transfer','invoice')),
  external_customer_id text,
  external_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Operator-managed product configuration.
CREATE TABLE IF NOT EXISTS media_operator_settings (
  key text PRIMARY KEY,
  value_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS media_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  monthly_usd numeric(12,2) NOT NULL CHECK (monthly_usd >= 0),
  storage_bytes bigint NOT NULL CHECK (storage_bytes >= 0),
  delivery_bytes bigint NOT NULL CHECK (delivery_bytes >= 0),
  delivery_requests bigint NOT NULL CHECK (delivery_requests >= 0),
  logical_buckets integer NOT NULL CHECK (logical_buckets >= 0),
  team_seats integer NOT NULL CHECK (team_seats >= 1),
  max_object_bytes bigint NOT NULL CHECK (max_object_bytes > 0),
  overage_mode text NOT NULL CHECK (overage_mode IN ('hard-cap','prepaid-wallet')),
  dedicated_storage_eligible boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_memberships (
  tenant_id uuid NOT NULL REFERENCES media_tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES media_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member','billing')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS media_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES media_tenants(id) ON DELETE CASCADE,
  reference text UNIQUE NOT NULL,
  amount_usd numeric(12,2) NOT NULL CHECK (amount_usd > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('nowpayments','bank_transfer','invoice')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','rejected','cancelled')),
  provider_invoice_id text,
  provider_payment_id text,
  due_at timestamptz,
  paid_at timestamptz,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES media_invoices(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_event_id text,
  event_type text NOT NULL,
  payload_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_event_id)
);

CREATE TABLE IF NOT EXISTS media_prepaid_wallets (
  tenant_id uuid PRIMARY KEY REFERENCES media_tenants(id) ON DELETE CASCADE,
  balance_usd numeric(12,4) NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_quota_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES media_tenants(id) ON DELETE CASCADE,
  bucket_id uuid NOT NULL REFERENCES media_buckets(id) ON DELETE CASCADE,
  reservation_key text UNIQUE NOT NULL,
  reserved_bytes bigint NOT NULL CHECK (reserved_bytes > 0),
  expires_at timestamptz NOT NULL,
  committed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_audit_log (
  id bigserial PRIMARY KEY,
  tenant_id uuid REFERENCES media_tenants(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('customer','operator','system','payment')),
  actor_id text,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_objects_bucket_status_idx
  ON media_objects(bucket_id, status);
CREATE INDEX IF NOT EXISTS media_usage_daily_tenant_date_idx
  ON media_usage_daily(tenant_id, usage_date);
CREATE INDEX IF NOT EXISTS media_invoices_tenant_status_idx
  ON media_invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS media_audit_log_tenant_created_idx
  ON media_audit_log(tenant_id, created_at DESC);

ALTER TABLE media_users
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS media_users_username_lower_idx
  ON media_users (lower(username))
  WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS media_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES media_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_tenant_commercial_terms (
  tenant_id uuid PRIMARY KEY REFERENCES media_tenants(id) ON DELETE CASCADE,
  base_plan_code text NOT NULL,
  display_name text,
  monthly_usd numeric(12,2),
  storage_bytes bigint,
  delivery_bytes bigint,
  delivery_requests bigint,
  logical_buckets integer,
  team_seats integer,
  max_object_bytes bigint,
  overage_mode text CHECK (overage_mode IN ('hard-cap','prepaid-wallet')),
  enterprise_features boolean NOT NULL DEFAULT false,
  infrastructure_mode text NOT NULL DEFAULT 'automatic'
    CHECK (infrastructure_mode IN ('automatic','regional','dedicated')),
  billing_term_months integer NOT NULL DEFAULT 1 CHECK (billing_term_months IN (1,3,6,12)),
  custom_discount_percent numeric(5,2),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_manual_payment_nonces (
  nonce text PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES media_invoices(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS media_sessions_user_idx ON media_sessions(user_id);

-- Permit pre-payment tenants and subscriptions.
ALTER TABLE media_tenants DROP CONSTRAINT IF EXISTS media_tenants_status_check;
ALTER TABLE media_tenants ADD CONSTRAINT media_tenants_status_check
  CHECK (status IN ('pending','active','suspended','closed'));

ALTER TABLE media_subscriptions DROP CONSTRAINT IF EXISTS media_subscriptions_status_check;
ALTER TABLE media_subscriptions ADD CONSTRAINT media_subscriptions_status_check
  CHECK (status IN ('pending','trial','active','past_due','manual','cancelled'));

ALTER TABLE media_provider_accounts DROP CONSTRAINT IF EXISTS media_provider_accounts_provider_check;
ALTER TABLE media_provider_accounts ADD CONSTRAINT media_provider_accounts_provider_check
  CHECK (provider IN ('r2','oci','aws','gcs','azure','backblaze','wasabi','digitalocean'));

ALTER TABLE media_buckets ALTER COLUMN provider_account_id DROP NOT NULL;
ALTER TABLE media_buckets ADD COLUMN IF NOT EXISTS pool_key text NOT NULL DEFAULT 'r2-global';

ALTER TABLE media_provider_accounts
  ADD COLUMN IF NOT EXISTS pool_key text,
  ADD COLUMN IF NOT EXISTS available_to_customers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'unknown'
    CHECK (health_status IN ('unknown','healthy','degraded','offline'));

CREATE UNIQUE INDEX IF NOT EXISTS media_provider_accounts_pool_key_idx
  ON media_provider_accounts(pool_key)
  WHERE pool_key IS NOT NULL;
