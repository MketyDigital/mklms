BEGIN;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS assignment_mode TEXT NOT NULL DEFAULT 'SELECTED_STUDENTS';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'courses_assignment_mode_check'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_assignment_mode_check
      CHECK (assignment_mode IN ('SELECTED_STUDENTS', 'ALL_ACTIVE_STUDENTS'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS courses_assignment_mode_status_idx
  ON courses (assignment_mode, status);

COMMIT;
