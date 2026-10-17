/** Offline/staging replay foundation. Do not wire into runtime routes before fencing and reconciliation exist. */
import type { D1DatabaseLike, D1StatementLike } from "../d1-query-adapter.ts";
import type {
  JournalStreamIdentity,
  ReplicationJournalEntry,
  ReplicationJsonObject,
} from "./journal.ts";

export interface D1ReplayRequest {
  identity: JournalStreamIdentity;
  expectedLastSequence: string;
  expectedSchemaVersion: number;
  entries: ReplicationJournalEntry[];
}

export interface D1ReplayResult {
  status: "applied" | "already-applied";
  firstSequence: string;
  lastSequence: string;
  appliedEntries: number;
}

type D1Column = { name: string; type: string; primaryKeyPosition: number };
type D1Checkpoint = {
  source_epoch: unknown;
  last_sequence: unknown;
  schema_version: unknown;
};
type D1Receipt = { sequence: unknown; idempotency_key: unknown };

const MAX_TRANSACTION_ENTRIES = 500;
const identifierPattern = /^[a-z][a-z0-9_]{0,62}$/;
const positiveIntegerPattern = /^[1-9][0-9]*$/;
const cursorPattern = /^(0|[1-9][0-9]*)$/;
export const REPLICATED_TABLE_NAMES = Object.freeze([
  "certificate_templates", "certificates", "course_modules", "courses", "enrollments",
  "lesson_progress", "lessons", "live_attendee_messages", "live_batches", "live_sessions",
  "live_timeline_messages", "live_viewers", "managed_hosting_daily_ledger",
  "managed_hosting_months", "managed_hosting_operator_policy", "media_assets",
  "media_ingest_jobs", "media_playback_grants", "media_watch_credits", "message_threads",
  "messages", "paid_course_live_sessions", "platform_settings", "preauthorizations",
  "quiz_attempt_answers", "quiz_attempts", "quiz_choices", "quiz_questions", "quizzes",
  "student_access_credentials", "student_sessions", "students",
]);
const replicatedTables = new Set(REPLICATED_TABLE_NAMES);

const pgUsdToD1Cents: Record<string, Record<string, string>> = {
  managed_hosting_months: {
    minimum_floor_usd: "minimum_floor_cents",
    amount_due_usd: "amount_due_cents",
    settled_amount_usd: "settled_amount_cents",
  },
  managed_hosting_operator_policy: {
    minimum_monthly_fee_usd: "minimum_monthly_fee_cents",
    maximum_monthly_fee_usd: "maximum_monthly_fee_cents",
  },
  managed_hosting_daily_ledger: {
    automatic_balance_usd: "automatic_balance_cents",
    operator_adjustment_usd: "operator_adjustment_cents",
  },
};

function assertIdentifier(value: string, field: string): void {
  if (!identifierPattern.test(value)) throw new Error(`D1 replay has an invalid ${field}.`);
}

function quoteIdentifier(value: string): string {
  assertIdentifier(value, "SQL identifier");
  return `"${value}"`;
}

function asIntegerString(value: unknown, field: string): string {
  const text = String(value);
  if (!/^-?(?:0|[1-9][0-9]*)$/.test(text)) throw new Error(`D1 replay has an invalid ${field}.`);
  return text;
}

function usdToCents(value: unknown, field: string): number {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== "string" || !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(text)) {
    throw new Error(`D1 replay has an invalid ${field} amount.`);
  }
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  const signed = negative ? -cents : cents;
  const result = Number(signed);
  if (!Number.isSafeInteger(result)) throw new Error(`D1 replay ${field} amount exceeds safe integer cents.`);
  return result;
}

function normalizeBoundValue(value: unknown, column: D1Column, field: string): string | number | null {
  if (value === null) return null;
  if (typeof value === "boolean") {
    if (!/^(?:INT|INTEGER|BOOLEAN|NUMERIC)/i.test(column.type.trim())) {
      throw new Error(`D1 replay boolean does not match ${field}.`);
    }
    return value ? 1 : 0;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`D1 replay has a non-finite ${field}.`);
    if (/^(?:INT|INTEGER)/i.test(column.type.trim()) && !Number.isSafeInteger(value)) {
      throw new Error(`D1 replay has a non-integer ${field}.`);
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new Error(`D1 replay has an unsafe integer ${field}.`);
    }
    return value;
  }
  if (typeof value === "string") return value;
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    if (!/^(?:TEXT|JSON|JSONB|VARCHAR|CHAR)/i.test(column.type.trim())) {
      throw new Error(`D1 replay structured value does not match ${field}.`);
    }
    return JSON.stringify(value);
  }
  throw new Error(`D1 replay has an unsupported value for ${field}.`);
}

async function readColumns(db: D1DatabaseLike, tableName: string): Promise<D1Column[]> {
  const rows = await db.prepare(
    "SELECT name, type, pk AS primaryKeyPosition FROM pragma_table_info(?) ORDER BY pk, name",
  ).bind(tableName).all<D1Column>();
  if (!rows.success || !Array.isArray(rows.results) || rows.results.length === 0) {
    throw new Error(`D1 replay target schema is missing table ${tableName}.`);
  }
  const columns = rows.results.map((column) => ({
    name: String(column.name),
    type: String(column.type ?? ""),
    primaryKeyPosition: Number(column.primaryKeyPosition ?? 0),
  }));
  if (columns.some((column) => !identifierPattern.test(column.name))) {
    throw new Error(`D1 replay target table ${tableName} has an unsupported column name.`);
  }
  return columns;
}

function parseJsonRecord(value: ReplicationJsonObject, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`D1 replay ${field} must be a JSON object.`);
  }
  return value;
}

function validateRequest(request: D1ReplayRequest): void {
  const { identity, expectedLastSequence, expectedSchemaVersion, entries } = request;
  if (!identity.installationId.trim()) throw new Error("D1 replay installation ID is required.");
  if (identity.installationId !== "starpips" && identity.installationId !== "mkety-academy") {
    throw new Error("D1 replay installation is not supported.");
  }
  if (identity.sourceBackend !== "postgresql") {
    throw new Error("D1 replay target requires a PostgreSQL source stream.");
  }
  if (!positiveIntegerPattern.test(identity.sourceEpoch)) throw new Error("D1 replay source epoch is invalid.");
  if (!cursorPattern.test(expectedLastSequence)) throw new Error("D1 replay expected checkpoint is invalid.");
  if (!Number.isSafeInteger(expectedSchemaVersion) || expectedSchemaVersion <= 0) {
    throw new Error("D1 replay schema version is invalid.");
  }
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_TRANSACTION_ENTRIES) {
    throw new Error(`D1 replay transaction must contain between 1 and ${MAX_TRANSACTION_ENTRIES} entries.`);
  }

  const transactionId = entries[0].transactionId;
  let previous = BigInt(expectedLastSequence);
  for (const entry of entries) {
    if (
      entry.installationId !== identity.installationId ||
      entry.sourceBackend !== identity.sourceBackend ||
      entry.sourceEpoch !== identity.sourceEpoch
    ) throw new Error("D1 replay journal stream identity mismatch.");
    if (entry.schemaVersion !== expectedSchemaVersion) throw new Error("D1 replay schema version mismatch.");
    if (entry.operation !== "INSERT" && entry.operation !== "UPDATE" && entry.operation !== "DELETE") {
      throw new Error("D1 replay operation is unsupported.");
    }
    if (!transactionId || entry.transactionId !== transactionId) {
      throw new Error("D1 replay entries must belong to one complete source transaction.");
    }
    if (!positiveIntegerPattern.test(entry.sequence) || BigInt(entry.sequence) <= previous) {
      throw new Error("D1 replay journal entries must be ordered after the checkpoint.");
    }
    if (!replicatedTables.has(entry.tableName)) throw new Error(`D1 replay table is not allowlisted: ${entry.tableName}.`);
    if (entry.operation !== "DELETE" && !entry.payload) throw new Error("D1 replay change payload is missing.");
    if (entry.operation === "DELETE" && entry.payload !== null) throw new Error("D1 replay delete payload must be null.");
    parseJsonRecord(entry.recordKey, "record key");
    if (!entry.idempotencyKey.trim()) throw new Error("D1 replay idempotency key is required.");
    previous = BigInt(entry.sequence);
  }
}

async function prepareEntry(
  db: D1DatabaseLike,
  entry: ReplicationJournalEntry,
): Promise<D1StatementLike[]> {
  const columns = await readColumns(db, entry.tableName);
  const columnByName = new Map(columns.map((column) => [column.name, column]));
  const primaryKeys = columns.filter((column) => column.primaryKeyPosition > 0)
    .sort((a, b) => a.primaryKeyPosition - b.primaryKeyPosition);
  if (primaryKeys.length === 0) throw new Error(`D1 replay table ${entry.tableName} has no primary key.`);
  const key = parseJsonRecord(entry.recordKey, "record key");
  const keyNames = Object.keys(key).sort();
  const expectedKeyNames = primaryKeys.map((column) => column.name).sort();
  if (keyNames.length !== expectedKeyNames.length || keyNames.some((name, index) => name !== expectedKeyNames[index])) {
    throw new Error(`D1 replay key does not match the primary key for ${entry.tableName}.`);
  }

  const where = primaryKeys.map((column) => `${quoteIdentifier(column.name)} = ?`).join(" AND ");
  const keyValues = primaryKeys.map((column) => {
    const value = key[column.name];
    if (value === null || (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")) {
      throw new Error(`D1 replay primary key ${column.name} has an unsupported value.`);
    }
    return normalizeBoundValue(value, column, `${entry.tableName}.${column.name}`);
  });

  if (entry.operation === "DELETE") {
    return [db.prepare(`DELETE FROM ${quoteIdentifier(entry.tableName)} WHERE ${where}`).bind(...keyValues)];
  }

  const payload = parseJsonRecord(entry.payload as ReplicationJsonObject, "payload");
  const sourceColumns = Object.keys(payload);
  if (sourceColumns.length === 0) throw new Error("D1 replay payload cannot be empty.");
  const transformed = new Map<string, unknown>();
  for (const sourceColumn of sourceColumns) {
    assertIdentifier(sourceColumn, "payload column");
    const targetColumn = pgUsdToD1Cents[entry.tableName]?.[sourceColumn] ?? sourceColumn;
    const column = columnByName.get(targetColumn);
    if (!column) throw new Error(`D1 replay payload column ${entry.tableName}.${sourceColumn} is not in the target schema.`);
    if (targetColumn !== sourceColumn) {
      transformed.set(targetColumn, usdToCents(payload[sourceColumn], `${entry.tableName}.${sourceColumn}`));
    } else {
      transformed.set(targetColumn, normalizeBoundValue(payload[sourceColumn], column, `${entry.tableName}.${sourceColumn}`));
    }
  }
  for (const column of primaryKeys) {
    const payloadKey = transformed.get(column.name);
    if (!transformed.has(column.name) || payloadKey !== key[column.name]) {
      throw new Error(`D1 replay payload key does not match the record key for ${entry.tableName}.${column.name}.`);
    }
  }

  const targetColumns = [...transformed.keys()].sort();
  if (entry.operation === "INSERT") {
    const names = targetColumns.map(quoteIdentifier).join(", ");
    const placeholders = targetColumns.map(() => "?").join(", ");
    return [db.prepare(`INSERT INTO ${quoteIdentifier(entry.tableName)} (${names}) VALUES (${placeholders})`)
      .bind(...targetColumns.map((name) => transformed.get(name) as string | number | null))];
  }

  const updateColumns = targetColumns.filter(name => !primaryKeys.some(column => column.name === name));
  if (updateColumns.length === 0) throw new Error("D1 replay update contains no mutable columns.");
  const assignments = updateColumns.map(name => `${quoteIdentifier(name)} = ?`).join(", ");
  const params = [
    ...updateColumns.map(name => transformed.get(name) as string | number | null),
    ...keyValues,
  ];
  return [db.prepare(`UPDATE ${quoteIdentifier(entry.tableName)} SET ${assignments} WHERE ${where}`).bind(...params)];
}

export async function applyD1JournalTransaction(
  db: D1DatabaseLike,
  request: D1ReplayRequest,
): Promise<D1ReplayResult> {
  validateRequest(request);
  const { identity, expectedLastSequence, expectedSchemaVersion, entries } = request;
  const lastSequence = entries.at(-1)!.sequence;
  const checkpointRows = await db.prepare(`SELECT source_epoch, last_sequence, schema_version
    FROM mklms_replication_checkpoints
    WHERE installation_id = ? AND source_backend = ? AND target_backend = 'd1'`)
    .bind(identity.installationId, identity.sourceBackend).all<D1Checkpoint>();
  if (!checkpointRows.success || checkpointRows.results.length !== 1) {
    throw new Error("D1 replay requires one verified snapshot checkpoint for this stream.");
  }
  const checkpoint = checkpointRows.results[0];
  if (
    String(checkpoint.source_epoch) !== identity.sourceEpoch ||
    Number(checkpoint.schema_version) !== expectedSchemaVersion
  ) throw new Error("D1 replay checkpoint identity or schema version mismatch.");
  const currentSequence = BigInt(asIntegerString(checkpoint.last_sequence, "checkpoint sequence"));
  const firstSequence = entries[0].sequence;

  if (currentSequence >= BigInt(lastSequence)) {
    if (currentSequence < BigInt(firstSequence)) throw new Error("D1 replay checkpoint overlaps a source transaction.");
    const receipts = await db.prepare(`SELECT sequence, idempotency_key
      FROM mklms_replication_apply_receipts
      WHERE installation_id = ? AND source_backend = ? AND target_backend = 'd1'
        AND source_epoch = ? AND sequence >= ? AND sequence <= ?`)
      .bind(identity.installationId, identity.sourceBackend, identity.sourceEpoch,
        firstSequence, lastSequence).all<D1Receipt>();
    if (!receipts.success) throw new Error("D1 replay receipt query failed.");
    const receiptBySequence = new Map(receipts.results.map(receipt => [String(receipt.sequence), String(receipt.idempotency_key)]));
    if (receiptBySequence.size !== entries.length || entries.some(entry => receiptBySequence.get(entry.sequence) !== entry.idempotencyKey)) {
      throw new Error("D1 replay checkpoint is ahead but matching apply receipts are missing.");
    }
    return { status: "already-applied", firstSequence, lastSequence, appliedEntries: 0 };
  }
  if (currentSequence.toString() !== expectedLastSequence) {
    throw new Error("D1 replay checkpoint changed after the source transaction was read.");
  }

  const setupGuard = db.prepare(`INSERT INTO mklms_replication_config
      (singleton,installation_id,source_backend,authority_epoch,schema_version,capture_enabled,apply_in_progress)
    VALUES (1,?,'postgresql',?,?,0,1)
    ON CONFLICT(singleton) DO UPDATE SET apply_in_progress=1
    WHERE installation_id=excluded.installation_id AND capture_enabled=0`)
    .bind(identity.installationId, identity.sourceEpoch, expectedSchemaVersion);
  const statements: D1StatementLike[] = [setupGuard];
  const applyGuardId = "replication-apply-config-guard";
  statements.push(db.prepare(`INSERT INTO mklms_d1_atomic_assertions(id,passed)
    SELECT ?,CASE WHEN changes()=1 AND (SELECT apply_in_progress=1 AND capture_enabled=0
      FROM mklms_replication_config WHERE singleton=1 AND installation_id=?) THEN 1 ELSE 0 END`)
    .bind(applyGuardId, identity.installationId));
  statements.push(db.prepare("DELETE FROM mklms_d1_atomic_assertions WHERE id = ?").bind(applyGuardId));

  for (const entry of entries) {
    const mutations = await prepareEntry(db, entry);
    statements.push(...mutations);
    const assertionId = `replication-apply-${entry.sequence}`;
    statements.push(db.prepare(`INSERT INTO mklms_d1_atomic_assertions(id,passed)
      SELECT ?,CASE WHEN changes()=1 THEN 1 ELSE 0 END`).bind(assertionId));
    statements.push(db.prepare("DELETE FROM mklms_d1_atomic_assertions WHERE id = ?").bind(assertionId));
    statements.push(db.prepare(`INSERT INTO mklms_replication_apply_receipts
      (installation_id,source_backend,target_backend,source_epoch,sequence,idempotency_key)
      VALUES (?,?,'d1',?,?,?)`)
      .bind(identity.installationId, identity.sourceBackend, identity.sourceEpoch, entry.sequence, entry.idempotencyKey));
  }

  statements.push(db.prepare(`UPDATE mklms_replication_checkpoints
    SET last_sequence=?,updated_at=CURRENT_TIMESTAMP
    WHERE installation_id=? AND source_backend=? AND target_backend='d1'
      AND source_epoch=? AND last_sequence=? AND schema_version=?`)
    .bind(lastSequence, identity.installationId, identity.sourceBackend, identity.sourceEpoch,
      expectedLastSequence, expectedSchemaVersion));
  const checkpointGuardId = "replication-checkpoint-guard";
  statements.push(db.prepare(`INSERT INTO mklms_d1_atomic_assertions(id,passed)
    SELECT ?,CASE WHEN changes()=1 THEN 1 ELSE 0 END`).bind(checkpointGuardId));
  statements.push(db.prepare("DELETE FROM mklms_d1_atomic_assertions WHERE id = ?").bind(checkpointGuardId));
  statements.push(db.prepare(`UPDATE mklms_replication_config SET apply_in_progress=0
    WHERE singleton=1 AND installation_id=? AND apply_in_progress=1 AND capture_enabled=0`)
    .bind(identity.installationId));
  const resetGuardId = "replication-apply-reset-guard";
  statements.push(db.prepare(`INSERT INTO mklms_d1_atomic_assertions(id,passed)
    SELECT ?,CASE WHEN changes()=1 THEN 1 ELSE 0 END`).bind(resetGuardId));
  statements.push(db.prepare("DELETE FROM mklms_d1_atomic_assertions WHERE id = ?").bind(resetGuardId));

  const results = await db.batch(statements);
  if (!Array.isArray(results) || results.some(result => !result || typeof result !== "object" || (result as { success?: unknown }).success !== true)) {
    throw new Error("D1 replay batch did not report complete success.");
  }
  return { status: "applied", firstSequence, lastSequence, appliedEntries: entries.length };
}
