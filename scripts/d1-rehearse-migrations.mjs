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
 console.log(JSON.stringify({mode:'offline-only',applied:names,tables,foreignKeyCheck:'passed'},null,2));
}finally{db.close();}
