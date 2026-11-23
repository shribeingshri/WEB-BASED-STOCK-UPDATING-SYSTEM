const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.bm_token;
  if (!token) {
    throw new ApiError(401, 'Authentication required. Please sign in.');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwt.secret);
  } catch {
    throw new ApiError(401, 'Session expired or invalid. Please sign in again.');
  }

  const [rows] = await pool.query(
    'SELECT id, name, username, email, role, status, last_login FROM users WHERE id = ? LIMIT 1',
    [decoded.id]
  );

  const user = rows[0];
  if (!user) {
    throw new ApiError(401, 'User account no longer exists.');
  }

  if (user.status !== 'ACTIVE') {
    throw new ApiError(403, 'Your account has been deactivated. Contact an administrator.');
  }

  req.user = user;
  next();
});

module.exports = authenticate;
