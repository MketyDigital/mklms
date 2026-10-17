import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { D1PlatformSettingsStore } from "../src/features/settings/repositories/d1-platform-settings.store.ts";

function makeD1(db) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() { return { success: true, results: db.prepare(sql).all(...args) }; },
            async run() { const result = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } }; },
          };
        },
      };
    },
    async batch() { throw Error("not used"); },
  };
}
test("D1 platform settings store reads, inserts, and updates the actual SQLite schema",async () => {
 const db=new DatabaseSync(":memory:");
 try {
  for(const name of ["0001_foundation","0014_settings_optional_columns"])
    db.exec(readFileSync("db/d1-migrations/"+name+".sql","utf8"));
  const store=new D1PlatformSettingsStore(makeD1(db));
  assert.equal(await store.read(),null);
  const settings={
    id:"default",organization_name:"Acme",product_name:"Academy",logo_url:null,
    favicon_url:null,primary_color:"#123456",secondary_color:null,
    font_family:"Inter",support_name:null,support_email:"support@example.com",
    public_base_url:"https://example.com",timezone:"UTC",locale:"en",
    access_provider:"access-code",claim_verification_strategy:"preauth-only",
    storage_provider:"r2",media_provider:"custom",email_provider:"none",
    notification_provider:"none",access_code_prefix:"ACCESS",
    certificate_prefix:"CERT",completion_community_url:null,
  };
  await store.write(settings);
  assert.equal((await store.read()).product_name,"Academy");
  await store.write({...settings,product_name:"Changed",completion_community_url:"https://example.com/community"});
  const result=await store.read();
  assert.equal(result.product_name,"Changed");
  assert.equal(result.completion_community_url,"https://example.com/community");
  assert.equal(db.prepare("SELECT count(*) AS n FROM platform_settings").get().n,1);
  await assert.rejects(store.write({...settings,id:"other"}),/default/);
 }finally{db.close()}
});
