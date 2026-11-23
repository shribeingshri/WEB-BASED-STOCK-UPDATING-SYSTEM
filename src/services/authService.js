const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool, isDemoMode } = require('../config/db');
const { store } = require('../config/demoStore');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('./auditService');

async function login({ identifier, password, rememberMe = false, ipAddress = null }) {
  const cleanId = String(identifier || '').trim().toLowerCase();
  if (!cleanId || !password) {
    throw new ApiError(400, 'Email/username and password are required.');
  }

  let user;
  if (isDemoMode()) {
    user = store.users.find(
      (u) => u.email.toLowerCase() === cleanId || u.username.toLowerCase() === cleanId
    );
  } else {
    const [rows] = await pool.query(
      `SELECT id, name, username, email, password_hash, role, status, last_login
       FROM users
       WHERE LOWER(email) = ? OR LOWER(username) = ?
       LIMIT 1`,
      [cleanId, cleanId]
    );
    user = rows[0];
  }

  if (!user) {
    throw new ApiError(401, 'Invalid credentials.');
  }

  if (user.status !== 'ACTIVE') {
    throw new ApiError(403, 'Account is deactivated. Please contact an administrator.');
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new ApiError(401, 'Invalid credentials.');
  }

  const now = new Date().toISOString();
  if (isDemoMode()) {
    user.last_login = now;
  } else {
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
  }

  await logAudit({
    userId: user.id,
    action: 'LOGIN',
    entityType: 'USER',
    entityId: user.id,
    description: `${user.name} (${user.role}) signed in.`,
    ipAddress,
  });

  const expiresIn = rememberMe ? '7d' : env.jwt.expiresIn;
  const token = jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    env.jwt.secret,
    { expiresIn }
  );

  return {
    token,
    rememberMe,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      last_login: now,
    },
  };
}

module.exports = { login };
