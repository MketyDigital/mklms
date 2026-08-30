import assert from "node:assert/strict";
import test from "node:test";

import { getIntegrationStatus } from "../src/features/settings/integration-status.ts";

test("integration status reports configured flags without returning secret values", () => {
  const env = {
    DATABASE_URL: "postgresql://secret-db",
    MKLMS_ADMIN_ACCESS_KEY: "super-secret-admin-key",
    MKLMS_ADMIN_SESSION_SECRET: "super-secret-session",
    MKLMS_TELEGRAM_BOT_TOKEN: "123:secret-token",
    MKLMS_TELEGRAM_CHAT_ID: "-100123",
    MKLMS_EMAIL_PROVIDER: "smtp",
    MKLMS_SMTP_HOST: "smtp.example.com",
    MKLMS_SMTP_USER: "user",
    MKLMS_SMTP_PASSWORD: "secret-mail",
    MKLMS_EMAIL_FROM: "noreply@example.com",
    MKLMS_STORAGE_BUCKET: "mklms-media",
    MKLMS_STORAGE_ACCESS_KEY_ID: "r2-access-key",
    MKLMS_STORAGE_SECRET_ACCESS_KEY: "r2-secret",
    MKLMS_MEDIA_DELIVERY_BASE_URL: "https://media.example.com",
    MKLMS_MEDIA_SIGNING_SECRET: "media-secret",
  };
  const status = getIntegrationStatus(env);
  assert.equal(status.find((item) => item.id === "database")?.configured, true);
  assert.equal(status.find((item) => item.id === "telegram")?.configured, true);
  assert.equal(status.find((item) => item.id === "smtp")?.configured, true);
  assert.equal(status.find((item) => item.id === "storage")?.configured, true);
  const serialized = JSON.stringify(status);
  for (const secret of ["secret-db", "super-secret-admin-key", "secret-token", "secret-mail", "r2-secret", "media-secret"]) {
    assert.equal(serialized.includes(secret), false);
  }
});
