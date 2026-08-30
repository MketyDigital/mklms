BEGIN;

CREATE TABLE IF NOT EXISTS message_threads (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('STUDENT', 'ADMIN')),
  sender_name_snapshot TEXT NOT NULL,
  text TEXT NOT NULL,
  context_type TEXT,
  context_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_by_student_at TIMESTAMPTZ,
  read_by_admin_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS messages_thread_created_idx
  ON messages (thread_id, created_at);

CREATE INDEX IF NOT EXISTS messages_admin_unread_idx
  ON messages (thread_id, created_at)
  WHERE sender_role = 'STUDENT' AND read_by_admin_at IS NULL;

CREATE INDEX IF NOT EXISTS messages_student_unread_idx
  ON messages (thread_id, created_at)
  WHERE sender_role = 'ADMIN' AND read_by_student_at IS NULL;

COMMIT;
