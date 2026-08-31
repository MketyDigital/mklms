BEGIN;

CREATE TABLE IF NOT EXISTS media_ingest_jobs (
  id TEXT PRIMARY KEY,
  media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'DRAFT',
  source_object_key TEXT,
  oci_job_id TEXT,
  oci_output_prefix TEXT,
  r2_prefix TEXT,
  r2_master_manifest TEXT,
  duration_minutes NUMERIC(12,3),
  estimated_cost_usd NUMERIC(12,6),
  cost_accepted_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_ingest_jobs_state_check CHECK (
    state IN ('DRAFT','SOURCE_UPLOADED','TRANSCODING','TRANSCODED','COPYING_TO_R2','VERIFYING','READY','FAILED')
  ),
  CONSTRAINT media_ingest_jobs_cost_check CHECK (
    estimated_cost_usd IS NULL OR estimated_cost_usd >= 0
  ),
  CONSTRAINT media_ingest_jobs_duration_check CHECK (
    duration_minutes IS NULL OR duration_minutes > 0
  )
);

CREATE INDEX IF NOT EXISTS media_ingest_jobs_state_idx
  ON media_ingest_jobs (state, updated_at DESC);
CREATE INDEX IF NOT EXISTS media_ingest_jobs_asset_idx
  ON media_ingest_jobs (media_asset_id);

CREATE TABLE IF NOT EXISTS media_watch_credits (
  grant_id TEXT PRIMARY KEY REFERENCES media_playback_grants(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  credited_seconds INTEGER NOT NULL DEFAULT 0,
  first_credited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_credited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_watch_credits_seconds_check CHECK (credited_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS media_watch_credits_month_idx
  ON media_watch_credits (last_credited_at DESC);

COMMIT;
