import type { Pool } from "pg";
import type { D1DatabaseLike } from "../d1-query-adapter.ts";
import { queryD1Rows } from "../d1-query-adapter.ts";

export type ReplicationBackend = "postgresql" | "d1";
export type ReplicationOperation = "INSERT" | "UPDATE" | "DELETE";
export type ReplicationJsonObject = Record<string, unknown>;

export interface JournalStreamIdentity {
  installationId: string;
  sourceBackend: ReplicationBackend;
  /** Decimal string to preserve PostgreSQL BIGINT precision. */
  sourceEpoch: string;
}

export interface ReplicationJournalEntry {
  sequence: string;
  installationId: string;
  sourceBackend: ReplicationBackend;
  sourceEpoch: string;
  schemaVersion: number;
  transactionId: string;
  tableName: string;
  recordKey: ReplicationJsonObject;
  operation: ReplicationOperation;
  payload: ReplicationJsonObject | null;
  idempotencyKey: string;
  occurredAt: string;
}

type RawJournalRow = {
  sequence: unknown;
  installation_id: unknown;
  source_backend: unknown;
  source_epoch: unknown;
  schema_version: unknown;
  transaction_id: unknown;
  table_name: unknown;
  record_key: unknown;
  operation: unknown;
  payload: unknown;
  idempotency_key: unknown;
  occurred_at: unknown;
};

const MAX_REPLICATION_BATCH_SIZE = 500;
const identifierPattern = /^[a-z][a-z0-9_]{0,62}$/;
const positiveIntegerPattern = /^[1-9][0-9]*$/;
const cursorPattern = /^(0|[1-9][0-9]*)$/;

function parsePositiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Replication journal entry has invalid ${field}.`);
  }
  return parsed;
}

function parseBigint(value: unknown, field: string, allowZero = false): string {
  const text = String(value);
  const pattern = allowZero ? cursorPattern : positiveIntegerPattern;
  if (!pattern.test(text)) throw new Error(`Replication journal entry has invalid ${field}.`);
  return BigInt(text).toString();
}

function parseJsonObject(value: unknown, field: string): ReplicationJsonObject {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new Error(`Replication journal entry has invalid ${field} JSON.`);
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Replication journal entry has invalid ${field}.`);
  }
  return parsed as ReplicationJsonObject;
}

function normalizeEntry(
  row: RawJournalRow,
  identity: JournalStreamIdentity,
): ReplicationJournalEntry {
  const sequence = parseBigint(row.sequence, "sequence");
  const sourceEpoch = parseBigint(row.source_epoch, "source epoch");
  const schemaVersion = parsePositiveInteger(row.schema_version, "schema version");
  if (
    row.installation_id !== identity.installationId ||
    row.source_backend !== identity.sourceBackend ||
    sourceEpoch !== identity.sourceEpoch
  ) throw new Error("Replication journal stream identity mismatch.");

  if (typeof row.table_name !== "string" || !identifierPattern.test(row.table_name)) {
    throw new Error("Replication journal entry has invalid table name.");
  }
  if (row.operation !== "INSERT" && row.operation !== "UPDATE" && row.operation !== "DELETE") {
    throw new Error("Replication journal entry has invalid operation.");
  }
  if (typeof row.transaction_id !== "string" || !row.transaction_id.trim()) {
    throw new Error("Replication journal entry has invalid transaction ID.");
  }
  if (typeof row.idempotency_key !== "string" || !row.idempotency_key.trim()) {
    throw new Error("Replication journal entry has invalid idempotency key.");
  }
  if (typeof row.occurred_at !== "string" || !row.occurred_at.trim()) {
    throw new Error("Replication journal entry has invalid timestamp.");
  }

  const recordKey = parseJsonObject(row.record_key, "record key");
  const payload = row.operation === "DELETE" ? null : parseJsonObject(row.payload, "payload");
  if (row.operation === "DELETE" && row.payload !== null) {
    throw new Error("Replication DELETE entry must not have a payload.");
  }
  return {
    sequence,
    installationId: identity.installationId,
    sourceBackend: identity.sourceBackend,
    sourceEpoch,
    schemaVersion,
    transactionId: row.transaction_id,
    tableName: row.table_name,
    recordKey,
    operation: row.operation,
    payload,
    idempotencyKey: row.idempotency_key,
    occurredAt: row.occurred_at,
  };
}

function validateReadRequest(
  identity: JournalStreamIdentity,
  afterSequence: string,
  limit: number,
): string {
  if (!identity.installationId.trim()) throw new Error("Replication installation ID is required.");
  if (identity.sourceBackend !== "postgresql" && identity.sourceBackend !== "d1") {
    throw new Error("Replication source backend is unsupported.");
  }
  if (!positiveIntegerPattern.test(identity.sourceEpoch)) {
    throw new Error("Replication source epoch must be a positive integer.");
  }
  if (!cursorPattern.test(afterSequence)) throw new Error("Replication cursor must be a non-negative integer.");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_REPLICATION_BATCH_SIZE) {
    throw new Error(`Replication batch limit must be between 1 and ${MAX_REPLICATION_BATCH_SIZE}.`);
  }
  return BigInt(afterSequence).toString();
}

function ensureOrderedBatch(
  rows: RawJournalRow[],
  identity: JournalStreamIdentity,
  afterSequence: string,
  limit: number,
): ReplicationJournalEntry[] {
  if (rows.length > limit) throw new Error("Replication source exceeded the requested batch limit.");
  let previous = BigInt(afterSequence);
  return rows.map((row) => {
    const entry = normalizeEntry(row, identity);
    const current = BigInt(entry.sequence);
    if (current <= previous) throw new Error("Replication journal sequences must be strictly increasing.");
    previous = current;
    return entry;
  });
}

/** Read a bounded, ordered PostgreSQL journal page. This never advances a checkpoint. */
export async function readPostgresJournalBatch(
  pool: Pick<Pool, "query">,
  identity: JournalStreamIdentity,
  afterSequence: string,
  limit: number,
): Promise<ReplicationJournalEntry[]> {
  if (identity.sourceBackend !== "postgresql") {
    throw new Error("PostgreSQL journal reader requires a PostgreSQL source identity.");
  }
  const cursor = validateReadRequest(identity, afterSequence, limit);
  const result = await pool.query<RawJournalRow>(
    `SELECT sequence::TEXT AS sequence, installation_id, source_backend,
            source_epoch::TEXT AS source_epoch, schema_version, transaction_id,
            table_name, record_key, operation, payload, idempotency_key,
            occurred_at::TEXT AS occurred_at
       FROM mklms_replication_journal
      WHERE installation_id = $1 AND source_backend = $2
        AND source_epoch = $3::BIGINT AND sequence > $4::BIGINT
      ORDER BY sequence ASC LIMIT $5`,
    [identity.installationId, identity.sourceBackend, identity.sourceEpoch, cursor, limit],
  );
  return ensureOrderedBatch(result.rows, identity, cursor, limit);
}

/** Read a bounded, ordered D1 journal page. This never advances a checkpoint. */
export async function readD1JournalBatch(
  db: D1DatabaseLike,
  identity: JournalStreamIdentity,
  afterSequence: string,
  limit: number,
): Promise<ReplicationJournalEntry[]> {
  if (identity.sourceBackend !== "d1") {
    throw new Error("D1 journal reader requires a D1 source identity.");
  }
  const cursor = validateReadRequest(identity, afterSequence, limit);
  const rows = await queryD1Rows<RawJournalRow>(db, {
    sql: `SELECT sequence, installation_id, source_backend, source_epoch,
                 schema_version, transaction_id, table_name, record_key,
                 operation, payload, idempotency_key, occurred_at
            FROM mklms_replication_journal
           WHERE installation_id = ? AND source_backend = ?
             AND source_epoch = ? AND sequence > ?
           ORDER BY sequence ASC LIMIT ?`,
    params: [identity.installationId, identity.sourceBackend, identity.sourceEpoch, cursor, limit],
  });
  return ensureOrderedBatch(rows, identity, cursor, limit);
}

/** Read one complete source transaction. Checkpoints must never land mid-transaction. */
export async function readNextPostgresJournalTransaction(
  pool: Pick<Pool, "query">,
  identity: JournalStreamIdentity,
  afterSequence: string,
  limit: number,
): Promise<ReplicationJournalEntry[]> {
  if (identity.sourceBackend !== "postgresql") {
    throw new Error("PostgreSQL transaction reader requires a PostgreSQL source identity.");
  }
  const cursor = validateReadRequest(identity, afterSequence, limit);
  const next = await pool.query<{ transaction_id: unknown }>(
    `SELECT transaction_id
       FROM mklms_replication_journal
      WHERE installation_id = $1 AND source_backend = $2
        AND source_epoch = $3::BIGINT AND sequence > $4::BIGINT
      ORDER BY sequence ASC LIMIT 1`,
    [identity.installationId, identity.sourceBackend, identity.sourceEpoch, cursor],
  );
  const transactionId = next.rows[0]?.transaction_id;
  if (transactionId === undefined) return [];
  if (typeof transactionId !== "string" || !transactionId.trim()) {
    throw new Error("Replication source returned an invalid transaction ID.");
  }
  const result = await pool.query<RawJournalRow>(
    `SELECT sequence::TEXT AS sequence, installation_id, source_backend,
            source_epoch::TEXT AS source_epoch, schema_version, transaction_id,
            table_name, record_key, operation, payload, idempotency_key,
            occurred_at::TEXT AS occurred_at
       FROM mklms_replication_journal
      WHERE installation_id = $1 AND source_backend = $2
        AND source_epoch = $3::BIGINT AND transaction_id = $4
      ORDER BY sequence ASC LIMIT $5`,
    [identity.installationId, identity.sourceBackend, identity.sourceEpoch, transactionId, limit + 1],
  );
  if (result.rows.length === 0) throw new Error("Replication source transaction disappeared during read.");
  if (result.rows.length > limit) throw new Error(`Replication source transaction exceeds the ${limit}-entry limit.`);
  if (BigInt(String(result.rows[0].sequence)) <= BigInt(cursor)) {
    throw new Error("Replication cursor splits a source transaction.");
  }
  return ensureOrderedBatch(result.rows, identity, cursor, limit);
}

/** Read one complete source transaction. Checkpoints must never land mid-transaction. */
export async function readNextD1JournalTransaction(
  db: D1DatabaseLike,
  identity: JournalStreamIdentity,
  afterSequence: string,
  limit: number,
): Promise<ReplicationJournalEntry[]> {
  if (identity.sourceBackend !== "d1") {
    throw new Error("D1 transaction reader requires a D1 source identity.");
  }
  const cursor = validateReadRequest(identity, afterSequence, limit);
  const next = await queryD1Rows<{ transaction_id: unknown }>(db, {
    sql: `SELECT transaction_id
            FROM mklms_replication_journal
           WHERE installation_id = ? AND source_backend = ?
             AND source_epoch = ? AND sequence > ?
           ORDER BY sequence ASC LIMIT 1`,
    params: [identity.installationId, identity.sourceBackend, identity.sourceEpoch, cursor],
  });
  const transactionId = next[0]?.transaction_id;
  if (transactionId === undefined) return [];
  if (typeof transactionId !== "string" || !transactionId.trim()) {
    throw new Error("Replication source returned an invalid transaction ID.");
  }
  const rows = await queryD1Rows<RawJournalRow>(db, {
    sql: `SELECT sequence, installation_id, source_backend, source_epoch,
                 schema_version, transaction_id, table_name, record_key,
                 operation, payload, idempotency_key, occurred_at
            FROM mklms_replication_journal
           WHERE installation_id = ? AND source_backend = ?
             AND source_epoch = ? AND transaction_id = ?
           ORDER BY sequence ASC LIMIT ?`,
    params: [identity.installationId, identity.sourceBackend, identity.sourceEpoch, transactionId, limit + 1],
  });
  if (rows.length === 0) throw new Error("Replication source transaction disappeared during read.");
  if (rows.length > limit) throw new Error(`Replication source transaction exceeds the ${limit}-entry limit.`);
  if (BigInt(String(rows[0].sequence)) <= BigInt(cursor)) {
    throw new Error("Replication cursor splits a source transaction.");
  }
  return ensureOrderedBatch(rows, identity, cursor, limit);
}
