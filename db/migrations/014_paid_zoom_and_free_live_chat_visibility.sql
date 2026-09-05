BEGIN;

ALTER TABLE paid_course_live_sessions
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'MEDIA';

ALTER TABLE paid_course_live_sessions
  ADD COLUMN IF NOT EXISTS zoom_url TEXT;

DO $$
BEGIN
  ALTER TABLE paid_course_live_sessions
    ADD CONSTRAINT paid_course_live_sessions_delivery_mode_check
    CHECK (delivery_mode IN ('MEDIA', 'ZOOM'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE live_batches
  ADD COLUMN IF NOT EXISTS attendee_chat_visibility TEXT NOT NULL DEFAULT 'OWNER_ONLY';

DO $$
BEGIN
  ALTER TABLE live_batches
    ADD CONSTRAINT live_batches_attendee_chat_visibility_check
    CHECK (attendee_chat_visibility IN ('OWNER_ONLY', 'PUBLIC'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
