import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCentsAsUsd, encodeUsdAsCents } from '../scripts/d1-data-codecs.mjs';

test('USD numeric values convert to integer cents without floating point rounding', () => {
  for (const [usd, cents] of [['0', 0], ['15', 1500], ['12.34', 1234], ['-0.01', -1], ['9999999999.99', 999999999999]]) {
    assert.equal(encodeUsdAsCents(usd), cents);
    assert.equal(decodeCentsAsUsd(cents), usd.includes('.') ? usd : `${usd}.00`);
  }
});

test('USD to cents rejects non-finite, excess precision, unsafe, and malformed amounts', () => {
  for (const value of ['1.001', 'NaN', 'Infinity', '', '1e2', ' 1.00', '90071992547410.00', 12.34]) {
    assert.throws(() => encodeUsdAsCents(value), /USD amount/);
  }
});

test('cents decoder requires a safe integer', () => {
  for (const value of [1.5, Number.MAX_SAFE_INTEGER + 1, '100']) {
    assert.throws(() => decodeCentsAsUsd(value), /integer cents/);
  }
});
