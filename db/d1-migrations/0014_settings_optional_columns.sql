-- SQLite schema parity for platform settings added by PostgreSQL 012 and 017.
-- No runtime routing or production data changes.
PRAGMA foreign_keys=ON;
ALTER TABLE platform_settings ADD COLUMN completion_community_url TEXT;
ALTER TABLE platform_settings ADD COLUMN font_family TEXT;
