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
