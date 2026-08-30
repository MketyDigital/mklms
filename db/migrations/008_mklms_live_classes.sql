BEGIN;

CREATE TABLE IF NOT EXISTS live_batches (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  expected_viewer_baseline INTEGER NOT NULL DEFAULT 0,
  viewer_display_mode TEXT NOT NULL DEFAULT 'CONFIGURED_BASELINE',
  ended_message TEXT,
  ended_redirect_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_batches_viewer_baseline_check CHECK (expected_viewer_baseline >= 0),
  CONSTRAINT live_batches_viewer_mode_check CHECK (
    viewer_display_mode IN ('CONFIGURED_BASELINE','ACTIVE_ONLY','BASELINE_PLUS_ACTIVE')
  )
);

CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES live_batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  cta_text TEXT,
  cta_url TEXT,
  cta_reveal_offset_seconds INTEGER,
  ended_message TEXT,
  ended_redirect_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_sessions_duration_check CHECK (duration_seconds > 0),
  CONSTRAINT live_sessions_position_check CHECK (position BETWEEN 1 AND 3),
  CONSTRAINT live_sessions_cta_offset_check CHECK (
    cta_reveal_offset_seconds IS NULL OR cta_reveal_offset_seconds >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_batch_position_unique
  ON live_sessions (batch_id, position);
CREATE INDEX IF NOT EXISTS live_sessions_schedule_idx
  ON live_sessions (batch_id, status, starts_at);

CREATE TABLE IF NOT EXISTS live_timeline_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  offset_seconds INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  message TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_timeline_messages_offset_check CHECK (offset_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS live_timeline_messages_session_timeline_idx
  ON live_timeline_messages (session_id, offset_seconds, position);

CREATE TABLE IF NOT EXISTS live_viewers (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES live_batches(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES live_sessions(id) ON DELETE SET NULL,
  viewer_token_hash TEXT NOT NULL,
  display_name TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS live_viewers_batch_token_unique
  ON live_viewers (batch_id, viewer_token_hash);
CREATE INDEX IF NOT EXISTS live_viewers_active_idx
  ON live_viewers (batch_id, session_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS live_attendee_messages (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES live_batches(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL REFERENCES live_viewers(id) ON DELETE CASCADE,
  display_name_snapshot TEXT,
  message TEXT NOT NULL,
  read_by_admin_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS live_attendee_messages_admin_idx
  ON live_attendee_messages (batch_id, session_id, read_by_admin_at, created_at DESC);
CREATE INDEX IF NOT EXISTS live_attendee_messages_viewer_idx
  ON live_attendee_messages (viewer_id, session_id, created_at ASC);

COMMIT;
