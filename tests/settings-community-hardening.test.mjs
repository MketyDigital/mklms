import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PostgresSettingsRepository } from "../src/features/settings/repositories/postgres-settings.repository.ts";

const legacyRow = {
  organization_name: "Starpips",
  product_name: "Academy",
  logo_url: null,
  favicon_url: null,
  primary_color: null,
  secondary_color: null,
  support_name: null,
  support_email: null,
  public_base_url: "https://academy.example.com/",
  timezone: "Africa/Lagos",
  locale: "en",
  access_provider: "access-code",
  claim_verification_strategy: "preauth-only",
  storage_provider: "r2",
  media_provider: "generic-hls",
  email_provider: "none",
  notification_provider: "none",
  access_code_prefix: "ACCESS",
  certificate_prefix: "CERT",
};

test("settings reads fall back safely before migration 012 is applied", async () => {
  const queries = [];
  const pool = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("completion_community_url")) {
        const error = new Error("column does not exist");
        error.code = "42703";
        throw error;
      }
      return { rows: [legacyRow] };
    },
  };

  const settings = await new PostgresSettingsRepository(pool).getPlatformSettings();
  assert.equal(queries.length, 2);
  assert.equal(settings.organizationName, "Starpips");
  assert.equal(settings.publicBaseUrl, "https://academy.example.com");
  assert.equal(settings.completionCommunityUrl, null);
});

test("graduate community setting accepts only HTTPS in the admin API", async () => {
  const route = await readFile(
    new URL("../src/app/api/admin/settings/platform/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /Graduate community URL must use HTTPS/);
  assert.match(route, /startsWith\("https:\/\/"\)/);
});
