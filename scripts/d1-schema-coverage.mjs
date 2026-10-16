#!/usr/bin/env node
// Read-only D1 coverage gate: identifies source tables missing from D1 migrations.
// Never opens a connection, executes SQL, or modifies production.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
async function readSql(dir) {
 const files=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();
 return {files, text:(await Promise.all(files.map(f=>readFile(path.join(root,dir,f),'utf8')))).join('\n')};
}
const pg=await readSql('db/migrations');
const d1=await readSql('db/d1-migrations');
const tableNames=sql=>new Set([...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi)].map(m=>m[1].toLowerCase()));
const original=[...tableNames(pg.text)].sort();
const converted=tableNames(d1.text);
const missing=original.filter(table=>!converted.has(table));
const report={sourceMigrations:pg.files.length,d1Migrations:d1.files.length,sourceTables:original.length,convertedTables:original.length-missing.length,missingTables:missing,complete:missing.length===0};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--require-complete')&&!report.complete)process.exitCode=1;
