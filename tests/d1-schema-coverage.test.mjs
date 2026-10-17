import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
test('D1 coverage scanner exposes missing PostgreSQL tables without DB access',()=>{
 const source=readFileSync('scripts/d1-schema-coverage.mjs','utf8');
 assert.doesNotMatch(source,/DATABASE_URL|wrangler|\.query\(|fetch\(/);
 const report=JSON.parse(execFileSync(process.execPath,['scripts/d1-schema-coverage.mjs'],{encoding:'utf8'}));
 assert.equal(report.sourceMigrations,23);
 assert.ok(report.sourceTables>=report.convertedTables);
 assert.ok(report.missingTables.every(x=>typeof x==='string'));
 assert.equal(report.complete,report.missingTables.length===0);
 if(!report.complete){
  const strict=spawnSync(process.execPath,['scripts/d1-schema-coverage.mjs','--require-complete'],{encoding:'utf8'});
  assert.equal(strict.status,1);
 }
});

test('offline D1 migration rehearsal enforces internal catalog and SQLite integrity',()=>{
 const source=readFileSync('scripts/d1-rehearse-migrations.mjs','utf8');
 assert.doesNotMatch(source,/DATABASE_URL|wrangler|fetch\(|getPostgresPool/);
 const report=JSON.parse(execFileSync(process.execPath,['scripts/d1-rehearse-migrations.mjs'],{encoding:'utf8'}));
 assert.equal(report.mode,'offline-only');
 assert.equal(report.foreignKeyCheck,'passed');
 assert.deepEqual(report.integrityCheck,['ok']);
 assert.deepEqual(report.missingRequiredIndexes,[]);
 assert.deepEqual(report.missingRequiredTriggers,[]);
 assert.ok(report.indexCount>0);
 assert.ok(report.triggerCount>=2);
 assert.equal(report.mode,'offline-only');
 assert.doesNotMatch(source,/pg_catalog|information_schema|DATABASE_URL/);
 assert.deepEqual(report.missingPrimaryKeyGuards,[]);
 assert.equal(report.missingReplicationCaptureTriggers.length,0);
});

test('forward migration rejects NULL text primary keys on insert and update',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('PRAGMA foreign_keys=ON');
  for(const filename of readdirSync('db/d1-migrations').filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync(`db/d1-migrations/${filename}`,'utf8'));
  assert.throws(()=>db.prepare("INSERT INTO students(id,display_name,certificate_name) VALUES(NULL,'Student','Student')").run(),/primary key cannot be NULL/);
  db.prepare("INSERT INTO students(id,display_name,certificate_name) VALUES('student','Student','Student')").run();
  assert.throws(()=>db.prepare("UPDATE students SET id=NULL WHERE id='student'").run(),/primary key cannot be NULL/);
 }finally{db.close();}
});

test('forward media reference guards validate new references and preserve ON DELETE SET NULL behavior',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('PRAGMA foreign_keys=ON');
  for(const filename of readdirSync('db/d1-migrations').filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync(`db/d1-migrations/${filename}`,'utf8'));
  db.prepare("INSERT INTO media_assets(id,title,provider,source_type,processing_status) VALUES('asset','Asset','r2','HLS','READY')").run();
  db.prepare("INSERT INTO courses(id,slug,title) VALUES('course','course','Course')").run();
  db.prepare("INSERT INTO course_modules(id,course_id,title) VALUES('module','course','Module')").run();
  db.prepare("INSERT INTO lessons(id,module_id,title,media_asset_id) VALUES('lesson','module','Lesson','asset')").run();
  db.prepare("INSERT INTO live_batches(id,slug,title,status) VALUES('batch','batch','Batch','ACTIVE')").run();
  db.prepare("INSERT INTO live_sessions(id,batch_id,title,position,starts_at,duration_seconds,media_asset_id) VALUES('session','batch','Session',1,'2026-10-17T00:00:00Z',120,'asset')").run();
  assert.throws(()=>db.prepare("INSERT INTO lessons(id,module_id,title,media_asset_id) VALUES('bad-lesson','module','Bad','missing')").run(),/FOREIGN KEY constraint failed/);
  assert.throws(()=>db.prepare("UPDATE live_sessions SET media_asset_id='missing' WHERE id='session'").run(),/FOREIGN KEY constraint failed/);
  db.prepare("DELETE FROM media_assets WHERE id='asset'").run();
  assert.equal(db.prepare("SELECT media_asset_id FROM lessons WHERE id='lesson'").get().media_asset_id,null);
  assert.equal(db.prepare("SELECT media_asset_id FROM live_sessions WHERE id='session'").get().media_asset_id,null);
 }finally{db.close();}
});
