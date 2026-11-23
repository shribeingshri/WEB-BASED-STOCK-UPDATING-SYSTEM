const env = require('../config/env');

function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Handle MySQL duplicate key & foreign key constraint errors cleanly
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'A record with this unique identifier already exists.';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = 'Referenced record does not exist.';
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    statusCode = 409;
    message = 'Cannot delete this record because it is referenced by existing transactions or items.';
  }

  if (!env.isProduction && statusCode >= 500) {
    console.error('[ERROR]', err);
  }

  const response = {
    success: false,
    message: statusCode >= 500 && env.isProduction ? 'An unexpected server error occurred.' : message,
  };

  if (err.details) {
    response.details = err.details;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;

