import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("managed-hosting billing is operator-controlled rather than editable by ordinary admin alone", async () => {
  const envExample = await read(".env.example");
  const api = await read("src/app/api/admin/hosting/month/route.ts");
  const auth = await read("src/features/hosting/server/hosting-operator-auth.ts");

  assert.match(envExample, /MKLMS_MANAGED_HOSTING_OPERATOR_KEY=/);
  assert.match(api, /hasValidAdminSession/);
  assert.match(api, /isValidManagedHostingOperatorKey/);
  assert.match(auth, /timingSafeEqual/);
  assert.match(auth, /expected\.length < 16/);
});

test("public home uses a certificate lookup instead of raw live-slug instructions", async () => {
  const home = await read("src/app/(public)/page.tsx");
  assert.match(home, /PublicCertificateLookup/);
  assert.equal(home.includes("/live/<slug>"), false);
  assert.equal(home.includes("/verify/<certificate-id>"), false);
});

test("Cloudflare database path supports Hyperdrive without changing the Node pool fallback", async () => {
  const postgres = await read("src/lib/postgres.ts");
  assert.match(postgres, /HYPERDRIVE/);
  assert.match(postgres, /new Client/);
  assert.match(postgres, /new Pool/);
});
