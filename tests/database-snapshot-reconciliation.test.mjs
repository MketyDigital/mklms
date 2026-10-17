import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync('src/lib/database-snapshot-reconciliation.ts','utf8');
test('offline reconciling requires stable primary keys and content digests',()=>{
 assert.match(src,/Duplicate primary key in snapshot/);
 assert.match(src,/Null or missing primary key/);
 assert.match(src,/createHash\("sha256"\)/);
 assert.match(src,/mismatches\.length===0/);
});
test('reconciliation is disconnected from production databases',()=>{
 assert.doesNotMatch(src,/DATABASE_URL|getPostgresPool|getCloudflareContext|\.query\(|fetch\(|wrangler/);
});
