import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const postgres = readFileSync("src/lib/postgres.ts", "utf8");
const wrangler = readFileSync("wrangler.jsonc", "utf8");
const publicLivePage = readFileSync("src/app/(public)/live/[slug]/page.tsx", "utf8");
const liveState = readFileSync("src/app/api/live/[slug]/state/route.ts", "utf8");

test("Cloudflare database runtime supports fresh, cached and legacy Hyperdrive bindings", () => {
  assert.match(postgres, /HYPERDRIVE_FRESH/);
  assert.match(postgres, /HYPERDRIVE_CACHED/);
  assert.match(postgres, /HYPERDRIVE\?/);
  assert.match(postgres, /export function getCachedPostgresPool/);
  assert.match(postgres, /process\.env\.DATABASE_URL/);
});

test("cached Hyperdrive is opt-in for stable public live-page settings only", () => {
  assert.match(publicLivePage, /getCachedPostgresPool/);
  assert.match(publicLivePage, /new PostgresSettingsRepository\(getCachedPostgresPool\(\)\)/);

  assert.doesNotMatch(liveState, /getCachedPostgresPool/);
  assert.match(liveState, /new PostgresLiveClassRepository\(\)/);
});

test("Wrangler stays deploy-safe before account-specific Hyperdrive IDs exist", () => {
  const activeConfig = wrangler
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");

  assert.doesNotMatch(activeConfig, /YOUR_[A-Z0-9_]*HYPERDRIVE[A-Z0-9_]*_ID/);
  assert.match(wrangler, /HYPERDRIVE_FRESH/);
  assert.match(wrangler, /HYPERDRIVE_CACHED/);
});
