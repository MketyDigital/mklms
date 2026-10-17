-- SQLite equivalent of the free webinar attendee visibility addition in PG 014.
-- Separate from paid_course_live_sessions: changing chat visibility must not
-- modify broadcast playback timing or media delivery behavior.
PRAGMA foreign_keys=ON;
ALTER TABLE live_batches ADD COLUMN attendee_chat_visibility TEXT NOT NULL DEFAULT 'OWNER_ONLY'
 CHECK(attendee_chat_visibility IN ('OWNER_ONLY','PUBLIC'));
