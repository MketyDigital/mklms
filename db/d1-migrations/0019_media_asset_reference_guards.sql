-- Match PostgreSQL's deferred media references without rebuilding populated
-- lessons/live_sessions tables. Preserve SET NULL behavior when an asset is removed.
PRAGMA foreign_keys=ON;

CREATE TRIGGER IF NOT EXISTS lessons_media_asset_fk_insert
BEFORE INSERT ON lessons
WHEN NEW.media_asset_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM media_assets WHERE id=NEW.media_asset_id)
BEGIN
 SELECT RAISE(ABORT,'FOREIGN KEY constraint failed');
END;
CREATE TRIGGER IF NOT EXISTS lessons_media_asset_fk_update
BEFORE UPDATE OF media_asset_id ON lessons
WHEN NEW.media_asset_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM media_assets WHERE id=NEW.media_asset_id)
BEGIN
 SELECT RAISE(ABORT,'FOREIGN KEY constraint failed');
END;
CREATE TRIGGER IF NOT EXISTS media_assets_lessons_set_null
AFTER DELETE ON media_assets
BEGIN
 UPDATE lessons SET media_asset_id=NULL WHERE media_asset_id=OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS live_sessions_media_asset_fk_insert
BEFORE INSERT ON live_sessions
WHEN NEW.media_asset_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM media_assets WHERE id=NEW.media_asset_id)
BEGIN
 SELECT RAISE(ABORT,'FOREIGN KEY constraint failed');
END;
CREATE TRIGGER IF NOT EXISTS live_sessions_media_asset_fk_update
BEFORE UPDATE OF media_asset_id ON live_sessions
WHEN NEW.media_asset_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM media_assets WHERE id=NEW.media_asset_id)
BEGIN
 SELECT RAISE(ABORT,'FOREIGN KEY constraint failed');
END;
CREATE TRIGGER IF NOT EXISTS media_assets_live_sessions_set_null
AFTER DELETE ON media_assets
BEGIN
 UPDATE live_sessions SET media_asset_id=NULL WHERE media_asset_id=OLD.id;
END;
