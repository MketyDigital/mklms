import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
test('free-live chat defaults private while owner may choose public',()=>{
 const db=new DatabaseSync(':memory:');
 try {
  db.exec(readFileSync('db/d1-migrations/0001_foundation.sql','utf8'));
  db.exec(readFileSync('db/d1-migrations/0002_live_sessions.sql','utf8'));
  db.exec(readFileSync('db/d1-migrations/0011_free_live_chat_visibility.sql','utf8'));
  db.prepare("INSERT INTO live_batches(id,slug,title) VALUES('b','batch','Live')").run();
  assert.equal(db.prepare("SELECT attendee_chat_visibility AS v FROM live_batches WHERE id='b'").get().v,'OWNER_ONLY');
  db.prepare("UPDATE live_batches SET attendee_chat_visibility='PUBLIC' WHERE id='b'").run();
  assert.throws(()=>db.prepare("UPDATE live_batches SET attendee_chat_visibility='EVERYWHERE' WHERE id='b'").run());
 }finally{db.close()}
});
