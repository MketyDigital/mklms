import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
test('D1 ingest and watch credits enforce media relations and credit bounds',()=>{
 const db=new DatabaseSync(':memory:');
 try {
  for(const filename of ['0001_foundation','0002_live_sessions','0003_learning','0004_certificates','0005_media','0006_playback_grants','0007_messages','0008_media_ingest_watch'])
   db.exec(readFileSync('db/d1-migrations/'+filename+'.sql','utf8'));
  db.prepare("INSERT INTO media_assets(id,title,provider,source_type) VALUES('asset','Video','r2','DIRECT')").run();
  db.prepare("INSERT INTO media_ingest_jobs(id,media_asset_id,title,state) VALUES('job','asset','Upload','SOURCE_UPLOADED')").run();
  assert.throws(()=>db.prepare("INSERT INTO media_ingest_jobs(id,title,state) VALUES('invalid','Bad','NOT_A_STATE')").run());
  db.prepare("INSERT INTO students(id,display_name,certificate_name) VALUES('s','S','S')").run();
  db.prepare("INSERT INTO courses(id,slug,title) VALUES('c','c','C')").run();
  db.prepare("INSERT INTO course_modules(id,course_id,title) VALUES('m','c','M')").run();
  db.prepare("INSERT INTO lessons(id,module_id,title) VALUES('l','m','L')").run();
  db.prepare("INSERT INTO media_playback_grants(id,student_id,course_id,lesson_id,media_asset_id,started_at,expires_at) VALUES('g','s','c','l','asset','2026-10-17','2026-10-18')").run();
  db.prepare("INSERT INTO media_watch_credits(grant_id,student_id,course_id,lesson_id,credited_seconds) VALUES('g','s','c','l',2)").run();
  assert.throws(()=>db.prepare("UPDATE media_watch_credits SET credited_seconds=-1 WHERE grant_id='g'").run());
  db.prepare("DELETE FROM media_playback_grants WHERE id='g'").run();
  assert.equal(db.prepare("SELECT count(*) AS n FROM media_watch_credits").get().n,0);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close()}
});
