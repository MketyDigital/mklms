import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

import { ensureMigrationLedger } from "./migration-ledger.mjs";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  await ensureMigrationLedger(client);

  const dir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  let applied = 0;
  let skipped = 0;

  for (const file of files) {
    const sql = await readFile(path.join(dir, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      "SELECT checksum_sha256 FROM _mklms_migrations WHERE filename = $1 LIMIT 1",
      [file],
    );

    if (existing.rows[0]) {
      if (existing.rows[0].checksum_sha256 !== checksum) {
        throw new Error(
          `Migration ${file} was already applied but its file contents changed. Create a new migration instead of editing an applied migration.`,
        );
      }
      console.log(`Skipping ${file} (already applied).`);
      skipped += 1;
      continue;
    }

    process.stdout.write(`Applying ${file}... `);
    await client.query(sql);
    await client.query(
      "INSERT INTO _mklms_migrations (filename, checksum_sha256) VALUES ($1, $2)",
      [file, checksum],
    );
    console.log("done");
    applied += 1;
  }

  console.log(`MkLMS database ready (${applied} applied, ${skipped} already current, ${files.length} total migrations).`);
} finally {
  await client.end();
}
