BEGIN;

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS courses_status_position_idx
  ON courses (status, position);

CREATE TABLE IF NOT EXISTS course_modules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS course_modules_position_unique
  ON course_modules (course_id, position);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  media_asset_id TEXT,
  completion_mode TEXT NOT NULL DEFAULT 'VIDEO_PROGRESS',
  completion_threshold_percent INTEGER NOT NULL DEFAULT 90,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lessons_completion_threshold_check
    CHECK (completion_threshold_percent BETWEEN 1 AND 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS lessons_position_unique
  ON lessons (module_id, position);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lesson_progress_percent_check
    CHECK (progress_percent BETWEEN 0 AND 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS lesson_progress_student_lesson_unique
  ON lesson_progress (student_id, lesson_id);

CREATE INDEX IF NOT EXISTS lesson_progress_student_course_idx
  ON lesson_progress (student_id, course_id);

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_progress_percent_check
  CHECK (progress_percent BETWEEN 0 AND 100) NOT VALID;

COMMIT;
