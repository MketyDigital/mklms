import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const policy = readFileSync("src/features/hosting/server/managed-hosting-policy.ts", "utf8");
const domain = readFileSync("src/features/hosting/domain/managed-hosting.ts", "utf8");
const panel = readFileSync("src/features/hosting/components/managed-hosting-panel.tsx", "utf8");
const envExample = readFileSync(".env.example", "utf8");

test("managed hosting uses exactly one safe payment URL environment variable", () => {
  assert.match(policy, /MKLMS_MANAGED_PAYMENT_URL/);
  assert.doesNotMatch(policy, /MKLMS_MANAGED_HOSTING_PAYMENT_URL/);
  assert.doesNotMatch(domain, /usdt|wallet/i);
  assert.doesNotMatch(panel, /usdt|wallet|network|address/i);
  assert.match(panel, />\s*Pay now\s*</);
  assert.match(envExample, /MKLMS_MANAGED_PAYMENT_URL=https:\/\/example\.com\/pay/);
  assert.doesNotMatch(envExample, /MKLMS_MANAGED_HOSTING_PAYMENT_URL|USDT|WALLET_ADDRESS/i);
});
