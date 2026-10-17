import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import { D1LearningRepository } from '../src/features/courses/repositories/d1-learning.repository.ts';
import { StudentLearningService } from '../src/features/courses/services/student-learning.service.ts';
import { LearningProgressService } from '../src/features/courses/services/learning-progress.service.ts';
import { D1AccessRepository } from '../src/features/access/repositories/d1-access.repository.ts';

function d1(db) {
  return {
    prepare(sql) { let params=[]; const statement={ bind(...values){params=values;return statement;}, async all(){return {success:true,results:db.prepare(sql).all(...params)};}, async first(){return db.prepare(sql).get(...params)??null;}, async run(){return {success:true,meta:{changes:Number(db.prepare(sql).run(...params).changes)}};}, _run(){return db.prepare(sql).run(...params);} }; return statement; },
    async batch(statements){db.exec('BEGIN');try{const result=statements.map(s=>({success:true,meta:{changes:Number(s._run().changes)}}));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}},
  };
}
async function setup(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of (await readdir('db/d1-migrations')).filter(x=>x.endsWith('.sql')).sort())db.exec(await readFile(`db/d1-migrations/${f}`,'utf8'));return {db,repo:new D1LearningRepository(d1(db)),access:new D1AccessRepository(d1(db))};}
async function seed(db,access){
  db.prepare("INSERT INTO courses(id,slug,title,status) VALUES('c','c','Course','PUBLISHED')").run();
  db.prepare("INSERT INTO course_modules(id,course_id,title,position) VALUES('m','c','Module',1)").run();
  db.prepare("INSERT INTO lessons(id,module_id,title,position,status,completion_mode,completion_threshold_percent) VALUES('l1','m','One',1,'PUBLISHED','MANUAL',100),('l2','m','Two',2,'PUBLISHED','VIDEO_PROGRESS',75)").run();
  const student=await access.createStudent({displayName:'Student',email:'student@example.com',certificateName:'Student'});
  await access.activateEnrollment(student.id,'c'); return student;
}

test('D1 learning repository matches service contracts for course view, progress and completion',async()=>{
  const {db,repo,access}=await setup();try{const student=await seed(db,access);const view=await new StudentLearningService(repo).getCourseView(student.id,'c');assert.equal(view.modules[0].lessons.length,2);assert.equal(view.modules[0].lessons[0].locked,false);
    const service=new LearningProgressService(repo);const manual=await service.completeLesson(student.id,'c','l1');assert.equal(manual.ok,true);assert.equal((await repo.getLessonProgress(student.id,'c','l1')).completed,true);
    const video=await service.recordVideoProgress(student.id,'c','l2',{progressPercent:75,lastPositionSeconds:42});assert.equal(video.ok,true);assert.equal(video.lessonCompleted,true);assert.equal(db.prepare("SELECT status FROM enrollments WHERE student_id=? AND course_id='c'").get(student.id).status,'COMPLETED');
  }finally{db.close();}
});

test('D1 lesson progress preserves monotonic maxima and existing completion time',async()=>{
  const {db,repo,access}=await setup();try{const student=await seed(db,access);await repo.saveLessonProgress(student.id,'c','l2',80,90,true);const before=db.prepare("SELECT completed_at FROM lesson_progress WHERE student_id=? AND lesson_id='l2'").get(student.id).completed_at;await repo.saveLessonProgress(student.id,'c','l2',20,10,false);const row=db.prepare("SELECT progress_percent,last_position_seconds,completed_at FROM lesson_progress WHERE student_id=? AND lesson_id='l2'").get(student.id);assert.equal(row.progress_percent,80);assert.equal(row.last_position_seconds,90);assert.equal(row.completed_at,before);
  }finally{db.close();}
});
