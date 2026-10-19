#!/usr/bin/env node
// Read-only D1 coverage gate: identifies source tables missing from D1 migrations.
// Never opens a connection, executes SQL, or modifies production.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
async function readSql(dir) {
 const files=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();
 const migrations=await Promise.all(files.map(async name=>({name,sql:await readFile(path.join(root,dir,name),'utf8')})));
 return {files, migrations, text:migrations.map(m=>m.sql).join('\n')};
}
const pg=await readSql('db/migrations');
const d1=await readSql('db/d1-migrations');
function finalTables(migrations){
 const tables=new Set();
 for(const {sql} of migrations){
  const tableDdl=/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["`]?([a-z_][a-z0-9_]*)["`]?|\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?["`]?([a-z_][a-z0-9_]*)["`]?|\bALTER\s+TABLE\s+(?:public\.)?["`]?([a-z_][a-z0-9_]*)["`]?(?:\s+RENAME\s+TO\s+["`]?([a-z_][a-z0-9_]*)["`]?)/gi;
  for(const match of sql.matchAll(tableDdl)){
   if(match[1])tables.add(match[1].toLowerCase());
   else if(match[2])tables.delete(match[2].toLowerCase());
   else if(match[3]&&match[4]){
    const oldName=match[3].toLowerCase();
    if(tables.delete(oldName))tables.add(match[4].toLowerCase());
   }
  }
 }
 return tables;
}
const original=[...finalTables(pg.migrations)].sort();
const converted=finalTables(d1.migrations);
const missing=original.filter(table=>!converted.has(table));
const report={sourceMigrations:pg.files.length,d1Migrations:d1.files.length,sourceTables:original.length,convertedTables:original.length-missing.length,missingTables:missing,complete:missing.length===0};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--require-complete')&&!report.complete)process.exitCode=1;
