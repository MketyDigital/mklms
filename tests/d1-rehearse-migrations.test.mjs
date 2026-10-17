import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
test('offline D1 migration rehearsal validates available SQLite schemas',()=>{
 const result=JSON.parse(execFileSync(process.execPath,['scripts/d1-rehearse-migrations.mjs'],{encoding:'utf8'}));
 assert.equal(result.mode,'offline-only');
 assert.equal(result.foreignKeyCheck,'passed');
 assert.ok(result.applied.length>=2);
 assert.ok(result.tables.includes('students'));
 assert.ok(result.tables.includes('live_sessions'));
});
test('offline D1 rehearsal refuses deployment arguments',()=>{
 const result=spawnSync(process.execPath,['scripts/d1-rehearse-migrations.mjs','--production'],{encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/Production execution is forbidden/);
});
