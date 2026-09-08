import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("settings reads fall back safely before migrations 012 and 017 are applied", async () => {
  const repository = await readFile(
    new URL("../src/features/settings/repositories/postgres-settings.repository.ts", import.meta.url),
    "utf8",
  );
  assert.match(repository, /code\?\:\s*string/);
  assert.match(repository, /code === "42703"/);
  assert.match(repository, /readSettingsRow\(true, true\)/);
  assert.match(repository, /readSettingsRow\(true, false\)/);
  assert.match(repository, /readSettingsRow\(false, false\)/);
  assert.match(repository, /completionCommunityUrl: row\.completion_community_url \?\? null/);
  assert.match(repository, /fontFamily: normalizePortalFontFamily\(row\.font_family\)/);
});

test("graduate community setting accepts only HTTPS in the admin API", async () => {
  const route = await readFile(
    new URL("../src/app/api/admin/settings/platform/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /Graduate community URL must use HTTPS/);
  assert.match(route, /startsWith\("https:\/\/"\)/);
});
