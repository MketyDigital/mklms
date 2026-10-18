export const MKLMS_D1_TABLE_SIGNATURE = Object.freeze([
  'certificate_templates', 'certificates', 'course_modules', 'courses', 'enrollments', 'lesson_progress', 'lessons',
  'live_attendee_messages', 'live_batches', 'live_sessions', 'live_timeline_messages', 'live_viewers',
  'managed_hosting_daily_ledger', 'managed_hosting_months', 'managed_hosting_operator_policy', 'managed_hosting_settings',
  'media_assets', 'media_ingest_jobs', 'media_playback_grants', 'media_watch_credits', 'message_threads', 'messages',
  'mklms_d1_atomic_assertions', 'mklms_replication_apply_receipts', 'mklms_replication_checkpoints',
  'mklms_replication_config', 'mklms_replication_dead_letters', 'mklms_replication_journal',
  'paid_course_live_sessions', 'platform_settings', 'preauthorizations', 'quiz_attempt_answers', 'quiz_attempts',
  'quiz_choices', 'quiz_questions', 'quizzes', 'student_access_credentials', 'student_sessions', 'students',
]);

export function selectPostgresCatalogSchema(rows) {
  if (!Array.isArray(rows)) throw new Error('PostgreSQL schema inventory must be an array.');
  const candidates = rows.map(row => ({
    name: typeof row?.name === 'string' ? row.name : '',
    hasMigrationLedger: row?.hasMigrationLedger === true,
    applicationTableCount: Number(row?.applicationTableCount),
    mklmsTableMatchCount: Number(row?.mklmsTableMatchCount ?? row?.mklmsSignatureTableCount ?? 0),
  })).filter(row => row.name && Number.isSafeInteger(row.applicationTableCount) && row.applicationTableCount >= 0);
  const ledgerSchemas = candidates.filter(row => row.hasMigrationLedger);
  const ledgerWithTables = ledgerSchemas.filter(row => row.applicationTableCount > 0);
  if (ledgerWithTables.length === 1) return ledgerWithTables[0].name;
  if (ledgerWithTables.length > 1) throw new Error(`Multiple MkLMS migration-ledger schemas contain application tables (${ledgerWithTables.length}).`);
  if (ledgerSchemas.length === 1) return ledgerSchemas[0].name;
  if (ledgerSchemas.length > 1) throw new Error(`Multiple MkLMS migration-ledger schemas were found (${ledgerSchemas.length}).`);
  // Match against the full D1 table inventory. A strong unique partial match
  // still allows the audit to expose missing PostgreSQL tables.
  const signatureSchemas = candidates.filter(row => row.mklmsTableMatchCount >= 8);
  const strongestSignature = Math.max(0, ...signatureSchemas.map(row => row.mklmsTableMatchCount));
  const strongestSchemas = signatureSchemas.filter(row => row.mklmsTableMatchCount === strongestSignature);
  if (strongestSchemas.length === 1) return strongestSchemas[0].name;
  if (strongestSchemas.length > 1) throw new Error(`Multiple PostgreSQL schemas share the strongest MkLMS table signature (${strongestSchemas.length}).`);
  const schemasWithTables = candidates.filter(row => row.applicationTableCount > 0);
  if (schemasWithTables.length === 1) return schemasWithTables[0].name;
  const tableCounts = schemasWithTables.map(row => row.applicationTableCount).join(',');
  const signatureCounts = schemasWithTables.map(row => row.mklmsTableMatchCount).join(',');
  throw new Error(`Could not select one PostgreSQL application schema safely (${schemasWithTables.length} schemas contain tables and no unique MkLMS migration ledger was found; metadata table counts ${tableCounts}; D1 table matches ${signatureCounts}).`);
}
