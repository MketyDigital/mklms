BEGIN;

-- Capture is opt-in. An absent row or disabled flag leaves application writes
-- untouched; enabling it makes each journal insert part of the source write.
CREATE TABLE mklms_replication_config (
  singleton SMALLINT PRIMARY KEY DEFAULT 1 CHECK (singleton = 1),
  installation_id TEXT NOT NULL UNIQUE,
  source_backend TEXT NOT NULL CHECK (source_backend IN ('postgresql', 'd1')),
  authority_epoch BIGINT NOT NULL CHECK (authority_epoch > 0),
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  capture_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION mklms_capture_replication_change()
RETURNS TRIGGER AS $$
DECLARE
  config_row mklms_replication_config%ROWTYPE;
  source_row JSONB;
  record_key_value JSONB := '{}'::JSONB;
  key_column TEXT;
  operation_value TEXT;
BEGIN
  SELECT * INTO config_row
  FROM mklms_replication_config
  WHERE singleton = 1 AND source_backend = 'postgresql' AND capture_enabled = TRUE;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- A transaction-level global lock makes identity sequences commit-ordered;
  -- the staging load test must validate this serialization cost before use.
  PERFORM pg_advisory_xact_lock(764551002);

  IF TG_OP = 'DELETE' THEN
    source_row := to_jsonb(OLD);
    operation_value := 'DELETE';
  ELSE
    source_row := to_jsonb(NEW);
    operation_value := TG_OP;
  END IF;

  FOR key_column IN
    SELECT jsonb_array_elements_text(TG_ARGV[0]::JSONB)
  LOOP
    record_key_value := record_key_value || jsonb_build_object(key_column, source_row -> key_column);
  END LOOP;

  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version,
    transaction_id, table_name, record_key, operation, payload, idempotency_key
  ) VALUES (
    config_row.installation_id,
    'postgresql',
    config_row.authority_epoch,
    config_row.schema_version,
    txid_current()::TEXT,
    TG_TABLE_NAME,
    record_key_value,
    operation_value,
    CASE WHEN operation_value = 'DELETE' THEN NULL ELSE source_row END,
    md5(txid_current()::TEXT || ':' || TG_TABLE_NAME || ':' || clock_timestamp()::TEXT || ':' || random()::TEXT)
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  table_row RECORD;
  trigger_name TEXT;
  event_name TEXT;
  target_schema TEXT := current_schema();
BEGIN
  IF target_schema IS NULL OR to_regclass(format('%I._mklms_migrations', target_schema)) IS NULL THEN
    RAISE EXCEPTION 'Replication capture must run in the schema containing the MkLMS migration ledger';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = target_schema
      AND relation.relkind = 'r'
      AND relation.relname <> '_mklms_migrations'
      AND left(relation.relname, length('mklms_replication_')) <> 'mklms_replication_'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index primary_index
        WHERE primary_index.indrelid = relation.oid AND primary_index.indisprimary
      )
  ) THEN
    RAISE EXCEPTION 'Replication capture requires a primary key on every application table';
  END IF;

  FOR table_row IN
    SELECT namespace.nspname AS schema_name,
           relation.relname AS table_name,
           array_agg(attribute.attname ORDER BY key_column.ordinality) AS primary_key_columns
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_index primary_index ON primary_index.indrelid = relation.oid AND primary_index.indisprimary
    JOIN LATERAL unnest(primary_index.indkey) WITH ORDINALITY AS key_column(attnum, ordinality)
      ON key_column.ordinality <= primary_index.indnkeyatts
    JOIN pg_attribute attribute ON attribute.attrelid = relation.oid AND attribute.attnum = key_column.attnum
    WHERE namespace.nspname = target_schema
      AND relation.relkind = 'r'
      AND relation.relname <> '_mklms_migrations'
      AND left(relation.relname, length('mklms_replication_')) <> 'mklms_replication_'
    GROUP BY namespace.nspname, relation.relname
  LOOP
    FOREACH event_name IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE'] LOOP
      trigger_name := 'mklms_replication_capture_' || table_row.table_name || '_' || lower(event_name);
      EXECUTE format(
        'CREATE TRIGGER %I AFTER %s ON %I.%I FOR EACH ROW EXECUTE FUNCTION mklms_capture_replication_change(%L)',
        trigger_name,
        event_name,
        table_row.schema_name,
        table_row.table_name,
        to_json(table_row.primary_key_columns)::TEXT
      );
    END LOOP;
  END LOOP;
END;
$$;

COMMIT;
