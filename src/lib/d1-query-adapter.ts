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
