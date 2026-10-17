-- D1 source-capture triggers. No config row means capture is inactive.
CREATE TABLE mklms_replication_config (
  singleton INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK (singleton = 1),
  installation_id TEXT NOT NULL UNIQUE,
  source_backend TEXT NOT NULL CHECK (source_backend IN ('postgresql', 'd1')),
  authority_epoch INTEGER NOT NULL CHECK (authority_epoch > 0),
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  capture_enabled INTEGER NOT NULL DEFAULT 0 CHECK (capture_enabled IN (0, 1)),
  active_transaction_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER "mklms_replication_capture_certificate_templates_insert" AFTER INSERT ON "certificate_templates" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'certificate_templates', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'name', NEW."name", 'background_asset_id', NEW."background_asset_id", 'layout_config_json', NEW."layout_config_json", 'signature_asset_id', NEW."signature_asset_id", 'certificate_prefix', NEW."certificate_prefix", 'active', NEW."active", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'course_id', NEW."course_id"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_certificate_templates_update" AFTER UPDATE ON "certificate_templates" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'certificate_templates', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'name', NEW."name", 'background_asset_id', NEW."background_asset_id", 'layout_config_json', NEW."layout_config_json", 'signature_asset_id', NEW."signature_asset_id", 'certificate_prefix', NEW."certificate_prefix", 'active', NEW."active", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'course_id', NEW."course_id"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_certificate_templates_delete" AFTER DELETE ON "certificate_templates" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'certificate_templates', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_certificates_insert" AFTER INSERT ON "certificates" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'certificates', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'certificate_id', NEW."certificate_id", 'student_id', NEW."student_id", 'course_id', NEW."course_id", 'template_id', NEW."template_id", 'certificate_name_snapshot', NEW."certificate_name_snapshot", 'certificate_email_snapshot', NEW."certificate_email_snapshot", 'completion_date', NEW."completion_date", 'pdf_asset_id', NEW."pdf_asset_id", 'status', NEW."status", 'issued_at', NEW."issued_at", 'emailed_at', NEW."emailed_at", 'email_delivery_status', NEW."email_delivery_status", 'email_last_error', NEW."email_last_error", 'revoked_at', NEW."revoked_at", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_certificates_update" AFTER UPDATE ON "certificates" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'certificates', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'certificate_id', NEW."certificate_id", 'student_id', NEW."student_id", 'course_id', NEW."course_id", 'template_id', NEW."template_id", 'certificate_name_snapshot', NEW."certificate_name_snapshot", 'certificate_email_snapshot', NEW."certificate_email_snapshot", 'completion_date', NEW."completion_date", 'pdf_asset_id', NEW."pdf_asset_id", 'status', NEW."status", 'issued_at', NEW."issued_at", 'emailed_at', NEW."emailed_at", 'email_delivery_status', NEW."email_delivery_status", 'email_last_error', NEW."email_last_error", 'revoked_at', NEW."revoked_at", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_certificates_delete" AFTER DELETE ON "certificates" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'certificates', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_course_modules_insert" AFTER INSERT ON "course_modules" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'course_modules', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'course_id', NEW."course_id", 'title', NEW."title", 'description', NEW."description", 'position', NEW."position", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_course_modules_update" AFTER UPDATE ON "course_modules" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'course_modules', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'course_id', NEW."course_id", 'title', NEW."title", 'description', NEW."description", 'position', NEW."position", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_course_modules_delete" AFTER DELETE ON "course_modules" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'course_modules', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_courses_insert" AFTER INSERT ON "courses" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'courses', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'slug', NEW."slug", 'title', NEW."title", 'description', NEW."description", 'status', NEW."status", 'position', NEW."position", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'assignment_mode', NEW."assignment_mode"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_courses_update" AFTER UPDATE ON "courses" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'courses', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'slug', NEW."slug", 'title', NEW."title", 'description', NEW."description", 'status', NEW."status", 'position', NEW."position", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'assignment_mode', NEW."assignment_mode"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_courses_delete" AFTER DELETE ON "courses" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'courses', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_enrollments_insert" AFTER INSERT ON "enrollments" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'enrollments', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'student_id', NEW."student_id", 'course_id', NEW."course_id", 'status', NEW."status", 'authorized_at', NEW."authorized_at", 'activated_at', NEW."activated_at", 'completed_at', NEW."completed_at", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'progress_percent', NEW."progress_percent"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_enrollments_update" AFTER UPDATE ON "enrollments" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'enrollments', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'student_id', NEW."student_id", 'course_id', NEW."course_id", 'status', NEW."status", 'authorized_at', NEW."authorized_at", 'activated_at', NEW."activated_at", 'completed_at', NEW."completed_at", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'progress_percent', NEW."progress_percent"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_enrollments_delete" AFTER DELETE ON "enrollments" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'enrollments', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_lesson_progress_insert" AFTER INSERT ON "lesson_progress" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'lesson_progress', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'student_id', NEW."student_id", 'course_id', NEW."course_id", 'lesson_id', NEW."lesson_id", 'progress_percent', NEW."progress_percent", 'completed_at', NEW."completed_at", 'last_position_seconds', NEW."last_position_seconds", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_lesson_progress_update" AFTER UPDATE ON "lesson_progress" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'lesson_progress', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'student_id', NEW."student_id", 'course_id', NEW."course_id", 'lesson_id', NEW."lesson_id", 'progress_percent', NEW."progress_percent", 'completed_at', NEW."completed_at", 'last_position_seconds', NEW."last_position_seconds", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_lesson_progress_delete" AFTER DELETE ON "lesson_progress" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'lesson_progress', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_lessons_insert" AFTER INSERT ON "lessons" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'lessons', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'module_id', NEW."module_id", 'title', NEW."title", 'description', NEW."description", 'position', NEW."position", 'status', NEW."status", 'media_asset_id', NEW."media_asset_id", 'completion_mode', NEW."completion_mode", 'completion_threshold_percent', NEW."completion_threshold_percent", 'duration_seconds', NEW."duration_seconds", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_lessons_update" AFTER UPDATE ON "lessons" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'lessons', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'module_id', NEW."module_id", 'title', NEW."title", 'description', NEW."description", 'position', NEW."position", 'status', NEW."status", 'media_asset_id', NEW."media_asset_id", 'completion_mode', NEW."completion_mode", 'completion_threshold_percent', NEW."completion_threshold_percent", 'duration_seconds', NEW."duration_seconds", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_lessons_delete" AFTER DELETE ON "lessons" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'lessons', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_attendee_messages_insert" AFTER INSERT ON "live_attendee_messages" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_attendee_messages', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'batch_id', NEW."batch_id", 'session_id', NEW."session_id", 'viewer_id', NEW."viewer_id", 'display_name_snapshot', NEW."display_name_snapshot", 'message', NEW."message", 'read_by_admin_at', NEW."read_by_admin_at", 'created_at', NEW."created_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_attendee_messages_update" AFTER UPDATE ON "live_attendee_messages" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_attendee_messages', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'batch_id', NEW."batch_id", 'session_id', NEW."session_id", 'viewer_id', NEW."viewer_id", 'display_name_snapshot', NEW."display_name_snapshot", 'message', NEW."message", 'read_by_admin_at', NEW."read_by_admin_at", 'created_at', NEW."created_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_attendee_messages_delete" AFTER DELETE ON "live_attendee_messages" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_attendee_messages', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_batches_insert" AFTER INSERT ON "live_batches" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_batches', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'slug', NEW."slug", 'title', NEW."title", 'description', NEW."description", 'status', NEW."status", 'expected_viewer_baseline', NEW."expected_viewer_baseline", 'viewer_display_mode', NEW."viewer_display_mode", 'ended_message', NEW."ended_message", 'ended_redirect_url', NEW."ended_redirect_url", 'notification_destination', NEW."notification_destination", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'attendee_chat_visibility', NEW."attendee_chat_visibility"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_batches_update" AFTER UPDATE ON "live_batches" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_batches', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'slug', NEW."slug", 'title', NEW."title", 'description', NEW."description", 'status', NEW."status", 'expected_viewer_baseline', NEW."expected_viewer_baseline", 'viewer_display_mode', NEW."viewer_display_mode", 'ended_message', NEW."ended_message", 'ended_redirect_url', NEW."ended_redirect_url", 'notification_destination', NEW."notification_destination", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'attendee_chat_visibility', NEW."attendee_chat_visibility"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_batches_delete" AFTER DELETE ON "live_batches" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_batches', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_sessions_insert" AFTER INSERT ON "live_sessions" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_sessions', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'batch_id', NEW."batch_id", 'title', NEW."title", 'position', NEW."position", 'starts_at', NEW."starts_at", 'duration_seconds', NEW."duration_seconds", 'media_asset_id', NEW."media_asset_id", 'status', NEW."status", 'cta_text', NEW."cta_text", 'cta_url', NEW."cta_url", 'cta_reveal_offset_seconds', NEW."cta_reveal_offset_seconds", 'ended_message', NEW."ended_message", 'ended_redirect_url', NEW."ended_redirect_url", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_sessions_update" AFTER UPDATE ON "live_sessions" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_sessions', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'batch_id', NEW."batch_id", 'title', NEW."title", 'position', NEW."position", 'starts_at', NEW."starts_at", 'duration_seconds', NEW."duration_seconds", 'media_asset_id', NEW."media_asset_id", 'status', NEW."status", 'cta_text', NEW."cta_text", 'cta_url', NEW."cta_url", 'cta_reveal_offset_seconds', NEW."cta_reveal_offset_seconds", 'ended_message', NEW."ended_message", 'ended_redirect_url', NEW."ended_redirect_url", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_sessions_delete" AFTER DELETE ON "live_sessions" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_sessions', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_timeline_messages_insert" AFTER INSERT ON "live_timeline_messages" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_timeline_messages', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'session_id', NEW."session_id", 'offset_seconds', NEW."offset_seconds", 'display_name', NEW."display_name", 'message', NEW."message", 'position', NEW."position", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_timeline_messages_update" AFTER UPDATE ON "live_timeline_messages" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_timeline_messages', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'session_id', NEW."session_id", 'offset_seconds', NEW."offset_seconds", 'display_name', NEW."display_name", 'message', NEW."message", 'position', NEW."position", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_timeline_messages_delete" AFTER DELETE ON "live_timeline_messages" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_timeline_messages', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_viewers_insert" AFTER INSERT ON "live_viewers" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_viewers', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'batch_id', NEW."batch_id", 'session_id', NEW."session_id", 'viewer_token_hash', NEW."viewer_token_hash", 'display_name', NEW."display_name", 'first_seen_at', NEW."first_seen_at", 'last_seen_at', NEW."last_seen_at", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_viewers_update" AFTER UPDATE ON "live_viewers" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_viewers', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'batch_id', NEW."batch_id", 'session_id', NEW."session_id", 'viewer_token_hash', NEW."viewer_token_hash", 'display_name', NEW."display_name", 'first_seen_at', NEW."first_seen_at", 'last_seen_at', NEW."last_seen_at", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_live_viewers_delete" AFTER DELETE ON "live_viewers" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'live_viewers', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_managed_hosting_daily_ledger_insert" AFTER INSERT ON "managed_hosting_daily_ledger" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'managed_hosting_daily_ledger', json_object('billing_date', NEW."billing_date"), 'INSERT',
    json_object('billing_date', NEW."billing_date", 'month_key', NEW."month_key", 'measured_watch_minutes', NEW."measured_watch_minutes", 'estimated_live_audience_minutes', NEW."estimated_live_audience_minutes", 'streaming_activity_band', NEW."streaming_activity_band", 'automatic_balance_cents', NEW."automatic_balance_cents", 'operator_adjustment_cents', NEW."operator_adjustment_cents", 'operator_reason', NEW."operator_reason", 'calculation_version', NEW."calculation_version", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_managed_hosting_daily_ledger_update" AFTER UPDATE ON "managed_hosting_daily_ledger" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'managed_hosting_daily_ledger', json_object('billing_date', NEW."billing_date"), 'UPDATE',
    json_object('billing_date', NEW."billing_date", 'month_key', NEW."month_key", 'measured_watch_minutes', NEW."measured_watch_minutes", 'estimated_live_audience_minutes', NEW."estimated_live_audience_minutes", 'streaming_activity_band', NEW."streaming_activity_band", 'automatic_balance_cents', NEW."automatic_balance_cents", 'operator_adjustment_cents', NEW."operator_adjustment_cents", 'operator_reason', NEW."operator_reason", 'calculation_version', NEW."calculation_version", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_managed_hosting_daily_ledger_delete" AFTER DELETE ON "managed_hosting_daily_ledger" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'managed_hosting_daily_ledger', json_object('billing_date', OLD."billing_date"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_managed_hosting_months_insert" AFTER INSERT ON "managed_hosting_months" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'managed_hosting_months', json_object('month_key', NEW."month_key"), 'INSERT',
    json_object('month_key', NEW."month_key", 'minimum_floor_cents', NEW."minimum_floor_cents", 'operator_note', NEW."operator_note", 'payment_status', NEW."payment_status", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'paid_at', NEW."paid_at", 'payment_id', NEW."payment_id", 'settled_amount_cents', NEW."settled_amount_cents", 'settled_currency', NEW."settled_currency", 'amount_due_cents', NEW."amount_due_cents", 'due_at', NEW."due_at", 'grace_ends_at', NEW."grace_ends_at", 'finalized_at', NEW."finalized_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_managed_hosting_months_update" AFTER UPDATE ON "managed_hosting_months" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'managed_hosting_months', json_object('month_key', NEW."month_key"), 'UPDATE',
    json_object('month_key', NEW."month_key", 'minimum_floor_cents', NEW."minimum_floor_cents", 'operator_note', NEW."operator_note", 'payment_status', NEW."payment_status", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'paid_at', NEW."paid_at", 'payment_id', NEW."payment_id", 'settled_amount_cents', NEW."settled_amount_cents", 'settled_currency', NEW."settled_currency", 'amount_due_cents', NEW."amount_due_cents", 'due_at', NEW."due_at", 'grace_ends_at', NEW."grace_ends_at", 'finalized_at', NEW."finalized_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_managed_hosting_months_delete" AFTER DELETE ON "managed_hosting_months" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'managed_hosting_months', json_object('month_key', OLD."month_key"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_managed_hosting_operator_policy_insert" AFTER INSERT ON "managed_hosting_operator_policy" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'managed_hosting_operator_policy', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'configured', NEW."configured", 'enabled', NEW."enabled", 'minimum_monthly_fee_cents', NEW."minimum_monthly_fee_cents", 'maximum_monthly_fee_cents', NEW."maximum_monthly_fee_cents", 'display_title', NEW."display_title", 'display_description', NEW."display_description", 'notice', NEW."notice", 'overdue_warning', NEW."overdue_warning", 'due_days_after_month_end', NEW."due_days_after_month_end", 'grace_days', NEW."grace_days", 'enforcement_enabled', NEW."enforcement_enabled", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_managed_hosting_operator_policy_update" AFTER UPDATE ON "managed_hosting_operator_policy" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'managed_hosting_operator_policy', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'configured', NEW."configured", 'enabled', NEW."enabled", 'minimum_monthly_fee_cents', NEW."minimum_monthly_fee_cents", 'maximum_monthly_fee_cents', NEW."maximum_monthly_fee_cents", 'display_title', NEW."display_title", 'display_description', NEW."display_description", 'notice', NEW."notice", 'overdue_warning', NEW."overdue_warning", 'due_days_after_month_end', NEW."due_days_after_month_end", 'grace_days', NEW."grace_days", 'enforcement_enabled', NEW."enforcement_enabled", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_managed_hosting_operator_policy_delete" AFTER DELETE ON "managed_hosting_operator_policy" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'managed_hosting_operator_policy', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_media_assets_insert" AFTER INSERT ON "media_assets" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'media_assets', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'title', NEW."title", 'provider', NEW."provider", 'source_type', NEW."source_type", 'provider_asset_id', NEW."provider_asset_id", 'origin_reference', NEW."origin_reference", 'playback_reference', NEW."playback_reference", 'duration_seconds', NEW."duration_seconds", 'poster_asset_id', NEW."poster_asset_id", 'processing_status', NEW."processing_status", 'metadata_json', NEW."metadata_json", 'watermark_config_json', NEW."watermark_config_json", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_media_assets_update" AFTER UPDATE ON "media_assets" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'media_assets', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'title', NEW."title", 'provider', NEW."provider", 'source_type', NEW."source_type", 'provider_asset_id', NEW."provider_asset_id", 'origin_reference', NEW."origin_reference", 'playback_reference', NEW."playback_reference", 'duration_seconds', NEW."duration_seconds", 'poster_asset_id', NEW."poster_asset_id", 'processing_status', NEW."processing_status", 'metadata_json', NEW."metadata_json", 'watermark_config_json', NEW."watermark_config_json", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_media_assets_delete" AFTER DELETE ON "media_assets" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'media_assets', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_media_ingest_jobs_insert" AFTER INSERT ON "media_ingest_jobs" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'media_ingest_jobs', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'media_asset_id', NEW."media_asset_id", 'title', NEW."title", 'state', NEW."state", 'source_object_key', NEW."source_object_key", 'oci_job_id', NEW."oci_job_id", 'oci_output_prefix', NEW."oci_output_prefix", 'r2_prefix', NEW."r2_prefix", 'r2_master_manifest', NEW."r2_master_manifest", 'duration_minutes', NEW."duration_minutes", 'estimated_cost_usd', NEW."estimated_cost_usd", 'cost_accepted_at', NEW."cost_accepted_at", 'error_message', NEW."error_message", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_media_ingest_jobs_update" AFTER UPDATE ON "media_ingest_jobs" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'media_ingest_jobs', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'media_asset_id', NEW."media_asset_id", 'title', NEW."title", 'state', NEW."state", 'source_object_key', NEW."source_object_key", 'oci_job_id', NEW."oci_job_id", 'oci_output_prefix', NEW."oci_output_prefix", 'r2_prefix', NEW."r2_prefix", 'r2_master_manifest', NEW."r2_master_manifest", 'duration_minutes', NEW."duration_minutes", 'estimated_cost_usd', NEW."estimated_cost_usd", 'cost_accepted_at', NEW."cost_accepted_at", 'error_message', NEW."error_message", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_media_ingest_jobs_delete" AFTER DELETE ON "media_ingest_jobs" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'media_ingest_jobs', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_media_playback_grants_insert" AFTER INSERT ON "media_playback_grants" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'media_playback_grants', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'student_id', NEW."student_id", 'course_id', NEW."course_id", 'lesson_id', NEW."lesson_id", 'media_asset_id', NEW."media_asset_id", 'started_at', NEW."started_at", 'expires_at', NEW."expires_at", 'revoked_at', NEW."revoked_at", 'created_at', NEW."created_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_media_playback_grants_update" AFTER UPDATE ON "media_playback_grants" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'media_playback_grants', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'student_id', NEW."student_id", 'course_id', NEW."course_id", 'lesson_id', NEW."lesson_id", 'media_asset_id', NEW."media_asset_id", 'started_at', NEW."started_at", 'expires_at', NEW."expires_at", 'revoked_at', NEW."revoked_at", 'created_at', NEW."created_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_media_playback_grants_delete" AFTER DELETE ON "media_playback_grants" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'media_playback_grants', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_media_watch_credits_insert" AFTER INSERT ON "media_watch_credits" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'media_watch_credits', json_object('grant_id', NEW."grant_id"), 'INSERT',
    json_object('grant_id', NEW."grant_id", 'student_id', NEW."student_id", 'course_id', NEW."course_id", 'lesson_id', NEW."lesson_id", 'credited_seconds', NEW."credited_seconds", 'first_credited_at', NEW."first_credited_at", 'last_credited_at', NEW."last_credited_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_media_watch_credits_update" AFTER UPDATE ON "media_watch_credits" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'media_watch_credits', json_object('grant_id', NEW."grant_id"), 'UPDATE',
    json_object('grant_id', NEW."grant_id", 'student_id', NEW."student_id", 'course_id', NEW."course_id", 'lesson_id', NEW."lesson_id", 'credited_seconds', NEW."credited_seconds", 'first_credited_at', NEW."first_credited_at", 'last_credited_at', NEW."last_credited_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_media_watch_credits_delete" AFTER DELETE ON "media_watch_credits" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'media_watch_credits', json_object('grant_id', OLD."grant_id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_message_threads_insert" AFTER INSERT ON "message_threads" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'message_threads', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'student_id', NEW."student_id", 'subject', NEW."subject", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_message_threads_update" AFTER UPDATE ON "message_threads" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'message_threads', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'student_id', NEW."student_id", 'subject', NEW."subject", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_message_threads_delete" AFTER DELETE ON "message_threads" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'message_threads', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_messages_insert" AFTER INSERT ON "messages" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'messages', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'thread_id', NEW."thread_id", 'sender_role', NEW."sender_role", 'sender_name_snapshot', NEW."sender_name_snapshot", 'text', NEW."text", 'context_type', NEW."context_type", 'context_id', NEW."context_id", 'created_at', NEW."created_at", 'read_by_student_at', NEW."read_by_student_at", 'read_by_admin_at', NEW."read_by_admin_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_messages_update" AFTER UPDATE ON "messages" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'messages', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'thread_id', NEW."thread_id", 'sender_role', NEW."sender_role", 'sender_name_snapshot', NEW."sender_name_snapshot", 'text', NEW."text", 'context_type', NEW."context_type", 'context_id', NEW."context_id", 'created_at', NEW."created_at", 'read_by_student_at', NEW."read_by_student_at", 'read_by_admin_at', NEW."read_by_admin_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_messages_delete" AFTER DELETE ON "messages" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'messages', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_paid_course_live_sessions_insert" AFTER INSERT ON "paid_course_live_sessions" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'paid_course_live_sessions', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'course_id', NEW."course_id", 'media_asset_id', NEW."media_asset_id", 'title', NEW."title", 'description', NEW."description", 'starts_at', NEW."starts_at", 'ends_at', NEW."ends_at", 'status', NEW."status", 'delivery_mode', NEW."delivery_mode", 'zoom_url', NEW."zoom_url", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_paid_course_live_sessions_update" AFTER UPDATE ON "paid_course_live_sessions" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'paid_course_live_sessions', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'course_id', NEW."course_id", 'media_asset_id', NEW."media_asset_id", 'title', NEW."title", 'description', NEW."description", 'starts_at', NEW."starts_at", 'ends_at', NEW."ends_at", 'status', NEW."status", 'delivery_mode', NEW."delivery_mode", 'zoom_url', NEW."zoom_url", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_paid_course_live_sessions_delete" AFTER DELETE ON "paid_course_live_sessions" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'paid_course_live_sessions', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_platform_settings_insert" AFTER INSERT ON "platform_settings" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'platform_settings', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'organization_name', NEW."organization_name", 'product_name', NEW."product_name", 'logo_url', NEW."logo_url", 'favicon_url', NEW."favicon_url", 'primary_color', NEW."primary_color", 'secondary_color', NEW."secondary_color", 'support_name', NEW."support_name", 'support_email', NEW."support_email", 'public_base_url', NEW."public_base_url", 'timezone', NEW."timezone", 'locale', NEW."locale", 'access_provider', NEW."access_provider", 'claim_verification_strategy', NEW."claim_verification_strategy", 'storage_provider', NEW."storage_provider", 'media_provider', NEW."media_provider", 'email_provider', NEW."email_provider", 'notification_provider', NEW."notification_provider", 'access_code_prefix', NEW."access_code_prefix", 'certificate_prefix', NEW."certificate_prefix", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'completion_community_url', NEW."completion_community_url", 'font_family', NEW."font_family"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_platform_settings_update" AFTER UPDATE ON "platform_settings" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'platform_settings', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'organization_name', NEW."organization_name", 'product_name', NEW."product_name", 'logo_url', NEW."logo_url", 'favicon_url', NEW."favicon_url", 'primary_color', NEW."primary_color", 'secondary_color', NEW."secondary_color", 'support_name', NEW."support_name", 'support_email', NEW."support_email", 'public_base_url', NEW."public_base_url", 'timezone', NEW."timezone", 'locale', NEW."locale", 'access_provider', NEW."access_provider", 'claim_verification_strategy', NEW."claim_verification_strategy", 'storage_provider', NEW."storage_provider", 'media_provider', NEW."media_provider", 'email_provider', NEW."email_provider", 'notification_provider', NEW."notification_provider", 'access_code_prefix', NEW."access_code_prefix", 'certificate_prefix', NEW."certificate_prefix", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at", 'completion_community_url', NEW."completion_community_url", 'font_family', NEW."font_family"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_platform_settings_delete" AFTER DELETE ON "platform_settings" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'platform_settings', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_preauthorizations_insert" AFTER INSERT ON "preauthorizations" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'preauthorizations', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'email', NEW."email", 'phone', NEW."phone", 'name_hint', NEW."name_hint", 'course_id', NEW."course_id", 'claim_strategy', NEW."claim_strategy", 'claim_code_hash', NEW."claim_code_hash", 'claim_requested_at', NEW."claim_requested_at", 'manual_approved_at', NEW."manual_approved_at", 'status', NEW."status", 'claimed_by_student_id', NEW."claimed_by_student_id", 'source', NEW."source", 'external_reference', NEW."external_reference", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_preauthorizations_update" AFTER UPDATE ON "preauthorizations" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'preauthorizations', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'email', NEW."email", 'phone', NEW."phone", 'name_hint', NEW."name_hint", 'course_id', NEW."course_id", 'claim_strategy', NEW."claim_strategy", 'claim_code_hash', NEW."claim_code_hash", 'claim_requested_at', NEW."claim_requested_at", 'manual_approved_at', NEW."manual_approved_at", 'status', NEW."status", 'claimed_by_student_id', NEW."claimed_by_student_id", 'source', NEW."source", 'external_reference', NEW."external_reference", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_preauthorizations_delete" AFTER DELETE ON "preauthorizations" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'preauthorizations', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quiz_attempt_answers_insert" AFTER INSERT ON "quiz_attempt_answers" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quiz_attempt_answers', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'attempt_id', NEW."attempt_id", 'question_id', NEW."question_id", 'selected_choice_id', NEW."selected_choice_id", 'correct', NEW."correct", 'created_at', NEW."created_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quiz_attempt_answers_update" AFTER UPDATE ON "quiz_attempt_answers" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quiz_attempt_answers', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'attempt_id', NEW."attempt_id", 'question_id', NEW."question_id", 'selected_choice_id', NEW."selected_choice_id", 'correct', NEW."correct", 'created_at', NEW."created_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quiz_attempt_answers_delete" AFTER DELETE ON "quiz_attempt_answers" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quiz_attempt_answers', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quiz_attempts_insert" AFTER INSERT ON "quiz_attempts" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quiz_attempts', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'quiz_id', NEW."quiz_id", 'student_id', NEW."student_id", 'course_id', NEW."course_id", 'score_percent', NEW."score_percent", 'passed', NEW."passed", 'started_at', NEW."started_at", 'completed_at', NEW."completed_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quiz_attempts_update" AFTER UPDATE ON "quiz_attempts" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quiz_attempts', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'quiz_id', NEW."quiz_id", 'student_id', NEW."student_id", 'course_id', NEW."course_id", 'score_percent', NEW."score_percent", 'passed', NEW."passed", 'started_at', NEW."started_at", 'completed_at', NEW."completed_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quiz_attempts_delete" AFTER DELETE ON "quiz_attempts" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quiz_attempts', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quiz_choices_insert" AFTER INSERT ON "quiz_choices" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quiz_choices', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'question_id', NEW."question_id", 'label', NEW."label", 'is_correct', NEW."is_correct", 'position', NEW."position", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quiz_choices_update" AFTER UPDATE ON "quiz_choices" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quiz_choices', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'question_id', NEW."question_id", 'label', NEW."label", 'is_correct', NEW."is_correct", 'position', NEW."position", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quiz_choices_delete" AFTER DELETE ON "quiz_choices" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quiz_choices', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quiz_questions_insert" AFTER INSERT ON "quiz_questions" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quiz_questions', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'quiz_id', NEW."quiz_id", 'prompt', NEW."prompt", 'position', NEW."position", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quiz_questions_update" AFTER UPDATE ON "quiz_questions" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quiz_questions', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'quiz_id', NEW."quiz_id", 'prompt', NEW."prompt", 'position', NEW."position", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quiz_questions_delete" AFTER DELETE ON "quiz_questions" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quiz_questions', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quizzes_insert" AFTER INSERT ON "quizzes" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quizzes', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'module_id', NEW."module_id", 'title', NEW."title", 'description', NEW."description", 'pass_mark_percent', NEW."pass_mark_percent", 'status', NEW."status", 'position', NEW."position", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quizzes_update" AFTER UPDATE ON "quizzes" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quizzes', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'module_id', NEW."module_id", 'title', NEW."title", 'description', NEW."description", 'pass_mark_percent', NEW."pass_mark_percent", 'status', NEW."status", 'position', NEW."position", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_quizzes_delete" AFTER DELETE ON "quizzes" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'quizzes', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_student_access_credentials_insert" AFTER INSERT ON "student_access_credentials" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'student_access_credentials', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'student_id', NEW."student_id", 'provider_type', NEW."provider_type", 'credential_lookup_hash', NEW."credential_lookup_hash", 'credential_hash', NEW."credential_hash", 'credential_salt', NEW."credential_salt", 'credential_algorithm', NEW."credential_algorithm", 'credential_prefix', NEW."credential_prefix", 'status', NEW."status", 'issued_at', NEW."issued_at", 'last_used_at', NEW."last_used_at", 'revoked_at', NEW."revoked_at", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_student_access_credentials_update" AFTER UPDATE ON "student_access_credentials" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'student_access_credentials', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'student_id', NEW."student_id", 'provider_type', NEW."provider_type", 'credential_lookup_hash', NEW."credential_lookup_hash", 'credential_hash', NEW."credential_hash", 'credential_salt', NEW."credential_salt", 'credential_algorithm', NEW."credential_algorithm", 'credential_prefix', NEW."credential_prefix", 'status', NEW."status", 'issued_at', NEW."issued_at", 'last_used_at', NEW."last_used_at", 'revoked_at', NEW."revoked_at", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_student_access_credentials_delete" AFTER DELETE ON "student_access_credentials" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'student_access_credentials', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_student_sessions_insert" AFTER INSERT ON "student_sessions" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'student_sessions', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'student_id', NEW."student_id", 'token_hash', NEW."token_hash", 'expires_at', NEW."expires_at", 'revoked_at', NEW."revoked_at", 'created_at', NEW."created_at", 'last_seen_at', NEW."last_seen_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_student_sessions_update" AFTER UPDATE ON "student_sessions" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'student_sessions', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'student_id', NEW."student_id", 'token_hash', NEW."token_hash", 'expires_at', NEW."expires_at", 'revoked_at', NEW."revoked_at", 'created_at', NEW."created_at", 'last_seen_at', NEW."last_seen_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_student_sessions_delete" AFTER DELETE ON "student_sessions" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'student_sessions', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_students_insert" AFTER INSERT ON "students" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'students', json_object('id', NEW."id"), 'INSERT',
    json_object('id', NEW."id", 'display_name', NEW."display_name", 'email', NEW."email", 'phone', NEW."phone", 'status', NEW."status", 'certificate_name', NEW."certificate_name", 'certificate_email', NEW."certificate_email", 'certificate_identity_locked_at', NEW."certificate_identity_locked_at", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_students_update" AFTER UPDATE ON "students" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'students', json_object('id', NEW."id"), 'UPDATE',
    json_object('id', NEW."id", 'display_name', NEW."display_name", 'email', NEW."email", 'phone', NEW."phone", 'status', NEW."status", 'certificate_name', NEW."certificate_name", 'certificate_email', NEW."certificate_email", 'certificate_identity_locked_at', NEW."certificate_identity_locked_at", 'created_at', NEW."created_at", 'updated_at', NEW."updated_at"), lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

CREATE TRIGGER "mklms_replication_capture_students_delete" AFTER DELETE ON "students" BEGIN
  INSERT INTO mklms_replication_journal (
    installation_id, source_backend, source_epoch, schema_version, transaction_id,
    table_name, record_key, operation, payload, idempotency_key
  )
  SELECT config.installation_id, 'd1', config.authority_epoch, config.schema_version,
    COALESCE(config.active_transaction_id, lower(hex(randomblob(16)))), 'students', json_object('id', OLD."id"), 'DELETE',
    NULL, lower(hex(randomblob(16)))
  FROM mklms_replication_config AS config WHERE config.singleton = 1 AND config.source_backend = 'd1' AND config.capture_enabled = 1;
END;

