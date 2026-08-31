import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migration009 = readFileSync("db/migrations/009_mklms_media_ingest_hosting.sql", "utf8");
const migration010 = readFileSync("db/migrations/010_mklms_managed_hosting_months.sql", "utf8");
const migration011Path = "db/migrations/011_remove_legacy_managed_hosting_settings.sql";

test("released migration 009 retains legacy managed-hosting schema for checksum safety", () => {
  assert.match(migration009, /CREATE TABLE IF NOT EXISTS managed_hosting_settings/);
  assert.match(migration009, /payment_network TEXT NOT NULL DEFAULT 'TRC20'/);
  assert.match(migration009, /INSERT INTO managed_hosting_settings \(id\)/);
});

test("current migration 010 remains the managed-hosting-months migration", () => {
  assert.match(migration010, /CREATE TABLE IF NOT EXISTS managed_hosting_months/);
  assert.doesNotMatch(migration010, /DROP TABLE IF EXISTS managed_hosting_settings/);
});

test("forward migration 011 removes the legacy managed-hosting settings table", () => {
  assert.equal(existsSync(migration011Path), true);
  const migration011 = readFileSync(migration011Path, "utf8");
  assert.match(migration011, /DROP TABLE IF EXISTS managed_hosting_settings/);
});
