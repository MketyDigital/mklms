export async function ensureMigrationLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _mklms_migrations (
      filename TEXT PRIMARY KEY,
      checksum_sha256 TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const columns = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = '_mklms_migrations'
  `);
  const names = new Set(columns.rows.map((row) => row.column_name));

  if (names.has("name") && !names.has("filename")) {
    await client.query(
      "ALTER TABLE _mklms_migrations RENAME COLUMN name TO filename",
    );
    names.delete("name");
    names.add("filename");
  }

  if (names.has("checksum") && !names.has("checksum_sha256")) {
    await client.query(
      "ALTER TABLE _mklms_migrations RENAME COLUMN checksum TO checksum_sha256",
    );
    names.delete("checksum");
    names.add("checksum_sha256");
  }

  for (const required of ["filename", "checksum_sha256", "applied_at"]) {
    if (!names.has(required)) {
      throw new Error(
        `Migration ledger _mklms_migrations is missing required column ${required}. Refusing to guess or overwrite migration history.`,
      );
    }
  }
}
