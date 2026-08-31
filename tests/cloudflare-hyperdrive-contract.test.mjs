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
  assert.match(
    publicLivePage,
    /new PostgresSettingsRepository\(\s*getCachedPostgresPool\(\),?\s*\)/,
  );

  assert.doesNotMatch(liveState, /getCachedPostgresPool/);
  assert.match(liveState, /new PostgresLiveClassRepository\(\)/);
});

test("Wrangler remains strict JSON and deploy-safe before account Hyperdrive IDs exist", () => {
  assert.doesNotThrow(() => JSON.parse(wrangler));
  assert.doesNotMatch(wrangler, /<fresh-hyperdrive-config-id>|<cached-hyperdrive-config-id>/);
  assert.doesNotMatch(wrangler, /"hyperdrive"\s*:/);
});
