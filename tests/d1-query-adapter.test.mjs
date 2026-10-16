import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('src/lib/d1-query-adapter.ts','utf8');
test('D1 adapter uses parameterized prepared statements and fails closed for PostgreSQL SQL',()=>{
 assert.match(source,/db\.prepare\(query\.sql\)/);
 assert.match(source,/statement\.bind/);
 assert.match(source,/PostgreSQL SQL is not valid/);
 assert.match(source,/Explicit transactions must use reviewed D1 batch/);
 assert.doesNotMatch(source,/getPostgresPool|DATABASE_URL|process\.env/);
});
test('D1 query shape forbids raw automatic PostgreSQL syntax translation',()=>{
 assert.match(source,/\$\\d\+/);
 assert.match(source,/ensureSqliteQuery\(query\)/);
 assert.match(source,/typeof value === "boolean"/);
});
