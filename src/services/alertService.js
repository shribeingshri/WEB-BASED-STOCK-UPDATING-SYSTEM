const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');

/**
 * Synchronizes active alerts for an item inside an existing DB transaction.
 * Guarantees no duplicate active alerts for the same condition and resolves
 * alerts automatically when stock is replenished above minimum_stock_level.
 */
async function syncItemAlerts(connection, item) {
  const qty = Number(item.current_quantity);
  const min = Number(item.minimum_stock_level);

  let targetType = null;
  let message = '';

  if (qty <= 0) {
    targetType = 'OUT_OF_STOCK';
    message = `${item.name} (${item.sku}) is out of stock (0 ${item.unit}).`;
  } else if (qty <= min) {
    targetType = 'LOW_STOCK';
    message = `${item.name} (${item.sku}) is low on stock (${qty} / min ${min} ${item.unit}).`;
  }

  if (!targetType) {
    // Stock is healthy — resolve any active alerts for this item
    await connection.query(
      `UPDATE alerts SET status = 'RESOLVED', resolved_at = NOW()
       WHERE item_id = ? AND status = 'ACTIVE'`,
      [item.id]
    );
    return { changed: true, activeAlert: null };
  }

  // Resolve any active alert of the *other* type
  const otherType = targetType === 'OUT_OF_STOCK' ? 'LOW_STOCK' : 'OUT_OF_STOCK';
  await connection.query(
    `UPDATE alerts SET status = 'RESOLVED', resolved_at = NOW()
     WHERE item_id = ? AND status = 'ACTIVE' AND alert_type = ?`,
    [item.id, otherType]
  );

  // Check if an active alert of targetType already exists
  const [existing] = await connection.query(
    `SELECT id FROM alerts WHERE item_id = ? AND status = 'ACTIVE' AND alert_type = ? LIMIT 1`,
    [item.id, targetType]
  );

  if (existing.length > 0) {
    await connection.query('UPDATE alerts SET message = ? WHERE id = ?', [message, existing[0].id]);
    return { changed: true, activeAlert: { id: existing[0].id, alert_type: targetType, message } };
  }

  const [res] = await connection.query(
    `INSERT INTO alerts (item_id, alert_type, message, status) VALUES (?, ?, ?, 'ACTIVE')`,
    [item.id, targetType, message]
  );
  return { changed: true, activeAlert: { id: res.insertId, alert_type: targetType, message } };
}

async function listAlerts({ status = 'ACTIVE', alertType = '' }) {
  let where = 'WHERE i.status = \'ACTIVE\'';
  const params = [];

  if (status && status !== 'ALL') {
    where += ' AND a.status = ?';
    params.push(status);
  }
  if (alertType && alertType !== 'ALL') {
    where += ' AND a.alert_type = ?';
    params.push(alertType);
  }

  const [rows] = await pool.query(
    `SELECT a.*, i.name AS item_name, i.sku, i.unit, i.current_quantity, i.minimum_stock_level,
            c.name AS category_name
     FROM alerts a
     JOIN items i ON a.item_id = i.id
     JOIN categories c ON i.category_id = c.id
     ${where}
     ORDER BY FIELD(a.alert_type, 'OUT_OF_STOCK', 'LOW_STOCK'), a.created_at DESC`,
    params
  );

  return rows;
}

async function resolveAlert(id) {
  const [result] = await pool.query(
    `UPDATE alerts SET status = 'RESOLVED', resolved_at = NOW() WHERE id = ? AND status = 'ACTIVE'`,
    [id]
  );
  if (result.affectedRows === 0) {
    throw new ApiError(404, 'Active alert not found.');
  }
  return { id: Number(id), status: 'RESOLVED' };
}

module.exports = {
  syncItemAlerts,
  listAlerts,
  resolveAlert,
};
