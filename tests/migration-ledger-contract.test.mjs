import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrate = readFileSync("scripts/migrate.mjs", "utf8");
const status = readFileSync("scripts/migration-status.mjs", "utf8");
const ledger = readFileSync("scripts/migration-ledger.mjs", "utf8");

test("migration commands share one ledger helper instead of defining conflicting schemas", () => {
  assert.match(migrate, /ensureMigrationLedger/);
  assert.match(status, /ensureMigrationLedger/);
  assert.doesNotMatch(migrate, /CREATE TABLE IF NOT EXISTS _mklms_migrations/);
  assert.doesNotMatch(status, /CREATE TABLE IF NOT EXISTS _mklms_migrations/);
});

test("migration ledger canonical schema is filename plus sha256 and upgrades legacy name/checksum columns", () => {
  assert.match(ledger, /filename TEXT PRIMARY KEY/);
  assert.match(ledger, /checksum_sha256 TEXT NOT NULL/);
  assert.match(ledger, /RENAME COLUMN name TO filename/);
  assert.match(ledger, /RENAME COLUMN checksum TO checksum_sha256/);
});

test("both migration commands query the canonical ledger columns", () => {
  assert.match(migrate, /SELECT checksum_sha256 FROM _mklms_migrations WHERE filename = \$1/);
  assert.match(migrate, /INSERT INTO _mklms_migrations \(filename, checksum_sha256\)/);
  assert.match(status, /SELECT filename, checksum_sha256, applied_at/);
});
