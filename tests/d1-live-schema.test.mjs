import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

test('D1 live schema enforces one schedule and staged chat ordering', () => {
 const db = new DatabaseSync(':memory:');
 try {
  db.exec(readFileSync('db/d1-migrations/0001_foundation.sql','utf8'));
  db.exec(readFileSync('db/d1-migrations/0002_live_sessions.sql','utf8'));
  db.prepare("INSERT INTO live_batches(id,slug,title) VALUES ('b','session','Session')").run();
  db.prepare("INSERT INTO live_sessions(id,batch_id,title,position,starts_at,duration_seconds) VALUES ('s','b','First',1,'2026-10-17T10:00:00Z',3600)").run();
  assert.throws(() => db.prepare("INSERT INTO live_sessions(id,batch_id,title,position,starts_at,duration_seconds) VALUES ('duplicate','b','Second',1,'2026-10-17T10:00:00Z',3600)").run());
  assert.throws(() => db.prepare("INSERT INTO live_sessions(id,batch_id,title,position,starts_at,duration_seconds) VALUES ('invalid','b','Invalid',2,'2026-10-17T10:00:00Z',0)").run());
  db.prepare("INSERT INTO live_timeline_messages(id,session_id,offset_seconds,display_name,message,position) VALUES ('later','s',60,'Instructor','Later',0)").run();
  db.prepare("INSERT INTO live_timeline_messages(id,session_id,offset_seconds,display_name,message,position) VALUES ('earlier','s',30,'Instructor','Earlier',0)").run();
  const messages = db.prepare("SELECT id FROM live_timeline_messages WHERE session_id=? ORDER BY offset_seconds, position").all('s');
  assert.deepEqual(messages.map(m => m.id), ['earlier','later']);
  assert.throws(() => db.prepare("INSERT INTO live_timeline_messages(id,session_id,offset_seconds,display_name,message) VALUES ('bad','s',-1,'A','Invalid')").run());
  db.prepare("INSERT INTO live_viewers(id,batch_id,session_id,viewer_token_hash) VALUES ('v','b','s','hash')").run();
  assert.throws(() => db.prepare("INSERT INTO live_viewers(id,batch_id,viewer_token_hash) VALUES ('v2','b','hash')").run());
  db.prepare("INSERT INTO live_attendee_messages(id,batch_id,session_id,viewer_id,message) VALUES ('msg','b','s','v','Hello')").run();
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  db.prepare("DELETE FROM live_batches WHERE id='b'").run();
  assert.equal(db.prepare('SELECT count(*) AS n FROM live_attendee_messages').get().n,0);
 } finally { db.close(); }
});
