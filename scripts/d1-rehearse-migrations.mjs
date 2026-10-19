#!/usr/bin/env node
/**
 * Offline D1 schema rehearsal. Never connects to production, Cloudflare or PostgreSQL.
 * Fails closed on missing migrations, malformed SQL, or broken foreign keys.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const dir=path.join(process.cwd(),'db/d1-migrations');
const names=(await readdir(dir)).filter(x=>/^\d{4}_[a-z0-9_]+\.sql$/.test(x)).sort();
if(!names.length)throw new Error('No D1 migration files');
if(process.argv.some(x=>x==='--remote'||x==='--production'||x==='--apply')) {
 throw new Error('Production execution is forbidden in this offline rehearsal');
}
const db=new DatabaseSync(':memory:');
try {
 db.exec('PRAGMA foreign_keys = ON;');
 for(const filename of names){
  const sql=await readFile(path.join(dir,filename),'utf8');
  db.exec(sql);
  const issues=db.prepare('PRAGMA foreign_key_check').all();
  if(issues.length)throw new Error('Foreign-key violations after '+filename);
 }
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x=>x.name);
 const indexes=db.prepare("SELECT name,tbl_name,sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
 const triggers=db.prepare("SELECT name,tbl_name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all();
 const integrity=db.prepare('PRAGMA integrity_check').all().map(row=>Object.values(row)[0]);
 const foreignKeys=db.prepare('PRAGMA foreign_key_check').all();
 const requiredIndexes=['courses_assignment_mode_status_idx','certificate_templates_course_active_idx','managed_hosting_daily_ledger_month_idx','managed_hosting_months_payment_id_idx','mklms_replication_journal_replay_idx','mklms_replication_dead_letters_retry_idx'];
 const requiredTriggers=['mklms_students_all_active_enrollment_after_insert','mklms_students_all_active_enrollment_after_status_change','lessons_media_asset_fk_insert','lessons_media_asset_fk_update','media_assets_lessons_set_null','live_sessions_media_asset_fk_insert','live_sessions_media_asset_fk_update','media_assets_live_sessions_set_null'];
 const replicationTables=tables.filter(name=>!name.startsWith('mklms_replication_')&&name!=='mklms_d1_atomic_assertions'&&!name.startsWith('_mklms_'));
 const missingReplicationCaptureTriggers=replicationTables.flatMap(table=>['insert','update','delete'].filter(event=>!triggers.some(trigger=>trigger.name===`mklms_replication_capture_${table}_${event}`)).map(event=>`${table}:${event}`));
 const missingIndexes=requiredIndexes.filter(name=>!indexes.some(index=>index.name===name));
 const missingTriggers=requiredTriggers.filter(name=>!triggers.some(trigger=>trigger.name===name));
 const missingPrimaryKeyGuards=[];
 for(const table of tables){
  const columns=db.prepare(`PRAGMA table_info("${table.replaceAll('"','""')}")`).all();
  for(const column of columns.filter(item=>item.pk>0&&!item.notnull&&!/^INTEGER$/i.test(item.type))){
   const suffix=`${table}_${column.name}`;
   for(const event of ['insert','update'])if(!triggers.some(trigger=>trigger.name===`mklms_pk_guard_${suffix}_${event}`))missingPrimaryKeyGuards.push(`${table}.${column.name}:${event}`);
  }
 }
 const report={mode:'offline-only',applied:names,tables,indexCount:indexes.length,triggerCount:triggers.length,missingRequiredIndexes:missingIndexes,missingRequiredTriggers:missingTriggers,replicationCaptureTableCount:replicationTables.length,missingReplicationCaptureTriggers,missingPrimaryKeyGuards,integrityCheck:integrity,foreignKeyCheck:foreignKeys.length?'failed':'passed'};
 console.log(JSON.stringify(report,null,2));
 if(integrity.length!==1||integrity[0]!=='ok'||foreignKeys.length||missingIndexes.length||missingTriggers.length||missingReplicationCaptureTriggers.length||missingPrimaryKeyGuards.length)process.exitCode=1;
}finally{db.close();}
