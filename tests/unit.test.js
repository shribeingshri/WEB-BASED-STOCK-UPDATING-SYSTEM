const test = require('node:test');
const assert = require('node:assert/strict');

const { computeStockStatus } = require('../src/services/itemService');
const { requireFields, parsePositiveNumber, parseNonNegativeNumber } = require('../src/middleware/validate');
const ApiError = require('../src/utils/ApiError');

test('computeStockStatus returns OUT_OF_STOCK when quantity is 0 or less', () => {
  assert.equal(computeStockStatus(0, 10), 'OUT_OF_STOCK');
  assert.equal(computeStockStatus(-5, 10), 'OUT_OF_STOCK');
});

test('computeStockStatus returns LOW_STOCK when quantity is > 0 and <= minimum', () => {
  assert.equal(computeStockStatus(1, 10), 'LOW_STOCK');
  assert.equal(computeStockStatus(10, 10), 'LOW_STOCK');
});

test('computeStockStatus returns IN_STOCK when quantity > minimum', () => {
  assert.equal(computeStockStatus(11, 10), 'IN_STOCK');
  assert.equal(computeStockStatus(150.5, 25), 'IN_STOCK');
});

test('requireFields throws 400 ApiError on missing fields', () => {
  assert.throws(
    () => requireFields({ name: 'Cement', sku: '' }, ['name', 'sku', 'unit']),
    (err) => err instanceof ApiError && err.statusCode === 400 && err.message.includes('sku')
  );
});

test('parsePositiveNumber validates > 0', () => {
  assert.equal(parsePositiveNumber('12.345', 'qty'), 12.35);
  assert.throws(() => parsePositiveNumber(0, 'qty'), ApiError);
  assert.throws(() => parsePositiveNumber(-4, 'qty'), ApiError);
  assert.throws(() => parsePositiveNumber('abc', 'qty'), ApiError);
});

test('parseNonNegativeNumber validates >= 0', () => {
  assert.equal(parseNonNegativeNumber(0, 'min'), 0);
  assert.equal(parseNonNegativeNumber('5.5', 'min'), 5.5);
  assert.throws(() => parseNonNegativeNumber(-1, 'min'), ApiError);
});
