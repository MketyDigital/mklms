-- D1 development schema corresponding to PostgreSQL migration 013 plus 014 columns.
-- Requires D1 foundation, learning and media tables. Not a production cutover.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS quizzes (
 id TEXT PRIMARY KEY, module_id TEXT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT,
 pass_mark_percent INTEGER NOT NULL DEFAULT 70 CHECK(pass_mark_percent BETWEEN 1 AND 100),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED')),
 position INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_module_position_unique ON quizzes(module_id,position);
CREATE TABLE IF NOT EXISTS quiz_questions (
 id TEXT PRIMARY KEY,quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
 prompt TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_questions_position_unique ON quiz_questions(quiz_id,position);
CREATE TABLE IF NOT EXISTS quiz_choices (
 id TEXT PRIMARY KEY,question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
 label TEXT NOT NULL,is_correct INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0,1)),
 position INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_choices_position_unique ON quiz_choices(question_id,position);
CREATE TABLE IF NOT EXISTS quiz_attempts (
 id TEXT PRIMARY KEY,quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
 student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 score_percent INTEGER NOT NULL CHECK(score_percent BETWEEN 0 AND 100),
 passed INTEGER NOT NULL DEFAULT 0 CHECK(passed IN (0,1)),
 started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS quiz_attempts_student_course_idx ON quiz_attempts(student_id,course_id,completed_at DESC);
CREATE INDEX IF NOT EXISTS quiz_attempts_student_quiz_idx ON quiz_attempts(student_id,quiz_id,passed,completed_at DESC);
CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
 id TEXT PRIMARY KEY,attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
 question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
 selected_choice_id TEXT REFERENCES quiz_choices(id) ON DELETE SET NULL,
 correct INTEGER NOT NULL DEFAULT 0 CHECK(correct IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempt_answers_attempt_question_unique ON quiz_attempt_answers(attempt_id,question_id);
CREATE TABLE IF NOT EXISTS paid_course_live_sessions (
 id TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
 title TEXT NOT NULL,description TEXT,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED')),
 delivery_mode TEXT NOT NULL DEFAULT 'MEDIA' CHECK(delivery_mode IN ('MEDIA','ZOOM')),
 zoom_url TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT paid_course_live_time_check CHECK(ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS paid_course_live_course_schedule_idx ON paid_course_live_sessions(course_id,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS paid_course_live_status_schedule_idx ON paid_course_live_sessions(status,starts_at,ends_at);
