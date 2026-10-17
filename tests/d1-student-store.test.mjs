import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { D1StudentStore } from '../src/features/access/repositories/d1-student.store.ts';
function adapter(db){return {prepare(sql){return {bind(...args){return {
 async all(){return {success:true,results:db.prepare(sql).all(...args)}},
 async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}
 }}}},async batch(){throw Error('unused')}}}
test('D1 student creation normalizes identity and rejects duplicate emails',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(readFileSync('db/d1-migrations/0001_foundation.sql','utf8'));
  const store=new D1StudentStore(adapter(db));
  const input={display_name:'Student',email:' USER@example.com ',phone:'+1 (555) 123',
    certificate_name:'Certificate Student',certificate_email:'CERT@EXAMPLE.COM'};
  const row=await store.create(input);
  assert.match(row.id,/^[0-9a-f-]{36}$/);
  assert.equal(row.email,'user@example.com');
  assert.equal(row.phone,'1555123');
  assert.equal((await store.findActiveById(row.id))?.certificate_email,'cert@example.com');
  await assert.rejects(store.create({...input,email:'USER@EXAMPLE.COM'}));
  db.prepare("UPDATE students SET status='INACTIVE' WHERE id=?").run(row.id);
  assert.equal(await store.findActiveById(row.id),null);
  await assert.rejects(store.create({...input,display_name:' '}));
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close()}
});
