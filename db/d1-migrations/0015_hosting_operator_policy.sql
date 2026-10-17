-- PostgreSQL 011 drops legacy managed_hosting_settings, and 015 introduces
-- singleton operator policy. This migration makes SQLite match the final PG
-- data model rather than preserving a stale settings table.
PRAGMA foreign_keys=ON;
DROP TABLE IF EXISTS managed_hosting_settings;
CREATE TABLE IF NOT EXISTS managed_hosting_operator_policy (
 id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id=1),
 configured INTEGER NOT NULL DEFAULT 0 CHECK(configured IN (0,1)),
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 minimum_monthly_fee_cents INTEGER NOT NULL DEFAULT 1500 CHECK(minimum_monthly_fee_cents>=0),
 maximum_monthly_fee_cents INTEGER NOT NULL DEFAULT 5000
   CHECK(maximum_monthly_fee_cents>=minimum_monthly_fee_cents),
 display_title TEXT NOT NULL DEFAULT 'Managed Video Hosting & Maintenance',
 display_description TEXT,notice TEXT,overdue_warning TEXT,
 due_days_after_month_end INTEGER NOT NULL DEFAULT 5 CHECK(due_days_after_month_end BETWEEN 0 AND 31),
 grace_days INTEGER NOT NULL DEFAULT 5 CHECK(grace_days BETWEEN 0 AND 31),
 enforcement_enabled INTEGER NOT NULL DEFAULT 1 CHECK(enforcement_enabled IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO managed_hosting_operator_policy(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
ALTER TABLE managed_hosting_months ADD COLUMN amount_due_cents INTEGER
 CHECK(amount_due_cents IS NULL OR amount_due_cents>=0);
ALTER TABLE managed_hosting_months ADD COLUMN due_at TEXT;
ALTER TABLE managed_hosting_months ADD COLUMN grace_ends_at TEXT;
ALTER TABLE managed_hosting_months ADD COLUMN finalized_at TEXT;
-- PostgreSQL 006 adds course-scoped templates; SQLite 0004 did not.
ALTER TABLE certificate_templates ADD COLUMN course_id TEXT REFERENCES courses(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS certificate_templates_course_active_idx
 ON certificate_templates(course_id,active,updated_at DESC);
