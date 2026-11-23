const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('./auditService');

async function listUsers({ search = '', role = '', status = '' }) {
  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (name LIKE ? OR username LIKE ? OR email LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (role) {
    where += ' AND role = ?';
    params.push(role);
  }
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }

  const [rows] = await pool.query(
    `SELECT id, name, username, email, role, status, last_login, created_at, updated_at
     FROM users
     ${where}
     ORDER BY created_at DESC`,
    params
  );

  return rows;
}

async function createUser({ name, username, email, password, role = 'STAFF' }, actor, ipAddress) {
  if (!['ADMIN', 'STAFF'].includes(role)) {
    throw new ApiError(400, 'Role must be ADMIN or STAFF.');
  }
  if (String(password).length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim().toLowerCase();

  const [existing] = await pool.query(
    'SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1',
    [cleanEmail, cleanUsername]
  );
  if (existing.length > 0) {
    throw new ApiError(409, 'A user with this email or username already exists.');
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const [result] = await pool.query(
    `INSERT INTO users (name, username, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
    [name.trim(), cleanUsername, cleanEmail, passwordHash, role]
  );

  await logAudit({
    userId: actor.id,
    action: 'CREATE_USER',
    entityType: 'USER',
    entityId: result.insertId,
    description: `Created user ${cleanUsername} with role ${role}.`,
    ipAddress,
  });

  const [created] = await pool.query(
    'SELECT id, name, username, email, role, status, last_login, created_at FROM users WHERE id = ?',
    [result.insertId]
  );
  return created[0];
}

async function updateUser(id, { name, email, role, password }, actor, ipAddress) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  if (!rows[0]) {
    throw new ApiError(404, 'User not found.');
  }

  if (role && !['ADMIN', 'STAFF'].includes(role)) {
    throw new ApiError(400, 'Role must be ADMIN or STAFF.');
  }

  const updates = [];
  const params = [];

  if (name) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (email) {
    updates.push('email = ?');
    params.push(email.trim().toLowerCase());
  }
  if (role) {
    if (Number(id) === actor.id && role !== 'ADMIN') {
      throw new ApiError(400, 'You cannot demote your own admin account.');
    }
    updates.push('role = ?');
    params.push(role);
  }
  if (password) {
    if (String(password).length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters.');
    }
    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    updates.push('password_hash = ?');
    params.push(passwordHash);
  }

  if (updates.length === 0) {
    throw new ApiError(400, 'No fields provided to update.');
  }

  params.push(id);
  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

  await logAudit({
    userId: actor.id,
    action: 'UPDATE_USER',
    entityType: 'USER',
    entityId: id,
    description: `Updated user #${id}${password ? ' (including password reset)' : ''}.`,
    ipAddress,
  });

  const [updated] = await pool.query(
    'SELECT id, name, username, email, role, status, last_login, created_at, updated_at FROM users WHERE id = ?',
    [id]
  );
  return updated[0];
}

async function updateUserStatus(id, status, actor, ipAddress) {
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    throw new ApiError(400, 'Status must be ACTIVE or INACTIVE.');
  }
  if (Number(id) === actor.id && status === 'INACTIVE') {
    throw new ApiError(400, 'You cannot deactivate your own account.');
  }

  const [result] = await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
  if (result.affectedRows === 0) {
    throw new ApiError(404, 'User not found.');
  }

  await logAudit({
    userId: actor.id,
    action: status === 'ACTIVE' ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
    entityType: 'USER',
    entityId: id,
    description: `Changed user #${id} status to ${status}.`,
    ipAddress,
  });

  return { id: Number(id), status };
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  updateUserStatus,
};
