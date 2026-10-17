/**
 * Native Cloudflare D1 query adapter (not yet connected to MkLMS runtime).
 * All SQL provided to this adapter MUST be SQLite syntax with '?' parameters.
 * PostgreSQL '$n' parameters, transactions and implicit dialect conversion
 * are deliberately rejected to prevent silent data corruption.
 */
export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  all<T>(): Promise<{ results: T[]; success: boolean }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta: { changes?: number } }>;
}
export interface D1DatabaseLike {
  prepare(sql: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<unknown[]>;
}
export type D1Query = { sql: string; params?: readonly (string | number | boolean | null)[] };
function ensureSqliteQuery(query: D1Query): void {
  if (!query.sql.trim()) throw new Error("Empty D1 query");
  if (/\$\d+\b|::(?:uuid|text|jsonb|int)|\b(?:ILIKE|FOR\s+UPDATE|RETURNING\s+NEXT)\b/i.test(query.sql)) {
    throw new Error("PostgreSQL SQL is not valid in the D1 adapter");
  }
  if (/\b(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT)\b/i.test(query.sql)) {
    throw new Error("Explicit transactions must use reviewed D1 batch or transactional facilities");
  }
}
export function prepareD1Query(db: D1DatabaseLike, query: D1Query): D1StatementLike {
  ensureSqliteQuery(query);
  const statement = db.prepare(query.sql);
  return statement.bind(...(query.params ?? []).map(value => typeof value === "boolean" ? Number(value) : value));
}
export async function queryD1Rows<T>(db: D1DatabaseLike, query: D1Query): Promise<T[]> {
  const result = await prepareD1Query(db, query).all<T>();
  if (!result.success) throw new Error("D1 query failed");
  return result.results;
}
export async function executeD1(db: D1DatabaseLike, query: D1Query): Promise<number> {
  const result = await prepareD1Query(db, query).run();
  if (!result.success) throw new Error("D1 mutation failed");
  return result.meta.changes ?? 0;
}

/**
 * Decorate a D1 binding so every atomic batch gives its captured row changes a
 * shared source transaction ID. The set, application statements, and reset are
 * one D1 batch, so another request cannot observe or reuse the temporary ID.
 */
export function withReplicationCaptureBatch(
  db: D1DatabaseLike,
  transactionIdFactory: () => string,
): D1DatabaseLike {
  return {
    prepare: (sql) => db.prepare(sql),
    batch: (statements) => {
      const transactionId = transactionIdFactory();
      if (typeof transactionId !== "string" || !transactionId.trim() || transactionId.length > 255) {
        throw new Error("D1 replication transaction ID must be a non-empty string of at most 255 characters.");
      }
      const setTransactionId = prepareD1Query(db, {
        sql: `UPDATE mklms_replication_config
                 SET active_transaction_id = ?
               WHERE singleton = 1 AND source_backend = 'd1' AND capture_enabled = 1`,
        params: [transactionId],
      });
      const clearTransactionId = prepareD1Query(db, {
        sql: `UPDATE mklms_replication_config
                 SET active_transaction_id = NULL
               WHERE singleton = 1 AND source_backend = 'd1' AND capture_enabled = 1`,
      });
      return db.batch([setTransactionId, ...statements, clearTransactionId]);
    },
  };
}
