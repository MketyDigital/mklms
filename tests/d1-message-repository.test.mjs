import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import { D1MessageRepository } from '../src/features/messages/repositories/d1-message.repository.ts';
import { D1AccessRepository } from '../src/features/access/repositories/d1-access.repository.ts';

function d1(db){return{prepare(sql){let p=[];const s={bind(...v){p=v;return s;},async all(){return{success:true,results:db.prepare(sql).all(...p)};},async first(){return db.prepare(sql).get(...p)??null;},async run(){return{success:true,meta:{changes:Number(db.prepare(sql).run(...p).changes)}};}};return s;}};}
async function setup(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of(await readdir('db/d1-migrations')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile(`db/d1-migrations/${f}`,'utf8'));const access=new D1AccessRepository(d1(db));const messages=new D1MessageRepository(d1(db));const student=await access.createStudent({displayName:'Student',email:'student@example.com',certificateName:'Student'});return{db,messages,student};}

test('D1 messaging creates one thread per student and preserves message snapshots/context/order',async()=>{const{db,messages,student}=await setup();try{const [one,two]=await Promise.all([messages.getOrCreateThread(student.id),messages.getOrCreateThread(student.id)]);assert.equal(one,two);const studentMessage=await messages.sendStudentMessage(student.id,'Student Name','  Need help  ');const adminMessage=await messages.sendAdminMessage(student.id,'Admin','  Reply  ',{type:'course',id:'course-1'});assert.equal(studentMessage.text,'Need help');assert.equal(adminMessage.contextType,'course');assert.equal(adminMessage.contextId,'course-1');const thread=await messages.listThreads();assert.equal(thread.length,1);assert.equal(thread[0].lastMessage,'Reply');assert.equal(thread[0].unread,true);assert.deepEqual((await messages.getThreadMessages(one)).map(x=>x.text),['Need help','Reply']);assert.equal(await messages.getStudentIdForThread(one),student.id);assert.equal(db.prepare('SELECT count(*) AS n FROM message_threads WHERE student_id=?').get(student.id).n,1);
}finally{db.close();}});

test('student and admin reads clear only the opposing sender unread state',async()=>{const{db,messages,student}=await setup();try{const thread=await messages.getOrCreateThread(student.id);await messages.sendStudentMessage(student.id,'Student','Question');assert.equal((await messages.listThreads())[0].unread,true);await messages.markThreadRead(thread);assert.equal((await messages.listThreads())[0].unread,false);await messages.sendAdminReply(thread,'Admin','Answer');assert.equal(db.prepare("SELECT read_by_student_at IS NULL AS unread FROM messages WHERE sender_role='ADMIN'").get().unread,1);const listed=await messages.listStudentMessages(student.id);assert.equal(listed.at(-1).senderRole,'ADMIN');assert.equal(db.prepare("SELECT read_by_student_at IS NULL AS unread FROM messages WHERE sender_role='ADMIN'").get().unread,0);
}finally{db.close();}});

test('D1 admin replies reject missing thread foreign keys without stray messages',async()=>{const{db,messages}=await setup();try{await assert.rejects(messages.sendAdminReply('missing','Admin','Hello'));assert.equal(db.prepare('SELECT count(*) AS n FROM messages').get().n,0);
}finally{db.close();}});
