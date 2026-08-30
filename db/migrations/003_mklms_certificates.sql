BEGIN;

CREATE TABLE IF NOT EXISTS certificate_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  background_asset_id TEXT,
  layout_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature_asset_id TEXT,
  certificate_prefix TEXT NOT NULL DEFAULT 'CERT',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS certificate_templates_active_idx
  ON certificate_templates (active, created_at);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  certificate_id TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES certificate_templates(id) ON DELETE SET NULL,
  certificate_name_snapshot TEXT NOT NULL,
  certificate_email_snapshot TEXT,
  completion_date DATE NOT NULL,
  pdf_asset_id TEXT,
  status TEXT NOT NULL DEFAULT 'ISSUED',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  emailed_at TIMESTAMPTZ,
  email_delivery_status TEXT NOT NULL DEFAULT 'PENDING',
  email_last_error TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS certificates_student_course_unique
  ON certificates (student_id, course_id);

CREATE INDEX IF NOT EXISTS certificates_public_lookup_idx
  ON certificates (certificate_id, status);

CREATE INDEX IF NOT EXISTS certificates_student_idx
  ON certificates (student_id, issued_at DESC);

COMMIT;
