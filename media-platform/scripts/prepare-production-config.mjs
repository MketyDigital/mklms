import { readFile, writeFile } from "node:fs/promises";

const [d1Id, kvId, r2Bucket] = process.argv.slice(2);
if (!d1Id || !kvId || !r2Bucket) throw new Error("Usage: node prepare-production-config.mjs <d1Id> <kvId> <r2Bucket>");

async function load(name) {
  return JSON.parse(await readFile(name, "utf8"));
}

async function save(name, value) {
  await writeFile(name, JSON.stringify(value, null, 2) + "\n");
}

const portal = await load("wrangler.jsonc");
portal.d1_databases[0].database_id = d1Id;
portal.kv_namespaces[0].id = kvId;
portal.r2_buckets[0].bucket_name = r2Bucket;
portal.vars = { ...(portal.vars ?? {}), MEDIA_R2_ENABLED: "true", MEDIA_DEFAULT_POOL_KEY: "r2-global" };
portal.routes = [{ pattern: "media.mkety.com", custom_domain: true }];
await save("wrangler.production.jsonc", portal);

const assets = await load("wrangler.delivery.jsonc");
assets.kv_namespaces[0].id = kvId;
assets.r2_buckets[0].bucket_name = r2Bucket;
assets.vars = { ...(assets.vars ?? {}), MEDIA_R2_ENABLED: "true" };
assets.routes = [{ pattern: "assets.mkety.app", custom_domain: true }];
await save("wrangler.delivery.production.jsonc", assets);

const maintenance = await load("wrangler.maintenance.jsonc");
maintenance.d1_databases[0].database_id = d1Id;
maintenance.kv_namespaces[0].id = kvId;
maintenance.r2_buckets[0].bucket_name = r2Bucket;
await save("wrangler.maintenance.production.jsonc", maintenance);
