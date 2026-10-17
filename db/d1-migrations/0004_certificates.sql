-- D1 certificate tables converted from PostgreSQL migration 003.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS certificate_templates(
 id TEXT PRIMARY KEY,name TEXT NOT NULL,background_asset_id TEXT,
 layout_config_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(layout_config_json)),
 signature_asset_id TEXT,certificate_prefix TEXT NOT NULL DEFAULT 'CERT',
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS certificate_templates_active_idx ON certificate_templates(active,created_at);
CREATE TABLE IF NOT EXISTS certificates(
 id TEXT PRIMARY KEY,certificate_id TEXT NOT NULL UNIQUE,
 student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 template_id TEXT REFERENCES certificate_templates(id) ON DELETE SET NULL,
 certificate_name_snapshot TEXT NOT NULL,certificate_email_snapshot TEXT,
 completion_date TEXT NOT NULL,pdf_asset_id TEXT,status TEXT NOT NULL DEFAULT 'ISSUED',
 issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,emailed_at TEXT,
 email_delivery_status TEXT NOT NULL DEFAULT 'PENDING',email_last_error TEXT,revoked_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS certificates_student_course_unique ON certificates(student_id,course_id);
CREATE INDEX IF NOT EXISTS certificates_public_lookup_idx ON certificates(certificate_id,status);
CREATE INDEX IF NOT EXISTS certificates_student_idx ON certificates(student_id,issued_at DESC);
