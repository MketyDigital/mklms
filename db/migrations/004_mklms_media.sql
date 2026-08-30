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

COMMIT;
