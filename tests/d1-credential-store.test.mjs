import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {D1CredentialStore} from '../src/features/access/repositories/d1-credential.store.ts';
function adapter(db){return {prepare(sql){return {bind(...args){return {
 async all(){return {success:true,results:db.prepare(sql).all(...args)}},
 async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}
 }}}},async batch(){throw Error('unused')}}}
test('D1 credential lookup refuses inactive student and revoked credentials',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(readFileSync('db/d1-migrations/0001_foundation.sql','utf8'));
  db.prepare("INSERT INTO students(id,display_name,certificate_name) VALUES('s','Student','Student')").run();
  const store=new D1CredentialStore(adapter(db));
  await store.insertInitial({studentId:'s',lookupHash:'lookup',hash:'secret-hash',salt:'salt',algorithm:'scrypt',prefix:'ACCESS'});
  assert.equal((await store.findActiveByLookupHash('lookup'))?.studentId,'s');
  assert.equal(await store.findActiveByLookupHash('wrong'),null);
  db.prepare("UPDATE students SET status='INACTIVE' WHERE id='s'").run();
  assert.equal(await store.findActiveByLookupHash('lookup'),null);
  db.prepare("UPDATE students SET status='ACTIVE' WHERE id='s'").run();
  db.prepare("UPDATE student_access_credentials SET status='REVOKED' WHERE credential_lookup_hash='lookup'").run();
  assert.equal(await store.findActiveByLookupHash('lookup'),null);
  await assert.rejects(store.insertInitial({studentId:'s',lookupHash:'',hash:'a',salt:'b',algorithm:'scrypt',prefix:null}));
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close()}
});
