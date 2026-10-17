import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('offline D1 column inventory reports PostgreSQL missing columns',()=>{
 const source=readFileSync('scripts/d1-column-parity.mjs','utf8');
 assert.doesNotMatch(source,/DATABASE_URL|wrangler|fetch\(|getPostgresPool/);
 const report=JSON.parse(execFileSync(process.execPath,['scripts/d1-column-parity.mjs'],{encoding:'utf8'}));
 assert.equal(report.mode,'offline-only');
 assert.ok(report.sourceTables>0);
 assert.ok(Array.isArray(report.missingColumns));
 assert.equal(report.complete,report.missingColumns.length===0);
 if(!report.complete){
  const strict=spawnSync(process.execPath,['scripts/d1-column-parity.mjs','--require-complete'],{encoding:'utf8'});
  assert.equal(strict.status,1);
 }
});
