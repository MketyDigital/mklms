#!/usr/bin/env node
/**
 * Offline database column coverage inventory. Does not connect to a database.
 * Report is advisory unless --require-complete; runtime SQL parity is a separate gate.
 */
import { readdir, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const root=process.cwd();
async function readMigrations(dir) {
 const files=(await readdir(join(root,dir))).filter(x=>x.endsWith('.sql')).sort();
 return Promise.all(files.map(async name=>({name,sql:await readFile(join(root,dir,name),'utf8')})));
}
function splitColumns(sql,start) {
 let depth=0,quote=null,part='',parts=[];
 for(let i=start;i<sql.length;i++){
  const c=sql[i];
  if(quote){part+=c;if(c===quote && sql[i-1]!=='\\')quote=null;continue;}
  if(c==="'"||c==='"'){quote=c;part+=c;continue;}
  if(c==='('){depth++;part+=c;continue;}
  if(c===')'){if(depth===0){parts.push(part);return parts;}depth--;part+=c;continue;}
  if(c===',' && depth===0){parts.push(part);part='';continue;}
  part+=c;
 }
 throw new Error('Unterminated CREATE TABLE column list');
}
function pgColumnMap(files){
 const map=new Map();
 for(const {sql} of files){
  for(const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi)){
   const table=match[1].toLowerCase();
   if(!map.has(table))map.set(table,new Set());
   const end=match.index+match[0].length;
   for(const clause of splitColumns(sql,end)){
    const m=clause.trim().match(/^"?([a-z_][a-z0-9_]*)"?\s+/i);
    if(m && !['constraint','primary','foreign','unique','check'].includes(m[1].toLowerCase()))
     map.get(table).add(m[1].toLowerCase());
   }
  }
  for(const match of sql.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s+([\s\S]*?);/gi)){
   if(!map.has(match[1].toLowerCase()))continue;
   for(const addition of match[2].matchAll(/\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?/gi)){
    map.get(match[1].toLowerCase()).add(addition[1].toLowerCase());
   }
  }
 }
 return map;
}
const pgFiles=await readMigrations('db/migrations');
const pg=pgColumnMap(pgFiles);
const semanticColumnMappings={
 managed_hosting_months:{minimum_floor_usd:'minimum_floor_cents',amount_due_usd:'amount_due_cents',settled_amount_usd:'settled_amount_cents'},
 managed_hosting_operator_policy:{minimum_monthly_fee_usd:'minimum_monthly_fee_cents',maximum_monthly_fee_usd:'maximum_monthly_fee_cents'},
 managed_hosting_daily_ledger:{automatic_balance_usd:'automatic_balance_cents',operator_adjustment_usd:'operator_adjustment_cents'},
};
const d1files=await readMigrations('db/d1-migrations');
const db=new DatabaseSync(':memory:');
let report;
try{
 db.exec('PRAGMA foreign_keys=ON');
 for(const {name,sql} of d1files){
  try{db.exec(sql);}catch(e){throw new Error('D1 migration '+name+' failed: '+e.message);}
 }
 // Apply the effective DROP TABLE sequence after collecting historical CREATEs.
 // In particular, PG 011 removes a legacy table that remains in earlier history.
 for (const {sql} of pgFiles) {
  for (const match of sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi)) {
   pg.delete(match[1].toLowerCase());
  }
 }
 const mismatches=[];
 const semanticMappings=[];
 for(const [table,columns] of pg){
  const actual=new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map(x=>String(x.name).toLowerCase()));
  const mapped=[];
  const missing=[...columns].filter(x=>{
   if(actual.has(x))return false;
   const target=semanticColumnMappings[table]?.[x];
   if(target&&actual.has(target)){mapped.push({source:x,target,conversion:'exact USD decimal string ↔ integer cents'});return false;}
   return true;
  }).sort();
  if(missing.length)mismatches.push({table,missing});
  if(mapped.length)semanticMappings.push({table,columns:mapped});
 }
 report={mode:'offline-only',sourceTables:pg.size,d1Migrations:d1files.length,semanticMappings,
  missingTableCount:mismatches.filter(x=>db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(x.table)===undefined).length,
  missingColumns:mismatches,complete:mismatches.length===0};
}finally{db.close();}
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--require-complete')&&!report.complete)process.exitCode=1;
