import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

test('D1 learning, certificate and media migration preserve critical constraints',()=>{
 const db=new DatabaseSync(':memory:');
 try {
  for(const file of ['0001_foundation','0002_live_sessions','0003_learning','0004_certificates','0005_media'])
   db.exec(readFileSync('db/d1-migrations/'+file+'.sql','utf8'));
  db.prepare("INSERT INTO students(id,display_name,certificate_name) VALUES('s','Learner','Learner')").run();
  db.prepare("INSERT INTO courses(id,slug,title) VALUES('c','course','Course')").run();
  db.prepare("INSERT INTO course_modules(id,course_id,title) VALUES('m','c','Module')").run();
  db.prepare("INSERT INTO lessons(id,module_id,title) VALUES('l','m','Lesson')").run();
  assert.throws(()=>db.prepare("INSERT INTO lessons(id,module_id,title,completion_threshold_percent) VALUES('bad','m','Bad',110)").run());
  db.prepare("INSERT INTO lesson_progress(id,student_id,course_id,lesson_id) VALUES('p','s','c','l')").run();
  assert.throws(()=>db.prepare("INSERT INTO lesson_progress(id,student_id,course_id,lesson_id) VALUES('dup','s','c','l')").run());
  db.prepare("INSERT INTO certificate_templates(id,name) VALUES('t','Template')").run();
  db.prepare("INSERT INTO certificates(id,certificate_id,student_id,course_id,template_id,certificate_name_snapshot,completion_date) VALUES('cert','CERT-1','s','c','t','Learner','2026-10-17')").run();
  assert.throws(()=>db.prepare("INSERT INTO certificates(id,certificate_id,student_id,course_id,certificate_name_snapshot,completion_date) VALUES('dup','CERT-1','s','c','Learner','2026-10-17')").run());
  db.prepare("INSERT INTO media_assets(id,title,provider,source_type) VALUES('asset','Lesson MP4','r2','DIRECT')").run();
  assert.throws(()=>db.prepare("UPDATE media_assets SET metadata_json='not-json' WHERE id='asset'").run());
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  db.prepare("DELETE FROM courses WHERE id='c'").run();
  assert.equal(db.prepare('SELECT count(*) AS n FROM certificates').get().n,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM lesson_progress').get().n,0);
 }finally{db.close()}
});
