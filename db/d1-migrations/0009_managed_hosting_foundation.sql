-- Development-only SQLite implementation of managed hosting settings (PG 009)
-- and monthly status records (PG 010). Financial values use integer US cents.
-- Adapters MUST convert existing numeric USD to cents losslessly, with rounding
-- rules reviewed, before any customer data migration. No runtime switch.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS managed_hosting_settings (
 id TEXT PRIMARY KEY DEFAULT 'default',
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 minimum_monthly_fee_cents INTEGER NOT NULL DEFAULT 1500 CHECK(minimum_monthly_fee_cents>=0),
 maximum_monthly_fee_cents INTEGER NOT NULL DEFAULT 5000,
 current_monthly_fee_cents INTEGER NOT NULL DEFAULT 1500,
 payment_network TEXT NOT NULL DEFAULT 'TRC20' CHECK(payment_network IN ('TRC20','TON','CUSTOM')),
 wallet_address TEXT NOT NULL DEFAULT '',payment_note TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(maximum_monthly_fee_cents>=minimum_monthly_fee_cents),
 CHECK(current_monthly_fee_cents BETWEEN minimum_monthly_fee_cents AND maximum_monthly_fee_cents)
);
INSERT INTO managed_hosting_settings(id) VALUES ('default') ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS managed_hosting_months (
 month_key TEXT PRIMARY KEY,
 minimum_floor_cents INTEGER NOT NULL DEFAULT 1500 CHECK(minimum_floor_cents>=0),
 operator_note TEXT,payment_status TEXT NOT NULL DEFAULT 'PENDING'
 CHECK(payment_status IN ('PENDING','PAID','WAIVED')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS managed_hosting_months_updated_idx ON managed_hosting_months(updated_at DESC);
