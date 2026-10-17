BEGIN;

-- Keep newly trigger-generated enrollment keys byte-for-byte compatible with
-- D1's SQLite JSON tuple encoding. Existing enrollment IDs are never rewritten.
CREATE OR REPLACE FUNCTION mklms_enroll_active_student_in_all_courses()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(764551001);

  INSERT INTO enrollments (
    id, student_id, course_id, status, authorized_at, activated_at
  )
  SELECT
    encode(convert_to('[' || to_json(NEW.id)::text || ',' || to_json(c.id)::text || ',"all-active"]', 'UTF8'), 'hex'),
    NEW.id,
    c.id,
    'ACTIVE',
    NOW(),
    NOW()
  FROM courses c
  WHERE c.assignment_mode = 'ALL_ACTIVE_STUDENTS'
  ON CONFLICT (student_id, course_id)
  DO UPDATE SET
    status = CASE
      WHEN enrollments.status = 'COMPLETED' THEN 'COMPLETED'
      ELSE 'ACTIVE'
    END,
    activated_at = CASE
      WHEN enrollments.status = 'COMPLETED' THEN enrollments.activated_at
      ELSE NOW()
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
