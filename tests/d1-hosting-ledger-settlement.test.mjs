import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

test('D1 hosting ledger and settlement reject invalid balances and duplicate payment references',()=>{
 const db=new DatabaseSync(':memory:');
 try {
  for(const n of ['0001_foundation','0002_live_sessions','0003_learning','0004_certificates','0005_media','0006_playback_grants','0007_messages','0008_media_ingest_watch','0009_managed_hosting_foundation','0013_hosting_ledger_settlement'])
   db.exec(readFileSync('db/d1-migrations/'+n+'.sql','utf8'));
  db.prepare("INSERT INTO managed_hosting_daily_ledger(billing_date,month_key,automatic_balance_cents) VALUES('2026-10-17','2026-10',1500)").run();
  assert.throws(()=>db.prepare("INSERT INTO managed_hosting_daily_ledger(billing_date,month_key,measured_watch_minutes) VALUES('2026-10-18','2026-10',-1)").run());
  assert.throws(()=>db.prepare("UPDATE managed_hosting_daily_ledger SET streaming_activity_band='INVALID'").run());
  db.prepare("INSERT INTO managed_hosting_months(month_key,payment_id,settled_amount_cents) VALUES('2026-10','payment-1',1500)").run();
  assert.throws(()=>db.prepare("INSERT INTO managed_hosting_months(month_key,payment_id,settled_amount_cents) VALUES('2026-11','payment-1',1500)").run());
  assert.throws(()=>db.prepare("UPDATE managed_hosting_months SET settled_amount_cents=-1").run());
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close()}
});
