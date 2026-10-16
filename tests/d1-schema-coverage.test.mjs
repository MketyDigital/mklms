import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
test('D1 coverage scanner exposes missing PostgreSQL tables without DB access',()=>{
 const source=readFileSync('scripts/d1-schema-coverage.mjs','utf8');
 assert.doesNotMatch(source,/DATABASE_URL|wrangler|\.query\(|fetch\(/);
 const report=JSON.parse(execFileSync(process.execPath,['scripts/d1-schema-coverage.mjs'],{encoding:'utf8'}));
 assert.equal(report.sourceMigrations,20);
 assert.ok(report.sourceTables>=report.convertedTables);
 assert.ok(report.missingTables.every(x=>typeof x==='string'));
 assert.equal(report.complete,report.missingTables.length===0);
 if(!report.complete){
  const strict=spawnSync(process.execPath,['scripts/d1-schema-coverage.mjs','--require-complete'],{encoding:'utf8'});
  assert.equal(strict.status,1);
 }
});
