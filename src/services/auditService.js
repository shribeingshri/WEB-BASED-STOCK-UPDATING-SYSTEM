const { pool, isDemoMode } = require('../config/db');
const { store } = require('../config/demoStore');

async function logAudit({ userId = null, action, entityType, entityId = null, description, ipAddress = null }, connection = null) {
  if (isDemoMode()) {
    store.audit_logs.unshift({
      id: store.seq.audit_logs++,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      description,
      ip_address: ipAddress,
      created_at: new Date().toISOString(),
    });
    return;
  }

  const executor = connection || pool;
  await executor.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, action, entityType, entityId ? String(entityId) : null, description, ipAddress]
  );
}

async function getAuditLogs({ page = 1, limit = 25, entityType = '' }) {
  if (isDemoMode()) {
    let filtered = store.audit_logs;
    if (entityType) {
      filtered = filtered.filter((a) => a.entity_type === entityType);
    }
    const offset = (page - 1) * limit;
    const rows = filtered.slice(offset, offset + limit).map((a) => {
      const u = store.users.find((usr) => usr.id === a.user_id);
      return { ...a, user_name: u?.name || null, username: u?.username || null };
    });
    return {
      data: rows,
      pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) || 1 },
    };
  }

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
