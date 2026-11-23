const crypto = require('crypto');
const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { syncItemAlerts } = require('./alertService');
const { logAudit } = require('./auditService');
const { emitInventoryUpdate, emitAlertsUpdate } = require('../utils/socket');

function generateTransactionCode(prefix = 'TXN') {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${datePart}-${randPart}`;
}

async function performStockIn(
  { itemId, quantity, referenceNumber = null, supplierOrRecipient = null, reason = 'Stock Received', notes = null },
  actor,
  ipAddress
) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new ApiError(400, 'Incoming quantity must be greater than 0.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Row-level lock to prevent concurrent balance corruption
    const [items] = await connection.query(
      `SELECT id, sku, name, unit, current_quantity, minimum_stock_level, status
       FROM items WHERE id = ? FOR UPDATE`,
      [itemId]
    );

    const item = items[0];
    if (!item || item.status !== 'ACTIVE') {
      throw new ApiError(404, 'Active inventory item not found.');
    }

    const previousQty = Number(item.current_quantity);
    const newQty = Math.round((previousQty + qty) * 100) / 100;

    await connection.query('UPDATE items SET current_quantity = ? WHERE id = ?', [newQty, item.id]);

    const txCode = generateTransactionCode('IN');
    const [txRes] = await connection.query(
      `INSERT INTO stock_transactions
       (transaction_code, item_id, user_id, transaction_type, quantity, previous_quantity, new_quantity, reference_number, supplier_or_recipient, reason, notes)
       VALUES (?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?)`,
      [
        txCode,
        item.id,
        actor.id,
        qty,
        previousQty,
        newQty,
        referenceNumber || null,
        supplierOrRecipient || null,
        reason || 'Stock Received',
        notes || null,
      ]
    );

    const updatedItem = { ...item, current_quantity: newQty };
    await syncItemAlerts(connection, updatedItem);

    await logAudit(
      {
        userId: actor.id,
        action: 'STOCK_IN',
        entityType: 'ITEM',
        entityId: item.id,
        description: `Stock In +${qty} ${item.unit} for ${item.name} (${item.sku}). Balance: ${previousQty} -> ${newQty}.`,
        ipAddress,
      },
      connection
    );

    await connection.commit();

    emitInventoryUpdate({
      type: 'IN',
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      newQuantity: newQty,
      actorName: actor.name,
    });
    emitAlertsUpdate({ itemId: item.id });

    return {
      transactionId: txRes.insertId,
      transactionCode: txCode,
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      unit: item.unit,
      previousQuantity: previousQty,
      quantity: qty,
      newQuantity: newQty,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function performStockOut(
  { itemId, quantity, referenceNumber = null, supplierOrRecipient = null, reason = 'Stock Issued', notes = null },
  actor,
  ipAddress
) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new ApiError(400, 'Outgoing quantity must be greater than 0.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [items] = await connection.query(
      `SELECT id, sku, name, unit, current_quantity, minimum_stock_level, status
       FROM items WHERE id = ? FOR UPDATE`,
      [itemId]
    );

    const item = items[0];
    if (!item || item.status !== 'ACTIVE') {
      throw new ApiError(404, 'Active inventory item not found.');
    }

    const previousQty = Number(item.current_quantity);
    if (qty > previousQty) {
      throw new ApiError(
        400,
        `Insufficient stock for ${item.name} (${item.sku}). Available: ${previousQty} ${item.unit}, Requested: ${qty} ${item.unit}.`
      );
    }

    const newQty = Math.round((previousQty - qty) * 100) / 100;

    await connection.query('UPDATE items SET current_quantity = ? WHERE id = ?', [newQty, item.id]);

    const txCode = generateTransactionCode('OUT');
    const [txRes] = await connection.query(
      `INSERT INTO stock_transactions
       (transaction_code, item_id, user_id, transaction_type, quantity, previous_quantity, new_quantity, reference_number, supplier_or_recipient, reason, notes)
       VALUES (?, ?, ?, 'OUT', ?, ?, ?, ?, ?, ?, ?)`,
      [
        txCode,
        item.id,
        actor.id,
        qty,
        previousQty,
        newQty,
        referenceNumber || null,
        supplierOrRecipient || null,
        reason || 'Stock Issued',
        notes || null,
      ]
    );

    const updatedItem = { ...item, current_quantity: newQty };
    await syncItemAlerts(connection, updatedItem);

    await logAudit(
      {
        userId: actor.id,
        action: 'STOCK_OUT',
        entityType: 'ITEM',
        entityId: item.id,
        description: `Stock Out -${qty} ${item.unit} for ${item.name} (${item.sku}). Balance: ${previousQty} -> ${newQty}.`,
        ipAddress,
      },
      connection
    );

    await connection.commit();

    emitInventoryUpdate({
      type: 'OUT',
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      newQuantity: newQty,
      actorName: actor.name,
    });
    emitAlertsUpdate({ itemId: item.id });

    return {
      transactionId: txRes.insertId,
      transactionCode: txCode,
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      unit: item.unit,
      previousQuantity: previousQty,
      quantity: qty,
      newQuantity: newQty,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function performStockAdjustment(
  { itemId, newQuantity, reason, notes = null, relatedTransactionId = null },
  actor,
  ipAddress
) {
  const targetQty = Number(newQuantity);
  if (!Number.isFinite(targetQty) || targetQty < 0) {
    throw new ApiError(400, 'Adjusted stock quantity cannot be negative.');
  }
  if (!reason || !reason.trim()) {
    throw new ApiError(400, 'A reason is required for stock adjustments.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [items] = await connection.query(
      `SELECT id, sku, name, unit, current_quantity, minimum_stock_level, status
       FROM items WHERE id = ? FOR UPDATE`,
      [itemId]
    );

    const item = items[0];
    if (!item || item.status !== 'ACTIVE') {
      throw new ApiError(404, 'Active inventory item not found.');
    }

    const previousQty = Number(item.current_quantity);
    const roundedTarget = Math.round(targetQty * 100) / 100;
    const delta = Math.round(Math.abs(roundedTarget - previousQty) * 100) / 100;

    if (delta === 0) {
      throw new ApiError(400, 'New quantity is identical to current quantity.');
    }

    await connection.query('UPDATE items SET current_quantity = ? WHERE id = ?', [roundedTarget, item.id]);

    const txCode = generateTransactionCode('ADJ');
    const [txRes] = await connection.query(
      `INSERT INTO stock_transactions
       (transaction_code, item_id, user_id, transaction_type, quantity, previous_quantity, new_quantity, reason, notes, related_transaction_id)
       VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?)`,
      [
        txCode,
        item.id,
        actor.id,
        delta,
        previousQty,
        roundedTarget,
        reason.trim(),
        notes || null,
        relatedTransactionId || null,
      ]
    );

    const updatedItem = { ...item, current_quantity: roundedTarget };
    await syncItemAlerts(connection, updatedItem);

    await logAudit(
      {
        userId: actor.id,
        action: 'STOCK_ADJUSTMENT',
        entityType: 'ITEM',
        entityId: item.id,
        description: `Adjusted ${item.name} (${item.sku}) from ${previousQty} to ${roundedTarget} ${item.unit}. Reason: ${reason.trim()}`,
        ipAddress,
      },
      connection
    );

    await connection.commit();

    emitInventoryUpdate({
      type: 'ADJUSTMENT',
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      newQuantity: roundedTarget,
      actorName: actor.name,
    });
    emitAlertsUpdate({ itemId: item.id });

    return {
      transactionId: txRes.insertId,
      transactionCode: txCode,
      itemId: item.id,
      previousQuantity: previousQty,
      newQuantity: roundedTarget,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function listTransactions({
  search = '',
  type = '',
  itemId = '',
  userId = '',
  startDate = '',
  endDate = '',
  page = 1,
  limit = 20,
  actor = null,
}) {
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1';
  const params = [];

  // Staff can view their own transaction history unless filtered by specific item view
  if (actor && actor.role === 'STAFF' && !itemId) {
    where += ' AND t.user_id = ?';
    params.push(actor.id);
  } else if (userId) {
    where += ' AND t.user_id = ?';
    params.push(userId);
  }

  if (type && ['IN', 'OUT', 'ADJUSTMENT'].includes(type)) {
    where += ' AND t.transaction_type = ?';
    params.push(type);
  }

  if (itemId) {
    where += ' AND t.item_id = ?';
    params.push(itemId);
  }

  if (startDate) {
    where += ' AND DATE(t.created_at) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    where += ' AND DATE(t.created_at) <= ?';
    params.push(endDate);
  }

  if (search) {
    where += ' AND (t.transaction_code LIKE ? OR i.name LIKE ? OR i.sku LIKE ? OR t.reference_number LIKE ? OR t.supplier_or_recipient LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like, like);
  }

  const [rows] = await pool.query(
    `SELECT t.*, i.name AS item_name, i.sku, i.unit, u.name AS user_name, u.username
     FROM stock_transactions t
     JOIN items i ON t.item_id = i.id
     JOIN users u ON t.user_id = u.id
     ${where}
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM stock_transactions t
     JOIN items i ON t.item_id = i.id
     ${where}`,
    params
  );

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: countRows[0].total,
      totalPages: Math.ceil(countRows[0].total / limit) || 1,
    },
  };
}

module.exports = {
  generateTransactionCode,
  performStockIn,
  performStockOut,
  performStockAdjustment,
  listTransactions,
};
