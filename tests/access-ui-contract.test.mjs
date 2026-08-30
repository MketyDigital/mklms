import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const loginForm = fs.readFileSync("src/features/access/components/access-code-form.tsx", "utf8");
const claimForm = fs.readFileSync("src/features/access/components/claim-access-form.tsx", "utf8");

test("student access forms call the real MkLMS access APIs", () => {
  assert.match(loginForm, /\/api\/access\/login/);
  assert.match(claimForm, /\/api\/access\/claim/);
  assert.doesNotMatch(loginForm, /\/api\/auth\/login/);
  assert.doesNotMatch(claimForm, /\/api\/auth\/claim/);
});