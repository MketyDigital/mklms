import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const client = new Client({ connectionString });
await client.connect();
try {
  await client.query("CREATE TABLE IF NOT EXISTS public._mklms_migrations (sentinel TEXT PRIMARY KEY)");
  await client.query("CREATE TABLE IF NOT EXISTS public.managed_hosting_settings (sentinel TEXT PRIMARY KEY)");
  await client.query("CREATE TABLE IF NOT EXISTS public.platform_settings (sentinel TEXT PRIMARY KEY)");
  await client.query("INSERT INTO public._mklms_migrations VALUES ('keep') ON CONFLICT DO NOTHING");
  await client.query("INSERT INTO public.managed_hosting_settings VALUES ('keep') ON CONFLICT DO NOTHING");
  await client.query("INSERT INTO public.platform_settings VALUES ('keep') ON CONFLICT DO NOTHING");

  const result = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, MKLMS_DATABASE_SCHEMA: "mkety_academy" },
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stdout.write(result.stdout);
    throw new Error("Isolated PostgreSQL migration rehearsal failed.");
  }
  process.stdout.write(result.stdout);

  const migrations = (await readdir(path.join(process.cwd(), "db", "migrations"))).filter((name) => name.endsWith(".sql"));
  const applied = await client.query('SELECT filename FROM mkety_academy._mklms_migrations');
  assert.equal(applied.rows.length, migrations.length, "all migrations must be recorded in the isolated schema");
  const publicRows = await client.query(`
    SELECT
      (SELECT count(*)::int FROM public._mklms_migrations WHERE sentinel = 'keep') AS ledger,
      (SELECT count(*)::int FROM public.managed_hosting_settings WHERE sentinel = 'keep') AS hosting,
      (SELECT count(*)::int FROM public.platform_settings WHERE sentinel = 'keep') AS platform
  `);
  assert.deepEqual(publicRows.rows[0], { ledger: 1, hosting: 1, platform: 1 }, "public sentinels must remain untouched");
  const droppedTable = await client.query("SELECT to_regclass('mkety_academy.managed_hosting_settings') AS name");
  assert.equal(droppedTable.rows[0].name, null, "the legacy-table DROP must be scoped to the academy schema");

  const status = spawnSync(process.execPath, ["scripts/migration-status.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, MKLMS_DATABASE_SCHEMA: "mkety_academy" },
  });
  assert.equal(status.status, 0, status.stderr || "isolated migration status must succeed");
  console.log("PostgreSQL schema isolation rehearsal passed; public sentinels are intact.");
} finally {
  await client.end();
}
