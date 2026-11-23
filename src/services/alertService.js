const { pool, isDemoMode } = require('../config/db');
const { store } = require('../config/demoStore');
const ApiError = require('../utils/ApiError');

function syncItemAlertsDemo(item) {
  const qty = Number(item.current_quantity);
  const min = Number(item.minimum_stock_level);
  const now = new Date().toISOString();

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
    store.alerts.forEach((a) => {
      if (a.item_id === item.id && a.status === 'ACTIVE') {
        a.status = 'RESOLVED';
        a.resolved_at = now;
      }
    });
    return { changed: true, activeAlert: null };
  }

  const otherType = targetType === 'OUT_OF_STOCK' ? 'LOW_STOCK' : 'OUT_OF_STOCK';
  store.alerts.forEach((a) => {
    if (a.item_id === item.id && a.status === 'ACTIVE' && a.alert_type === otherType) {
      a.status = 'RESOLVED';
      a.resolved_at = now;
    }
  });

  const existing = store.alerts.find(
    (a) => a.item_id === item.id && a.status === 'ACTIVE' && a.alert_type === targetType
  );
  if (existing) {
    existing.message = message;
    return { changed: true, activeAlert: existing };
  }

  const created = {
    id: store.seq.alerts++,
    item_id: item.id,
    alert_type: targetType,
    message,
    status: 'ACTIVE',
    created_at: now,
    resolved_at: null,
  };
  store.alerts.unshift(created);
  return { changed: true, activeAlert: created };
}

/**
 * Synchronizes active alerts for an item inside an existing DB transaction.
 * Guarantees no duplicate active alerts for the same condition and resolves
 * alerts automatically when stock is replenished above minimum_stock_level.
 */
async function syncItemAlerts(connection, item) {
  if (isDemoMode()) {
    return syncItemAlertsDemo(item);
  }

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
    await connection.query(
      `UPDATE alerts SET status = 'RESOLVED', resolved_at = NOW()
       WHERE item_id = ? AND status = 'ACTIVE'`,
      [item.id]
    );
    return { changed: true, activeAlert: null };
  }

  const otherType = targetType === 'OUT_OF_STOCK' ? 'LOW_STOCK' : 'OUT_OF_STOCK';
  await connection.query(
    `UPDATE alerts SET status = 'RESOLVED', resolved_at = NOW()
     WHERE item_id = ? AND status = 'ACTIVE' AND alert_type = ?`,
    [item.id, otherType]
  );

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
  if (isDemoMode()) {
    return store.alerts
      .filter((a) => {
        const item = store.items.find((i) => i.id === a.item_id && i.status === 'ACTIVE');
        if (!item) return false;
        if (status && status !== 'ALL' && a.status !== status) return false;
        if (alertType && alertType !== 'ALL' && a.alert_type !== alertType) return false;
        return true;
      })
      .map((a) => {
        const item = store.items.find((i) => i.id === a.item_id);
        const cat = store.categories.find((c) => c.id === item.category_id);
        return {
          ...a,
          item_name: item.name,
          sku: item.sku,
          unit: item.unit,
          current_quantity: item.current_quantity,
          minimum_stock_level: item.minimum_stock_level,
          category_name: cat?.name || '',
        };
      })
      .sort((a, b) => {
        if (a.alert_type !== b.alert_type) return a.alert_type === 'OUT_OF_STOCK' ? -1 : 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }

  let where = "WHERE i.status = 'ACTIVE'";
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
  if (isDemoMode()) {
    const alert = store.alerts.find((a) => a.id === Number(id) && a.status === 'ACTIVE');
    if (!alert) throw new ApiError(404, 'Active alert not found.');
    alert.status = 'RESOLVED';
    alert.resolved_at = new Date().toISOString();
    return { id: Number(id), status: 'RESOLVED' };
  }

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
