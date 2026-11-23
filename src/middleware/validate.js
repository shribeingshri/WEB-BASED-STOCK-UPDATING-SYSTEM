const ApiError = require('../utils/ApiError');

function requireFields(body, fields) {
  const missing = [];
  for (const field of fields) {
    const val = body[field];
    if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`);
  }
}

function parsePositiveNumber(value, fieldName) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new ApiError(400, `${fieldName} must be a valid number greater than 0.`);
  }
  return Math.round(num * 100) / 100;
}

function parseNonNegativeNumber(value, fieldName) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new ApiError(400, `${fieldName} must be a valid non-negative number.`);
  }
  return Math.round(num * 100) / 100;
}

module.exports = {
  requireFields,
  parsePositiveNumber,
  parseNonNegativeNumber,
};
