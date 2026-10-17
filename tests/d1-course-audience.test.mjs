import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
test('D1 auto enrollment activates one record, preserves completions and excludes inactive students',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const n of ['0001_foundation','0002_live_sessions','0003_learning','0012_course_audience'])
   db.exec(readFileSync('db/d1-migrations/'+n+'.sql','utf8'));
  db.prepare("INSERT INTO courses(id,slug,title,assignment_mode) VALUES('c','c','C','ALL_ACTIVE_STUDENTS')").run();
  db.prepare("INSERT INTO students(id,display_name,certificate_name,status) VALUES('s','S','S','INACTIVE')").run();
  assert.equal(db.prepare('SELECT count(*) AS n FROM enrollments').get().n,0);
  db.prepare("UPDATE students SET status='ACTIVE' WHERE id='s'").run();
  assert.equal(db.prepare('SELECT count(*) AS n FROM enrollments').get().n,1);
  db.prepare("UPDATE enrollments SET status='COMPLETED'").run();
  db.prepare("UPDATE students SET status='INACTIVE' WHERE id='s'").run();
  db.prepare("UPDATE students SET status='ACTIVE' WHERE id='s'").run();
  assert.equal(db.prepare("SELECT status FROM enrollments").get().status,'COMPLETED');
  assert.equal(db.prepare('SELECT count(*) AS n FROM enrollments').get().n,1);
 }finally{db.close()}
});
