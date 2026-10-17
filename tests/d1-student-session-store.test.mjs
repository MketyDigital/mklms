import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {D1StudentSessionStore} from '../src/features/access/repositories/d1-student-session.store.ts';

function adapter(db){
 return {prepare(sql){return {bind(...values){return {
  async all(){return {success:true,results:db.prepare(sql).all(...values)}},
  async run(){const r=db.prepare(sql).run(...values);return {success:true,meta:{changes:Number(r.changes)}}}
 }}}},async batch(){throw Error('unused')}};
}
test('D1 sessions protect active, expiry and revocation boundaries',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(readFileSync('db/d1-migrations/0001_foundation.sql','utf8'));
  db.prepare("INSERT INTO students(id,display_name,certificate_name,email) VALUES('s','Student','Student','user@example.com')").run();
  const store=new D1StudentSessionStore(adapter(db));
  const expiry=new Date('2026-10-18T00:00:00.000Z');
  await store.create('s','hashed-secret',expiry);
  assert.equal((await store.lookup('hashed-secret',new Date('2026-10-17T00:00:00Z')))?.studentId,'s');
  assert.equal(await store.lookup('hashed-secret',expiry),null);
  assert.equal(await store.lookup('incorrect',new Date('2026-10-17')),null);
  db.prepare("UPDATE students SET status='SUSPENDED' WHERE id='s'").run();
  assert.equal(await store.lookup('hashed-secret',new Date('2026-10-17')),null);
  db.prepare("UPDATE students SET status='ACTIVE' WHERE id='s'").run();
  await store.revoke('hashed-secret');
  assert.equal(await store.lookup('hashed-secret',new Date('2026-10-17')),null);
  await assert.rejects(store.create('s','hashed-secret',expiry));
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close()}
});
