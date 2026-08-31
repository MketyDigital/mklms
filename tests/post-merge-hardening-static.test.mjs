import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("managed-hosting payment policy is not exposed in normal env example or editable API", async () => {
  const envExample = await read(".env.example");
  assert.equal(envExample.includes("MKLMS_MANAGED_HOSTING_"), false);

  await assert.rejects(
    read("src/app/api/admin/hosting/route.ts"),
    /ENOENT|no such file/i,
  );
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
