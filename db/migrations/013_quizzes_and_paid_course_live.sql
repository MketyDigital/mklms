BEGIN;

-- First-class paid-course quizzes. These tables are intentionally separate from
-- lessons so existing lesson progress and media playback remain compatible.
CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  pass_mark_percent INTEGER NOT NULL DEFAULT 70,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quizzes_pass_mark_check CHECK (pass_mark_percent BETWEEN 1 AND 100),
  CONSTRAINT quizzes_status_check CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS quizzes_module_position_unique
  ON quizzes (module_id, position);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS quiz_questions_position_unique
  ON quiz_questions (quiz_id, position);

CREATE TABLE IF NOT EXISTS quiz_choices (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS quiz_choices_position_unique
  ON quiz_choices (question_id, position);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  score_percent INTEGER NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quiz_attempts_score_check CHECK (score_percent BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS quiz_attempts_student_course_idx
  ON quiz_attempts (student_id, course_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS quiz_attempts_student_quiz_idx
  ON quiz_attempts (student_id, quiz_id, passed, completed_at DESC);

CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  selected_choice_id TEXT REFERENCES quiz_choices(id) ON DELETE SET NULL,
  correct BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempt_answers_attempt_question_unique
  ON quiz_attempt_answers (attempt_id, question_id);

-- Paid-course live is deliberately NOT stored in live_classes/live_class_sessions.
-- The existing public/free webinar subsystem remains independent and unchanged.
CREATE TABLE IF NOT EXISTS paid_course_live_sessions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT paid_course_live_time_check CHECK (ends_at > starts_at),
  CONSTRAINT paid_course_live_status_check CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS paid_course_live_course_schedule_idx
  ON paid_course_live_sessions (course_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS paid_course_live_status_schedule_idx
  ON paid_course_live_sessions (status, starts_at, ends_at);

COMMIT;
