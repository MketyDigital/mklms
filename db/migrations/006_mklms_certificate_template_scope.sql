BEGIN;

ALTER TABLE certificate_templates
  ADD COLUMN IF NOT EXISTS course_id TEXT REFERENCES courses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS certificate_templates_course_active_idx
  ON certificate_templates (course_id, active, updated_at DESC);

COMMIT;
