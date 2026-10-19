BEGIN;

-- Durable replication substrate only. No source capture or replay is enabled by
-- this migration; runtime wiring remains disabled until both are implemented.
CREATE TABLE mklms_replication_journal (
  sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  installation_id TEXT NOT NULL,
  source_backend TEXT NOT NULL CHECK (source_backend IN ('postgresql', 'd1')),
  source_epoch BIGINT NOT NULL CHECK (source_epoch > 0),
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  transaction_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_key JSONB NOT NULL CHECK (jsonb_typeof(record_key) IN ('object', 'array')),
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  payload JSONB,
  idempotency_key TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT mklms_replication_payload_matches_operation CHECK (
    (operation = 'DELETE' AND payload IS NULL) OR
    (operation IN ('INSERT', 'UPDATE') AND payload IS NOT NULL AND jsonb_typeof(payload) = 'object')
  ),
  CONSTRAINT mklms_replication_idempotency_unique UNIQUE (installation_id, idempotency_key)
);

CREATE INDEX mklms_replication_journal_replay_idx
  ON mklms_replication_journal (installation_id, source_backend, source_epoch, sequence);

CREATE TABLE mklms_replication_checkpoints (
  installation_id TEXT NOT NULL,
  source_backend TEXT NOT NULL CHECK (source_backend IN ('postgresql', 'd1')),
  target_backend TEXT NOT NULL CHECK (target_backend IN ('postgresql', 'd1')),
  source_epoch BIGINT NOT NULL CHECK (source_epoch > 0),
  last_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  last_batch_checksum TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (installation_id, source_backend, target_backend),
  CONSTRAINT mklms_replication_checkpoint_direction CHECK (source_backend <> target_backend)
);

CREATE TABLE mklms_replication_apply_receipts (
  installation_id TEXT NOT NULL,
  source_backend TEXT NOT NULL CHECK (source_backend IN ('postgresql', 'd1')),
  target_backend TEXT NOT NULL CHECK (target_backend IN ('postgresql', 'd1')),
  source_epoch BIGINT NOT NULL CHECK (source_epoch > 0),
  sequence BIGINT NOT NULL CHECK (sequence > 0),
  idempotency_key TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (installation_id, source_backend, target_backend, source_epoch, sequence),
  CONSTRAINT mklms_replication_receipt_direction CHECK (source_backend <> target_backend),
  CONSTRAINT mklms_replication_receipt_idempotency_unique
    UNIQUE (installation_id, source_backend, target_backend, idempotency_key)
);

CREATE TABLE mklms_replication_dead_letters (
  installation_id TEXT NOT NULL,
  source_backend TEXT NOT NULL CHECK (source_backend IN ('postgresql', 'd1')),
  target_backend TEXT NOT NULL CHECK (target_backend IN ('postgresql', 'd1')),
  source_epoch BIGINT NOT NULL CHECK (source_epoch > 0),
  sequence BIGINT NOT NULL CHECK (sequence > 0),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  next_attempt_at TIMESTAMPTZ,
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (installation_id, source_backend, target_backend, source_epoch, sequence),
  CONSTRAINT mklms_replication_dead_letter_direction CHECK (source_backend <> target_backend)
);

CREATE INDEX mklms_replication_dead_letters_retry_idx
  ON mklms_replication_dead_letters (installation_id, next_attempt_at)
  WHERE next_attempt_at IS NOT NULL;

COMMIT;
