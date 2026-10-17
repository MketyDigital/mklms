import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {activateD1AllActiveCourse} from '../src/lib/d1-all-active-enrollment.ts';
import {allActiveEnrollmentId} from '../src/lib/all-active-enrollment-id.ts';

function d1ForSqlite(db){
 return {prepare(sql){return {bind(...values){return {
  async run(){const out=db.prepare(sql).run(...values);return {success:true,meta:{changes:Number(out.changes)}}}
 }}},batch(){throw Error('unused')}}};
}
test('D1 enrollment SQL matches PostgreSQL deterministic IDs and preserves completions',async()=>{
 const db=new DatabaseSync(':memory:');
 try {
  for(const n of ['0001_foundation','0002_live_sessions','0003_learning','0012_course_audience'])
   db.exec(readFileSync('db/d1-migrations/'+n+'.sql','utf8'));
  const adapter=d1ForSqlite(db);
  db.prepare("INSERT INTO students(id,display_name,certificate_name) VALUES('s','S','S')").run();
  db.prepare("INSERT INTO courses(id,slug,title,assignment_mode) VALUES('c','c','C','ALL_ACTIVE_STUDENTS')").run();
  assert.equal(await activateD1AllActiveCourse(adapter,'s','c'),1);
  assert.equal(db.prepare('SELECT id FROM enrollments').get().id,allActiveEnrollmentId('s','c'));
  db.prepare("UPDATE enrollments SET status='COMPLETED'").run();
  assert.equal(await activateD1AllActiveCourse(adapter,'s','c'),1);
  assert.equal(db.prepare('SELECT status FROM enrollments').get().status,'COMPLETED');
  assert.equal(db.prepare('SELECT count(*) AS n FROM enrollments').get().n,1);
  db.prepare("UPDATE students SET status='INACTIVE' WHERE id='s'").run();
  assert.equal(await activateD1AllActiveCourse(adapter,'s','c'),0);
  db.prepare("UPDATE courses SET assignment_mode='SELECTED_STUDENTS' WHERE id='c'").run();
  assert.equal(await activateD1AllActiveCourse(adapter,'s','c'),0);
 }finally{db.close()}
});
