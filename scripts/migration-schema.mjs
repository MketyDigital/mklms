const RESERVED = new Set(["public", "pg_catalog", "information_schema"]);

export function validateMigrationSchema(schema) {
  if (typeof schema !== "string" || !/^[a-z][a-z0-9_]{0,62}$/.test(schema)) {
    throw new Error("MKLMS_DATABASE_SCHEMA must be a lowercase PostgreSQL identifier.");
  }
  if (RESERVED.has(schema) || schema.startsWith("pg_")) {
    throw new Error(`Refusing reserved PostgreSQL schema: ${schema}`);
  }
  return schema;
}

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

/**
 * Select a dedicated schema and refuse to adopt non-empty or partially migrated
 * schemas. The public schema is deliberately excluded from the session path.
 */
export async function prepareMigrationSchema(client, schema, migrations) {
  validateMigrationSchema(schema);
  const expected = new Map(migrations.map(({ filename, checksum }) => [filename, checksum]));
  if (expected.size !== migrations.length || [...expected.values()].some((hash) => !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error("Expected migration inventory is invalid.");
  }

  const exists = await client.query("SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS present", [schema]);
  if (!exists.rows[0]?.present) {
    await client.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  }
  await client.query(`SET search_path TO ${quoteIdentifier(schema)}, pg_catalog`);

  const current = await client.query("SELECT current_schema() AS schema, current_schemas(false) AS schemas");
  if (current.rows[0]?.schema !== schema || current.rows[0].schemas.includes("public")) {
    throw new Error("PostgreSQL did not select the isolated migration schema; refusing to continue.");
  }

  const objects = await client.query(
    `SELECT c.relname AS name
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      UNION ALL
     SELECT p.proname AS name
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = $1`,
    [schema],
  );
  const nonLedgerObjects = objects.rows.filter((row) => row.name !== "_mklms_migrations");
  const ledger = await client.query("SELECT to_regclass('_mklms_migrations') IS NOT NULL AS present");
  if (!ledger.rows[0]?.present) {
    if (objects.rows.length > 0) {
      throw new Error(`Schema ${schema} contains objects without a migration ledger; refusing to adopt it.`);
    }
    return;
  }
  const rows = await client.query("SELECT filename, checksum_sha256 FROM _mklms_migrations ORDER BY filename");
  if (rows.rows.length === 0) {
    if (nonLedgerObjects.length > 0) {
      throw new Error(`Schema ${schema} contains unexpected objects and an empty migration ledger; refusing to apply migrations.`);
    }
    return;
  }
  if (
    rows.rows.length !== expected.size ||
    rows.rows.some((row) => expected.get(row.filename) !== row.checksum_sha256)
  ) {
    throw new Error(`Schema ${schema} has partial or inconsistent migration history; refusing to modify it.`);
  }
}
