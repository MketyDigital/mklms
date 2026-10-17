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
  for(const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi))tables.add(match[1].toLowerCase());
  for(const match of sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi))tables.delete(match[1].toLowerCase());
 }
 return tables;
}
const original=[...finalTables(pg.migrations)].sort();
const converted=finalTables(d1.migrations);
const missing=original.filter(table=>!converted.has(table));
const report={sourceMigrations:pg.files.length,d1Migrations:d1.files.length,sourceTables:original.length,convertedTables:original.length-missing.length,missingTables:missing,complete:missing.length===0};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--require-complete')&&!report.complete)process.exitCode=1;
