-- D1 media metadata converted from PostgreSQL migration 004.
-- R2 objects are not moved. Media foreign keys in lessons/live_sessions must
-- be added in a separate reviewed SQLite table-rebuild migration.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS media_assets(
 id TEXT PRIMARY KEY,title TEXT NOT NULL,provider TEXT NOT NULL,source_type TEXT NOT NULL,
 provider_asset_id TEXT,origin_reference TEXT,playback_reference TEXT,duration_seconds INTEGER,
 poster_asset_id TEXT,processing_status TEXT NOT NULL DEFAULT 'PENDING',
 metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json)),
 watermark_config_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(watermark_config_json)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS media_assets_provider_idx ON media_assets(provider,processing_status);
CREATE INDEX IF NOT EXISTS media_assets_source_type_idx ON media_assets(source_type,processing_status);
