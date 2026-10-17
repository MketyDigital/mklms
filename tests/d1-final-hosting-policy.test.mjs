import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
test('D1 final hosting policy and scoped certificates follow PostgreSQL 006/011/015',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const n of ['0001_foundation','0002_live_sessions','0003_learning','0004_certificates','0005_media','0006_playback_grants','0007_messages','0008_media_ingest_watch','0009_managed_hosting_foundation','0010_quizzes_paid_live','0011_free_live_chat_visibility','0012_course_audience','0013_hosting_ledger_settlement','0014_settings_optional_columns','0015_hosting_operator_policy'])
    db.exec(readFileSync('db/d1-migrations/'+n+'.sql','utf8'));
  assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='managed_hosting_settings'").get().n,0);
  assert.equal(db.prepare("SELECT minimum_monthly_fee_cents AS n FROM managed_hosting_operator_policy WHERE id=1").get().n,1500);
  assert.throws(()=>db.prepare("INSERT INTO managed_hosting_operator_policy(id) VALUES(2)").run());
  assert.throws(()=>db.prepare("UPDATE managed_hosting_operator_policy SET grace_days=32 WHERE id=1").run());
  db.prepare("INSERT INTO managed_hosting_months(month_key,amount_due_cents) VALUES('2026-10',1500)").run();
  assert.throws(()=>db.prepare("UPDATE managed_hosting_months SET amount_due_cents=-1 WHERE month_key='2026-10'").run());
  assert.ok(db.prepare("PRAGMA table_info(certificate_templates)").all().some(c=>c.name==='course_id'));
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close()}
});
