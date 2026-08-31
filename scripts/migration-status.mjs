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

const checksum = (content) => createHash("sha256").update(content).digest("hex");

await client.connect();
try {
  await ensureMigrationLedger(client);

  const dir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  const applied = await client.query(
    `SELECT filename, checksum_sha256, applied_at
     FROM _mklms_migrations
     ORDER BY filename`,
  );
  const byName = new Map(applied.rows.map((row) => [row.filename, row]));

  let pending = 0;
  let changed = 0;
  for (const file of files) {
    const content = await readFile(path.join(dir, file), "utf8");
    const hash = checksum(content);
    const record = byName.get(file);
    if (!record) {
      pending += 1;
      console.log(`PENDING  ${file}`);
    } else if (record.checksum_sha256 !== hash) {
      changed += 1;
      console.log(`CHANGED  ${file} (applied migration checksum no longer matches)`);
    } else {
      console.log(`APPLIED  ${file}  ${new Date(record.applied_at).toISOString()}`);
    }
  }

  console.log(`\nMkLMS migrations: ${files.length - pending - changed} applied, ${pending} pending, ${changed} changed.`);
  if (changed > 0) process.exitCode = 2;
  else if (pending > 0) process.exitCode = 3;
} finally {
  await client.end();
}
