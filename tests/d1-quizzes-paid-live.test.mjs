import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

test('D1 quiz attempts and paid-course live retain separate FK and validation boundaries',()=>{
 const db=new DatabaseSync(':memory:');
 try {
  for(const name of ['0001_foundation','0002_live_sessions','0003_learning','0004_certificates','0005_media','0006_playback_grants','0007_messages','0008_media_ingest_watch','0009_managed_hosting_foundation','0010_quizzes_paid_live'])
    db.exec(readFileSync('db/d1-migrations/'+name+'.sql','utf8'));
  db.prepare("INSERT INTO students(id,display_name,certificate_name) VALUES('s','Student','Student')").run();
  db.prepare("INSERT INTO courses(id,slug,title) VALUES('c','course','Course')").run();
  db.prepare("INSERT INTO course_modules(id,course_id,title) VALUES('m','c','Module')").run();
  db.prepare("INSERT INTO quizzes(id,module_id,title) VALUES('q','m','Quiz')").run();
  assert.throws(()=>db.prepare("INSERT INTO quizzes(id,module_id,title,pass_mark_percent) VALUES('bad','m','Bad',101)").run());
  db.prepare("INSERT INTO quiz_questions(id,quiz_id,prompt) VALUES('question','q','Prompt')").run();
  db.prepare("INSERT INTO quiz_choices(id,question_id,label,is_correct) VALUES('choice','question','Yes',1)").run();
  assert.throws(()=>db.prepare("INSERT INTO quiz_choices(id,question_id,label,is_correct) VALUES('bad','question','No',4)").run());
  db.prepare("INSERT INTO quiz_attempts(id,quiz_id,student_id,course_id,score_percent) VALUES('attempt','q','s','c',90)").run();
  db.prepare("INSERT INTO quiz_attempt_answers(id,attempt_id,question_id,selected_choice_id) VALUES('answer','attempt','question','choice')").run();
  assert.throws(()=>db.prepare("INSERT INTO quiz_attempt_answers(id,attempt_id,question_id) VALUES('dup','attempt','question')").run());
  assert.throws(()=>db.prepare("INSERT INTO paid_course_live_sessions(id,course_id,title,starts_at,ends_at) VALUES('bad','c','Wrong','2026-10-18T00:00:00Z','2026-10-17T00:00:00Z')").run());
  db.prepare("INSERT INTO paid_course_live_sessions(id,course_id,title,starts_at,ends_at,delivery_mode) VALUES('zoom','c','Live','2026-10-17T00:00:00Z','2026-10-18T00:00:00Z','ZOOM')").run();
  assert.equal(db.prepare("SELECT delivery_mode FROM paid_course_live_sessions WHERE id='zoom'").get().delivery_mode,'ZOOM');
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  db.prepare("DELETE FROM courses WHERE id='c'").run();
  assert.equal(db.prepare('SELECT count(*) AS n FROM paid_course_live_sessions').get().n,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM quiz_attempts').get().n,0);
 }finally{db.close()}
});
