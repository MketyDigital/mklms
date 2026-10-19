import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import { D1PaidLiveRepository } from '../src/features/paid-live/repositories/d1-paid-live.repository.ts';
import { D1AdminLearningRepository } from '../src/features/courses/repositories/d1-admin-learning.repository.ts';
import { D1AccessRepository } from '../src/features/access/repositories/d1-access.repository.ts';

function d1(db){return{prepare(sql){let p=[];const s={bind(...v){p=v;return s;},async all(){return{success:true,results:db.prepare(sql).all(...p)};},async first(){return db.prepare(sql).get(...p)??null;},async run(){return{success:true,meta:{changes:Number(db.prepare(sql).run(...p).changes)}};}};return s;}};}
async function setup(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of(await readdir('db/d1-migrations')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile(`db/d1-migrations/${f}`,'utf8'));const sql=d1(db);const admin=new D1AdminLearningRepository(sql);const access=new D1AccessRepository(sql);const live=new D1PaidLiveRepository(sql);const course=await admin.createCourse({slug:'course',title:'Course',status:'PUBLISHED'});const student=await access.createStudent({displayName:'Student',email:'student@example.com',certificateName:'Student'});await access.activateEnrollment(student.id,course.id);const now=Date.now();const sessionId=await live.createSession({courseId:course.id,deliveryMode:'ZOOM',zoomUrl:'https://zoom.us/j/123',title:'Session',startsAt:new Date(now+60_000),endsAt:new Date(now+3_600_000)});await live.updateSession(sessionId,{deliveryMode:'ZOOM',zoomUrl:'https://zoom.us/j/123',title:'Session',startsAt:new Date(now+60_000),endsAt:new Date(now+3_600_000),status:'PUBLISHED'});return{db,live,admin,access,course,student,sessionId};}

test('D1 paid-live schedules enforce validity, map delivery mode, and require published enrollment access',async()=>{const{db,live,course,student,sessionId}=await setup();try{const row=await live.getSession(sessionId);assert.equal(row.deliveryMode,'ZOOM');assert.equal(row.mediaAssetId,null);assert.equal(row.zoomUrl,'https://zoom.us/j/123');assert.equal((await live.listForStudent(student.id)).length,1);assert.equal((await live.listByCourse(course.id,true)).length,1);await assert.rejects(live.createSession({courseId:course.id,deliveryMode:'MEDIA',title:'Invalid',startsAt:new Date('2026-10-17T12:00:00Z'),endsAt:new Date('2026-10-17T11:00:00Z')}),/after its start/);
}finally{db.close();}});

test('D1 paid-live hides ended sessions by default and includes them on request',async()=>{const{db,live,course,student,sessionId}=await setup();try{const pastStart=new Date(Date.now()-7_200_000),pastEnd=new Date(Date.now()-3_600_000);await live.updateSession(sessionId,{deliveryMode:'ZOOM',title:'Past',startsAt:pastStart,endsAt:pastEnd,status:'PUBLISHED'});assert.equal((await live.listForStudent(student.id)).length,0);assert.equal((await live.listForStudent(student.id,{includeEnded:true}))[0].title,'Past');assert.equal((await live.getEnrollment(student.id,course.id)).status,'ACTIVE');
}finally{db.close();}});

test('D1 paid-live admin changes and deletion fail clearly for missing records',async()=>{const{db,live,sessionId}=await setup();try{await live.deleteSession(sessionId);assert.equal(await live.getSession(sessionId),null);await assert.rejects(live.deleteSession(sessionId),/not found/);await assert.rejects(live.updateSession('missing',{deliveryMode:'MEDIA',title:'Missing',startsAt:new Date(),endsAt:new Date(Date.now()+1000),status:'DRAFT'}),/not found/);
}finally{db.close();}});
