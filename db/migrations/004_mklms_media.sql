BEGIN;

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  provider TEXT NOT NULL,
  source_type TEXT NOT NULL,
  provider_asset_id TEXT,
  origin_reference TEXT,
  playback_reference TEXT,
  duration_seconds INTEGER,
  poster_asset_id TEXT,
  processing_status TEXT NOT NULL DEFAULT 'PENDING',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  watermark_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS media_assets_provider_idx
  ON media_assets (provider, processing_status);

CREATE INDEX IF NOT EXISTS media_assets_source_type_idx
  ON media_assets (source_type, processing_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lessons_media_asset_fk'
  ) THEN
    ALTER TABLE lessons
      ADD CONSTRAINT lessons_media_asset_fk
      FOREIGN KEY (media_asset_id)
      REFERENCES media_assets(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS media_playback_grants (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  media_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_playback_grants_time_check CHECK (expires_at > started_at)
);

CREATE INDEX IF NOT EXISTS media_playback_grants_student_lesson_idx
  ON media_playback_grants (student_id, lesson_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS media_playback_grants_active_idx
  ON media_playback_grants (id, expires_at)
  WHERE revoked_at IS NULL;

COMMIT;
