const { pool } = require('../config/db');

async function logAudit({ userId = null, action, entityType, entityId = null, description, ipAddress = null }, connection = null) {
  const executor = connection || pool;
  await executor.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, action, entityType, entityId ? String(entityId) : null, description, ipAddress]
  );
}

async function getAuditLogs({ page = 1, limit = 25, entityType = '' }) {
  const offset = (page - 1) * limit;
  const params = [];
  let where = 'WHERE 1=1';

  if (entityType) {
    where += ' AND a.entity_type = ?';
    params.push(entityType);
  }

  const [rows] = await pool.query(
    `SELECT a.*, u.name AS user_name, u.username
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM audit_logs a ${where}`,
    params
  );

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: countRows[0].total,
      totalPages: Math.ceil(countRows[0].total / limit),
    },
  };
}

module.exports = { logAudit, getAuditLogs };
