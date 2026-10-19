-- Align D1 platform_settings with PostgreSQL migration 017 without losing rows.
-- Keep capture paused for the table rebuild; the copy only normalizes legacy NULL font values.
DROP TRIGGER IF EXISTS mklms_pk_guard_platform_settings_id_insert;
DROP TRIGGER IF EXISTS mklms_pk_guard_platform_settings_id_update;
DROP TRIGGER IF EXISTS mklms_replication_capture_platform_settings_insert;
DROP TRIGGER IF EXISTS mklms_replication_capture_platform_settings_update;
DROP TRIGGER IF EXISTS mklms_replication_capture_platform_settings_delete;

CREATE TABLE platform_settings_rebuilt (
  id TEXT PRIMARY KEY NOT NULL,
  organization_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  support_name TEXT,
  support_email TEXT,
  public_base_url TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  locale TEXT NOT NULL DEFAULT 'en',
  access_provider TEXT NOT NULL DEFAULT 'access-code',
  claim_verification_strategy TEXT NOT NULL DEFAULT 'preauth-only',
  storage_provider TEXT NOT NULL DEFAULT 'custom',
  media_provider TEXT NOT NULL DEFAULT 'generic-hls',
  email_provider TEXT NOT NULL DEFAULT 'none',
  notification_provider TEXT NOT NULL DEFAULT 'none',
  access_code_prefix TEXT NOT NULL DEFAULT 'ACCESS',
  certificate_prefix TEXT NOT NULL DEFAULT 'CERT',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completion_community_url TEXT,
  font_family TEXT NOT NULL DEFAULT 'Geist'
);

INSERT INTO platform_settings_rebuilt (
  id, organization_name, product_name, logo_url, favicon_url, primary_color,
  secondary_color, support_name, support_email, public_base_url, timezone,
  locale, access_provider, claim_verification_strategy, storage_provider,
  media_provider, email_provider, notification_provider, access_code_prefix,
  certificate_prefix, created_at, updated_at, completion_community_url, font_family
)
SELECT
  id, organization_name, product_name, logo_url, favicon_url, primary_color,
  secondary_color, support_name, support_email, public_base_url, timezone,
  locale, access_provider, claim_verification_strategy, storage_provider,
  media_provider, email_provider, notification_provider, access_code_prefix,
  certificate_prefix, created_at, updated_at, completion_community_url,
  COALESCE(font_family, 'Geist')
FROM platform_settings;

DROP TABLE platform_settings;
ALTER TABLE platform_settings_rebuilt RENAME TO platform_settings;

CREATE TRIGGER mklms_pk_guard_platform_settings_id_insert
BEFORE INSERT ON platform_settings WHEN NEW.id IS NULL
BEGIN SELECT RAISE(ABORT, 'primary key cannot be NULL'); END;
CREATE TRIGGER mklms_pk_guard_platform_settings_id_update
BEFORE UPDATE OF id ON platform_settings WHEN NEW.id IS NULL
BEGIN SELECT RAISE(ABORT, 'primary key cannot be NULL'); END;

CREATE TRIGGER mklms_replication_capture_platform_settings_insert AFTER INSERT ON platform_settings BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'platform_settings', json_object('id', NEW.id), 'INSERT',
    json_object('id', NEW.id, 'organization_name', NEW.organization_name, 'product_name', NEW.product_name, 'logo_url', NEW.logo_url, 'favicon_url', NEW.favicon_url, 'primary_color', NEW.primary_color, 'secondary_color', NEW.secondary_color, 'support_name', NEW.support_name, 'support_email', NEW.support_email, 'public_base_url', NEW.public_base_url, 'timezone', NEW.timezone, 'locale', NEW.locale, 'access_provider', NEW.access_provider, 'claim_verification_strategy', NEW.claim_verification_strategy, 'storage_provider', NEW.storage_provider, 'media_provider', NEW.media_provider, 'email_provider', NEW.email_provider, 'notification_provider', NEW.notification_provider, 'access_code_prefix', NEW.access_code_prefix, 'certificate_prefix', NEW.certificate_prefix, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at, 'completion_community_url', NEW.completion_community_url, 'font_family', NEW.font_family), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER mklms_replication_capture_platform_settings_update AFTER UPDATE ON platform_settings BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'platform_settings', json_object('id', NEW.id), 'UPDATE',
    json_object('id', NEW.id, 'organization_name', NEW.organization_name, 'product_name', NEW.product_name, 'logo_url', NEW.logo_url, 'favicon_url', NEW.favicon_url, 'primary_color', NEW.primary_color, 'secondary_color', NEW.secondary_color, 'support_name', NEW.support_name, 'support_email', NEW.support_email, 'public_base_url', NEW.public_base_url, 'timezone', NEW.timezone, 'locale', NEW.locale, 'access_provider', NEW.access_provider, 'claim_verification_strategy', NEW.claim_verification_strategy, 'storage_provider', NEW.storage_provider, 'media_provider', NEW.media_provider, 'email_provider', NEW.email_provider, 'notification_provider', NEW.notification_provider, 'access_code_prefix', NEW.access_code_prefix, 'certificate_prefix', NEW.certificate_prefix, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at, 'completion_community_url', NEW.completion_community_url, 'font_family', NEW.font_family), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER mklms_replication_capture_platform_settings_delete AFTER DELETE ON platform_settings BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'platform_settings', json_object('id', OLD.id), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;
