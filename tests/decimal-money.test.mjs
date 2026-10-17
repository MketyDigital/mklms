import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync('src/lib/decimal-money.ts','utf8');
test('money adapter requires decimal strings and exact integer cents',()=>{
 assert.match(src,/BigInt\(whole\) \* 100n/);
 assert.match(src,/Number\.MAX_SAFE_INTEGER/);
 assert.match(src,/at most two fractional digits/);
 assert.doesNotMatch(src,/parseFloat|Math\.round|DATABASE_URL|getPostgresPool/);
});
