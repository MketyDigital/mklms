PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media_plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_usd REAL NOT NULL,
  storage_bytes INTEGER NOT NULL,
  delivery_bytes INTEGER NOT NULL,
  delivery_requests INTEGER NOT NULL,
  logical_buckets INTEGER NOT NULL,
  team_seats INTEGER NOT NULL,
  max_object_bytes INTEGER NOT NULL,
  overage_mode TEXT NOT NULL CHECK (overage_mode IN ('hard-cap','prepaid-wallet')),
  dedicated_storage_eligible INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 100,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_tenants (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','closed')),
  plan_code TEXT NOT NULL REFERENCES media_plans(code),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  activated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_memberships (
  tenant_id TEXT NOT NULL REFERENCES media_tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES media_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member','billing')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id,user_id)
);

CREATE TABLE IF NOT EXISTS media_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES media_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS media_sessions_user_idx ON media_sessions(user_id);

CREATE TABLE IF NOT EXISTS media_subscriptions (
  tenant_id TEXT PRIMARY KEY REFERENCES media_tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','trial','active','past_due','manual','cancelled')),
  payment_provider TEXT CHECK (payment_provider IN ('nowpayments','bank_transfer','invoice')),
  external_customer_id TEXT,
  external_subscription_id TEXT,
  current_period_end TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_tenant_commercial_terms (
  tenant_id TEXT PRIMARY KEY REFERENCES media_tenants(id) ON DELETE CASCADE,
  base_plan_code TEXT NOT NULL REFERENCES media_plans(code),
  display_name TEXT,
  monthly_usd REAL,
  storage_bytes INTEGER,
  delivery_bytes INTEGER,
  delivery_requests INTEGER,
  logical_buckets INTEGER,
  team_seats INTEGER,
  max_object_bytes INTEGER,
  overage_mode TEXT CHECK (overage_mode IN ('hard-cap','prepaid-wallet')),
  enterprise_features INTEGER NOT NULL DEFAULT 0,
  infrastructure_mode TEXT NOT NULL DEFAULT 'automatic' CHECK (infrastructure_mode IN ('automatic','regional','dedicated')),
  billing_term_months INTEGER NOT NULL DEFAULT 1 CHECK (billing_term_months IN (1,3,6,12)),
  custom_discount_percent REAL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_buckets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES media_tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  pool_key TEXT NOT NULL DEFAULT 'r2-global',
  prefix TEXT NOT NULL,
  public_read INTEGER NOT NULL DEFAULT 1,
  cache_control TEXT NOT NULL DEFAULT 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id,slug),
  UNIQUE (pool_key,prefix)
);

CREATE TABLE IF NOT EXISTS media_objects (
  id TEXT PRIMARY KEY,
  bucket_id TEXT NOT NULL REFERENCES media_buckets(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  etag TEXT,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending','ready','deleted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE (bucket_id,object_key)
);
CREATE INDEX IF NOT EXISTS media_objects_bucket_status_idx ON media_objects(bucket_id,status);

CREATE TABLE IF NOT EXISTS media_usage_daily (
  tenant_id TEXT NOT NULL REFERENCES media_tenants(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  stored_bytes INTEGER NOT NULL DEFAULT 0,
  uploads INTEGER NOT NULL DEFAULT 0,
  deletes INTEGER NOT NULL DEFAULT 0,
  delivery_requests INTEGER NOT NULL DEFAULT 0,
  delivered_bytes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id,usage_date)
);

CREATE TABLE IF NOT EXISTS media_invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES media_tenants(id) ON DELETE CASCADE,
  reference TEXT UNIQUE NOT NULL,
  amount_usd REAL NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('nowpayments','bank_transfer','invoice')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','rejected','cancelled')),
  provider_invoice_id TEXT,
  provider_payment_id TEXT,
  due_at TEXT,
  paid_at TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS media_invoices_tenant_status_idx ON media_invoices(tenant_id,status);

CREATE TABLE IF NOT EXISTS media_payment_events (
  id TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES media_invoices(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_event_id TEXT,
  event_type TEXT NOT NULL,
  payload_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider,external_event_id)
);

CREATE TABLE IF NOT EXISTS media_prepaid_wallets (
  tenant_id TEXT PRIMARY KEY REFERENCES media_tenants(id) ON DELETE CASCADE,
  balance_usd REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_quota_reservations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES media_tenants(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL REFERENCES media_buckets(id) ON DELETE CASCADE,
  reservation_key TEXT UNIQUE NOT NULL,
  reserved_bytes INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  committed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_operator_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS media_provider_pools (
  pool_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  provider TEXT NOT NULL,
  region_label TEXT,
  available_to_customers INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 100,
  health_status TEXT NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('unknown','healthy','degraded','offline')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES media_tenants(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('customer','operator','system','payment')),
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_manual_payment_nonces (
  nonce TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES media_invoices(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

INSERT OR IGNORE INTO media_plans
(code,name,monthly_usd,storage_bytes,delivery_bytes,delivery_requests,logical_buckets,team_seats,max_object_bytes,overage_mode,dedicated_storage_eligible,active,display_order)
VALUES
('starter','Starter',5,10737418240,107374182400,1000000,3,1,2147483648,'hard-cap',0,1,10),
('growth','Growth',15,53687091200,536870912000,5000000,10,3,10737418240,'hard-cap',0,1,20),
('business','Business',39,214748364800,2147483648000,20000000,50,10,26843545600,'hard-cap',1,1,30),
('enterprise','Enterprise',99,536870912000,5368709120000,50000000,250,25,53687091200,'hard-cap',1,1,40);

INSERT OR IGNORE INTO media_provider_pools
(pool_key,label,provider,region_label,available_to_customers,priority,health_status)
VALUES
('r2-global','Mkety Global','r2','Global',1,10,'unknown'),
('oci-johannesburg','Mkety Africa','oci','Johannesburg',0,20,'unknown'),
('aws-s3','Mkety Regional','aws',NULL,0,50,'unknown'),
('google-cloud-storage','Mkety Regional','gcs',NULL,0,50,'unknown'),
('azure-blob','Mkety Regional','azure',NULL,0,50,'unknown'),
('backblaze-b2','Mkety Storage','backblaze',NULL,0,60,'unknown'),
('wasabi','Mkety Storage','wasabi',NULL,0,60,'unknown'),
('digitalocean-spaces','Mkety Storage','digitalocean',NULL,0,60,'unknown');

ALTER TABLE media_invoices ADD COLUMN amount_local REAL;
ALTER TABLE media_invoices ADD COLUMN local_currency TEXT;
