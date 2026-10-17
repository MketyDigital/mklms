import { createHash } from "node:crypto";

/**
 * Offline snapshot reconciliation. Compare explicitly normalized exports only.
 * Does not connect to either database or mutate any production state.
 */
export type SnapshotRow = Record<string, string | number | boolean | null>;
export type SnapshotTable = { name: string; primaryKey: string; rows: SnapshotRow[] };
export type TableDigest = { name: string; count: number; sha256: string };

function canonicalValue(value: SnapshotRow[string]): string {
  if (value === null) return "null";
  return JSON.stringify(value);
}
export function digestSnapshotTable(table: SnapshotTable): TableDigest {
  if (!/^[a-z][a-z0-9_]*$/.test(table.name)) throw new Error("Invalid table name");
  if (!/^[a-z][a-z0-9_]*$/.test(table.primaryKey)) throw new Error("Invalid primary key");
  const keys = new Set<string>();
  const encoded = table.rows.map(row => {
    const pk = row[table.primaryKey];
    if (pk === undefined || pk === null) throw new Error("Null or missing primary key");
    const key = canonicalValue(pk);
    if (keys.has(key)) throw new Error("Duplicate primary key in snapshot");
    keys.add(key);
    return [key, Object.keys(row).sort().map(column => {
      const value = row[column];
      if (value === undefined || typeof value === "object" && value !== null)
        throw new Error("Snapshot row must contain normalized scalar values");
      return [column, canonicalValue(value)];
    })] as const;
  }).sort((a,b) => a[0].localeCompare(b[0]));
  return { name: table.name, count: table.rows.length,
    sha256: createHash("sha256").update(JSON.stringify(encoded)).digest("hex") };
}
export function reconcileSnapshots(source: SnapshotTable[], target: SnapshotTable[]) {
  const sourceNames = new Set(source.map(t => t.name));
  const targetNames = new Set(target.map(t => t.name));
  if (sourceNames.size !== source.length || targetNames.size !== target.length)
    throw new Error("Duplicate table names in snapshots");
  const left = new Map(source.map(t => [t.name,digestSnapshotTable(t)]));
  const right = new Map(target.map(t => [t.name,digestSnapshotTable(t)]));
  const names = [...new Set([...left.keys(),...right.keys()])].sort();
  const mismatches = names.filter(name => {
    const a=left.get(name),b=right.get(name);
    return !a || !b || a.count!==b.count || a.sha256!==b.sha256;
  });
  return { matched: mismatches.length===0, mismatches, source: [...left.values()], target: [...right.values()] };
}
