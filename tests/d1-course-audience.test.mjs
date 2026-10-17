import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
test('D1 schema requires application-controlled enrollment rather than unsafe cross-backend IDs',()=>{
 const db=new DatabaseSync(':memory:');
 try {
  for(const n of ['0001_foundation','0002_live_sessions','0003_learning','0012_course_audience'])
   db.exec(readFileSync('db/d1-migrations/'+n+'.sql','utf8'));
  db.prepare("INSERT INTO courses(id,slug,title,assignment_mode) VALUES('c','c','C','ALL_ACTIVE_STUDENTS')").run();
  db.prepare("INSERT INTO students(id,display_name,certificate_name,status) VALUES('s','S','S','ACTIVE')").run();
  assert.equal(db.prepare('SELECT count(*) AS n FROM enrollments').get().n,0);
  const triggers=db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'mklms_students_all_active%'").all();
  assert.equal(triggers.length,0);
  assert.throws(()=>db.prepare("UPDATE courses SET assignment_mode='BROKEN' WHERE id='c'").run());
 }finally{db.close()}
});
