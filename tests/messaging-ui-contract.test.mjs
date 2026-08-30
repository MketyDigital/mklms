import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const studentInput = fs.readFileSync("src/features/messages/components/message-input.tsx", "utf8");
const adminPanel = fs.readFileSync("src/features/messages/components/admin/admin-message-panel.tsx", "utf8");
const studentPage = fs.readFileSync("src/app/(member)/messages/page.tsx", "utf8");
const adminPage = fs.readFileSync("src/app/(admin)/admin/messages/page.tsx", "utf8");

test("student and admin messaging surfaces use the PostgreSQL-backed MkLMS messaging APIs", () => {
  assert.match(studentInput, /\/api\/messages/);
  assert.match(adminPanel, /\/api\/admin\/messages\//);
  assert.match(studentPage, /PostgresMessageRepository/);
  assert.match(adminPage, /PostgresMessageRepository/);
});
