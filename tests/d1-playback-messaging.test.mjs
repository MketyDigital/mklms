import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
test('D1 playback authorization and messages enforce access and ordering constraints',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const filename of ['0001_foundation','0002_live_sessions','0003_learning','0004_certificates','0005_media','0006_playback_grants','0007_messages']) db.exec(readFileSync('db/d1-migrations/'+filename+'.sql','utf8'));
  db.prepare("INSERT INTO students(id,display_name,certificate_name) VALUES('s','Student','Student')").run();
  db.prepare("INSERT INTO courses(id,slug,title) VALUES('c','course','Course')").run();
  db.prepare("INSERT INTO course_modules(id,course_id,title) VALUES('m','c','Module')").run();
  db.prepare("INSERT INTO lessons(id,module_id,title) VALUES('l','m','Lesson')").run();
  db.prepare("INSERT INTO media_assets(id,title,provider,source_type) VALUES('a','Video','r2','DIRECT')").run();
  db.prepare("INSERT INTO media_playback_grants(id,student_id,course_id,lesson_id,media_asset_id,started_at,expires_at) VALUES('g','s','c','l','a','2026-10-17T00:00:00Z','2026-10-17T01:00:00Z')").run();
  assert.throws(()=>db.prepare("INSERT INTO media_playback_grants(id,student_id,course_id,lesson_id,media_asset_id,started_at,expires_at) VALUES('bad','s','c','l','absent','2026-10-17','2026-10-18')").run());
  db.prepare("INSERT INTO message_threads(id,student_id) VALUES('t','s')").run();
  assert.throws(()=>db.prepare("INSERT INTO message_threads(id,student_id) VALUES('duplicate','s')").run());
  assert.throws(()=>db.prepare("INSERT INTO messages(id,thread_id,sender_role,sender_name_snapshot,text) VALUES('bad','t','PUBLIC','A','No')").run());
  db.prepare("INSERT INTO messages(id,thread_id,sender_role,sender_name_snapshot,text) VALUES('ok','t','STUDENT','Student','Hello')").run();
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  db.prepare("DELETE FROM students WHERE id='s'").run();
  assert.equal(db.prepare('SELECT count(*) AS n FROM media_playback_grants').get().n,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM messages').get().n,0);
 }finally{db.close()}
});
