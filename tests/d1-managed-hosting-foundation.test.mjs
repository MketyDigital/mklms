import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
test('D1 hosted-month pricing and status enforce bounds without floating point money',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const filename of ['0001_foundation','0002_live_sessions','0003_learning','0004_certificates','0005_media','0006_playback_grants','0007_messages','0008_media_ingest_watch','0009_managed_hosting_foundation'])
    db.exec(readFileSync('db/d1-migrations/'+filename+'.sql','utf8'));
  assert.equal(db.prepare("SELECT minimum_monthly_fee_cents AS n FROM managed_hosting_settings WHERE id='default'").get().n,1500);
  assert.throws(()=>db.prepare("UPDATE managed_hosting_settings SET current_monthly_fee_cents=10000 WHERE id='default'").run());
  assert.throws(()=>db.prepare("UPDATE managed_hosting_settings SET payment_network='UNSUPPORTED' WHERE id='default'").run());
  db.prepare("INSERT INTO managed_hosting_months(month_key) VALUES('2026-10')").run();
  assert.throws(()=>db.prepare("UPDATE managed_hosting_months SET payment_status='UNKNOWN' WHERE month_key='2026-10'").run());
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close()}
});
