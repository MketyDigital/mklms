BEGIN;

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS completion_community_url TEXT;

COMMIT;
