import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("settings reads fall back safely before migration 012 is applied", async () => {
  const repository = await readFile(
    new URL("../src/features/settings/repositories/postgres-settings.repository.ts", import.meta.url),
    "utf8",
  );
  assert.match(repository, /code\?\:\s*string/);
  assert.match(repository, /code === "42703"/);
  assert.match(repository, /readSettingsRow\(true\)/);
  assert.match(repository, /readSettingsRow\(false\)/);
  assert.match(repository, /completionCommunityUrl: row\.completion_community_url \?\? null/);
});

test("graduate community setting accepts only HTTPS in the admin API", async () => {
  const route = await readFile(
    new URL("../src/app/api/admin/settings/platform/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /Graduate community URL must use HTTPS/);
  assert.match(route, /startsWith\("https:\/\/"\)/);
});
