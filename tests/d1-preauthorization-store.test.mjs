import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {D1PreauthorizationStore} from '../src/features/access/repositories/d1-preauthorization.store.ts';
function adapter(db){return {prepare(sql){return {bind(...args){return {
 async all(){return {success:true,results:db.prepare(sql).all(...args)}},
 async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}
 }}}},async batch(){throw Error('unused')}}}
test('D1 preauthorizations normalize identity and only return unclaimed records',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(readFileSync('db/d1-migrations/0001_foundation.sql','utf8'));
  db.prepare("INSERT INTO preauthorizations(id,email,phone) VALUES('p','user@example.com','15551234')").run();
  const store=new D1PreauthorizationStore(adapter(db));
  assert.equal((await store.findUnclaimed({email:' USER@EXAMPLE.COM '}))?.id,'p');
  assert.equal((await store.findUnclaimed({phone:'1 (555) 1234'}))?.id,'p');
  assert.equal(await store.findUnclaimed({}),null);
  assert.equal(await store.markClaimRequested('p'),1);
  const first=db.prepare("SELECT claim_requested_at AS t FROM preauthorizations WHERE id='p'").get().t;
  assert.equal(await store.markClaimRequested('p'),1);
  assert.equal(db.prepare("SELECT claim_requested_at AS t FROM preauthorizations WHERE id='p'").get().t,first);
  db.prepare("UPDATE preauthorizations SET status='CLAIMED' WHERE id='p'").run();
  assert.equal(await store.findUnclaimed({email:'user@example.com'}),null);
  assert.equal(await store.markClaimRequested('p'),0);
 }finally{db.close()}
});
