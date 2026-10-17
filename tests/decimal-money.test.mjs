import test from 'node:test';
import assert from 'node:assert/strict';
import { usdDecimalToCents, centsToUsdDecimal } from '../src/lib/decimal-money.ts';

test('money conversion is exact across representative cent amounts', () => {
  for (const [input, cents, normalized] of [
    ['0',0,'0.00'],['0.01',1,'0.01'],['1.2',120,'1.20'],
    ['15.00',1500,'15.00'],['50.99',5099,'50.99'],
    ['99999999.99',9999999999,'99999999.99']
  ]) {
    assert.equal(usdDecimalToCents(input), cents);
    assert.equal(centsToUsdDecimal(cents), normalized);
  }
});

test('money conversion rejects unsafe, rounded, negative or malformed values', () => {
  for (const invalid of ['0.001','1e3','-1','01.00','0.000','NaN','Infinity','1.', '.50',' 1.00','9007199254740992.00']) {
    assert.throws(() => usdDecimalToCents(invalid), undefined, invalid);
  }
  for (const invalid of [-1, 0.01, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
    assert.throws(() => centsToUsdDecimal(invalid));
  }
});
