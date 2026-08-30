BEGIN;

CREATE TABLE IF NOT EXISTS platform_settings (
  id TEXT PRIMARY KEY,
  organization_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  support_name TEXT,
  support_email TEXT,
  public_base_url TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  locale TEXT NOT NULL DEFAULT 'en',
  access_provider TEXT NOT NULL DEFAULT 'access-code',
  claim_verification_strategy TEXT NOT NULL DEFAULT 'preauth-only',
  storage_provider TEXT NOT NULL DEFAULT 'custom',
  media_provider TEXT NOT NULL DEFAULT 'generic-hls',
  email_provider TEXT NOT NULL DEFAULT 'none',
  notification_provider TEXT NOT NULL DEFAULT 'none',
  access_code_prefix TEXT NOT NULL DEFAULT 'ACCESS',
  certificate_prefix TEXT NOT NULL DEFAULT 'CERT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  certificate_name TEXT NOT NULL,
  certificate_email TEXT,
  certificate_identity_locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS students_email_unique
  ON students (LOWER(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS students_phone_idx
  ON students (phone)
  WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS preauthorizations (
  id TEXT PRIMARY KEY,
  email TEXT,
  phone TEXT,
  name_hint TEXT,
  course_id TEXT,
  claim_strategy TEXT NOT NULL DEFAULT 'preauth-only',
  claim_code_hash TEXT,
  claim_requested_at TIMESTAMPTZ,
  manual_approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PREAUTHORIZED',
  claimed_by_student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  external_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT preauthorizations_identity_check
    CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS preauthorizations_email_idx
  ON preauthorizations (LOWER(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS preauthorizations_phone_idx
  ON preauthorizations (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS preauthorizations_status_idx
  ON preauthorizations (status);

CREATE UNIQUE INDEX IF NOT EXISTS preauthorizations_active_email_course_unique
  ON preauthorizations (LOWER(email), COALESCE(course_id, ''))
  WHERE email IS NOT NULL AND status IN ('PREAUTHORIZED', 'CLAIMED');

CREATE UNIQUE INDEX IF NOT EXISTS preauthorizations_active_phone_course_unique
  ON preauthorizations (phone, COALESCE(course_id, ''))
  WHERE phone IS NOT NULL AND status IN ('PREAUTHORIZED', 'CLAIMED');

CREATE TABLE IF NOT EXISTS student_access_credentials (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL DEFAULT 'access-code',
  credential_lookup_hash TEXT NOT NULL,
  credential_hash TEXT NOT NULL,
  credential_salt TEXT NOT NULL,
  credential_algorithm TEXT NOT NULL DEFAULT 'scrypt',
  credential_prefix TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS student_access_active_provider_unique
  ON student_access_credentials (student_id, provider_type)
  WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS student_access_lookup_unique
  ON student_access_credentials (credential_lookup_hash)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS enrollments_student_course_unique
  ON enrollments (student_id, course_id);

CREATE TABLE IF NOT EXISTS student_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS student_sessions_student_idx
  ON student_sessions (student_id);

CREATE INDEX IF NOT EXISTS student_sessions_active_idx
  ON student_sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;

COMMIT;
