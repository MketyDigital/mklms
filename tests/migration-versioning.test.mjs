import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("released migration 009 retains its original managed-hosting table and 010 removes it", async () => {
  const migration009 = await read("db/migrations/009_mklms_media_ingest_hosting.sql");
  const migration010 = await read("db/migrations/010_remove_legacy_managed_hosting_settings.sql");

  assert.match(migration009, /CREATE TABLE IF NOT EXISTS managed_hosting_settings/);
  assert.match(migration009, /payment_network TEXT/);
  assert.match(migration010, /DROP TABLE IF EXISTS managed_hosting_settings/);
});
