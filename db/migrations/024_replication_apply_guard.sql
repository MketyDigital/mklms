BEGIN;

-- The target applier sets this flag transactionally to avoid replaying derived
-- source-side enrollment and capture events. It is never an authority switch.
ALTER TABLE mklms_replication_config
  ADD COLUMN apply_in_progress BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION mklms_capture_replication_change()
RETURNS TRIGGER AS $$
DECLARE
  config_row mklms_replication_config%ROWTYPE;
  source_row JSONB;
  record_key_value JSONB := '{}'::JSONB;
  key_column TEXT;
  operation_value TEXT;
BEGIN
  SELECT * INTO config_row
  FROM mklms_replication_config
  WHERE singleton = 1 AND source_backend = 'postgresql'
    AND capture_enabled = TRUE AND apply_in_progress = FALSE;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(764551002);

  IF TG_OP = 'DELETE' THEN
    source_row := to_jsonb(OLD);
    operation_value := 'DELETE';
  ELSE
    source_row := to_jsonb(NEW);
    operation_value := TG_OP;
  END IF;

  FOR key_column IN
    SELECT jsonb_array_elements_text(TG_ARGV[0]::JSONB)
  LOOP
    record_key_value := record_key_value || jsonb_build_object(key_column, source_row -> key_column);
  END LOOP;

  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version,
    transaction_id, table_name, record_key, operation, payload, idempotency_key
  ) VALUES (
    config_row.installation_id, 'postgresql', config_row.authority_epoch,
    config_row.schema_version, txid_current()::TEXT, TG_TABLE_NAME,
    record_key_value, operation_value,
    CASE WHEN operation_value = 'DELETE' THEN NULL ELSE source_row END,
    md5(txid_current()::TEXT || ':' || TG_TABLE_NAME || ':' || clock_timestamp()::TEXT || ':' || random()::TEXT)
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mklms_enroll_active_student_in_all_courses()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM mklms_replication_config
    WHERE singleton = 1 AND apply_in_progress = TRUE
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'ACTIVE' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  PERFORM pg_advisory_xact_lock(764551001);
  INSERT INTO enrollments (id, student_id, course_id, status, authorized_at, activated_at)
  SELECT
    encode(convert_to('[' || to_json(NEW.id)::text || ',' || to_json(c.id)::text || ',"all-active"]', 'UTF8'), 'hex'),
    NEW.id, c.id, 'ACTIVE', NOW(), NOW()
  FROM courses c
  WHERE c.assignment_mode = 'ALL_ACTIVE_STUDENTS'
  ON CONFLICT (student_id, course_id)
  DO UPDATE SET
    status = CASE WHEN enrollments.status = 'COMPLETED' THEN 'COMPLETED' ELSE 'ACTIVE' END,
    activated_at = CASE WHEN enrollments.status = 'COMPLETED' THEN enrollments.activated_at ELSE NOW() END,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
