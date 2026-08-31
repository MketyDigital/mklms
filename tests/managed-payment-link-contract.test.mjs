import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const policy = readFileSync("src/features/hosting/server/managed-hosting-policy.ts", "utf8");
const domain = readFileSync("src/features/hosting/domain/managed-hosting.ts", "utf8");
const panel = readFileSync("src/features/hosting/components/managed-hosting-panel.tsx", "utf8");
const envExample = readFileSync(".env.example", "utf8");

test("managed hosting uses one safe payment URL environment variable only", () => {
  assert.match(policy, /MKLMS_MANAGED_PAYMENT_URL/);
  assert.match(envExample, /MKLMS_MANAGED_PAYMENT_URL=https:\/\/example\.com\/pay/);
  assert.doesNotMatch(policy, /USDT|WALLET|ADDRESS|NETWORK/i);
  assert.doesNotMatch(domain, /usdt|wallet/i);
  assert.doesNotMatch(panel, /usdt|wallet|network|address/i);
  assert.doesNotMatch(envExample, /MKLMS_MANAGED_HOSTING_USDT|WALLET_ADDRESS/i);
  assert.match(panel, />\s*Pay now\s*</);
});
