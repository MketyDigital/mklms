BEGIN;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS assignment_mode TEXT NOT NULL DEFAULT 'SELECTED_STUDENTS';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'courses_assignment_mode_check'
      AND conrelid = 'courses'::regclass
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_assignment_mode_check
      CHECK (assignment_mode IN ('SELECTED_STUDENTS', 'ALL_ACTIVE_STUDENTS'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS courses_assignment_mode_status_idx
  ON courses (assignment_mode, status);

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

  INSERT INTO enrollments (
    id, student_id, course_id, status, authorized_at, activated_at
  )
  SELECT
    md5(NEW.id || ':' || c.id || ':all-active'),
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

DROP TRIGGER IF EXISTS mklms_students_all_active_course_enrollment ON students;
CREATE TRIGGER mklms_students_all_active_course_enrollment
AFTER INSERT OR UPDATE OF status ON students
FOR EACH ROW
EXECUTE FUNCTION mklms_enroll_active_student_in_all_courses();

COMMIT;
