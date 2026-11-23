const QRCode = require('qrcode');
const { pool, isDemoMode } = require('../config/db');
const { store } = require('../config/demoStore');
const ApiError = require('../utils/ApiError');
const { syncItemAlerts } = require('./alertService');
const { generateTransactionCode } = require('./stockService');
const { logAudit } = require('./auditService');
const { emitInventoryUpdate, emitAlertsUpdate } = require('../utils/socket');

function computeStockStatus(qty, minLevel) {
  const q = Number(qty);
  const m = Number(minLevel);
  if (q <= 0) return 'OUT_OF_STOCK';
  if (q <= m) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function enrichDemoItem(item) {
  const cat = store.categories.find((c) => c.id === item.category_id);
  const sup = store.suppliers.find((s) => s.id === item.supplier_id);
  return {
    ...item,
    category_name: cat?.name || 'Uncategorized',
    supplier_name: sup?.name || null,
    stock_status: computeStockStatus(item.current_quantity, item.minimum_stock_level),
  };
}

async function listItems({
  search = '',
  categoryId = '',
  stockStatus = '',
  includeArchived = false,
  sortBy = 'updated_at',
  sortOrder = 'DESC',
  page = 1,
  limit = 20,
}) {
  if (isDemoMode()) {
    const q = search.trim().toLowerCase();
    const dir = String(sortOrder).toUpperCase() === 'ASC' ? 1 : -1;
    const filtered = store.items
      .map(enrichDemoItem)
      .filter((i) => {
        if (!includeArchived && i.status !== 'ACTIVE') return false;
        if (categoryId && i.category_id !== Number(categoryId)) return false;
        if (stockStatus && i.stock_status !== stockStatus) return false;
        if (q) {
          const hay = `${i.name} ${i.sku} ${i.category_name}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const keyMap = {
          id: 'id', name: 'name', sku: 'sku', category: 'category_name',
          current_quantity: 'current_quantity', minimum_stock_level: 'minimum_stock_level',
          unit_cost: 'unit_cost', updated_at: 'updated_at',
        };
        const k = keyMap[sortBy] || 'updated_at';
        const va = a[k] ?? '';
        const vb = b[k] ?? '';
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb)) * dir;
      });

    const offset = (page - 1) * limit;
    return {
      data: filtered.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit) || 1,
      },
    };
  }

  const allowedSort = {
    id: 'i.id',
    name: 'i.name',
    sku: 'i.sku',
    category: 'c.name',
    current_quantity: 'i.current_quantity',
    minimum_stock_level: 'i.minimum_stock_level',
    unit_cost: 'i.unit_cost',
    updated_at: 'i.updated_at',
  };

  const orderCol = allowedSort[sortBy] || 'i.updated_at';
  const orderDir = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];

  if (!includeArchived) {
    where += " AND i.status = 'ACTIVE'";
  }

  if (search) {
    where += ' AND (LOWER(i.name) LIKE ? OR LOWER(i.sku) LIKE ? OR LOWER(c.name) LIKE ?)';
    const like = `%${search.trim().toLowerCase()}%`;
    params.push(like, like, like);
  }

  if (categoryId) {
    where += ' AND i.category_id = ?';
    params.push(categoryId);
  }

  if (stockStatus === 'OUT_OF_STOCK') {
    where += ' AND i.current_quantity <= 0';
  } else if (stockStatus === 'LOW_STOCK') {
    where += ' AND i.current_quantity > 0 AND i.current_quantity <= i.minimum_stock_level';
  } else if (stockStatus === 'IN_STOCK') {
    where += ' AND i.current_quantity > i.minimum_stock_level';
  }

  const [rows] = await pool.query(
    `SELECT i.*, c.name AS category_name, s.name AS supplier_name
     FROM items i
     JOIN categories c ON i.category_id = c.id
     LEFT JOIN suppliers s ON i.supplier_id = s.id
     ${where}
     ORDER BY ${orderCol} ${orderDir}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM items i
     JOIN categories c ON i.category_id = c.id
     ${where}`,
    params
  );

  const enriched = rows.map((row) => ({
    ...row,
    stock_status: computeStockStatus(row.current_quantity, row.minimum_stock_level),
  }));

  return {
    data: enriched,
    pagination: {
      page,
      limit,
      total: countRows[0].total,
      totalPages: Math.ceil(countRows[0].total / limit) || 1,
    },
  };
}

async function getItemById(id) {
  if (isDemoMode()) {
    const found = store.items.find((i) => i.id === Number(id));
    if (!found) throw new ApiError(404, 'Inventory item not found.');
    return enrichDemoItem(found);
  }

  const [rows] = await pool.query(
    `SELECT i.*, c.name AS category_name, s.name AS supplier_name
     FROM items i
     JOIN categories c ON i.category_id = c.id
     LEFT JOIN suppliers s ON i.supplier_id = s.id
     WHERE i.id = ? LIMIT 1`,
    [id]
  );

  const item = rows[0];
  if (!item) {
    throw new ApiError(404, 'Inventory item not found.');
  }

  return {
    ...item,
    stock_status: computeStockStatus(item.current_quantity, item.minimum_stock_level),
  };
}

async function getItemQrCode(id) {
  const item = await getItemById(id);
  const payload = JSON.stringify({
    type: 'BUILDMORE_ITEM',
    id: item.id,
    sku: item.sku,
    name: item.name,
  });
  const dataUrl = await QRCode.toDataURL(payload, { width: 240, margin: 2 });
  return { id: item.id, sku: item.sku, name: item.name, qrDataUrl: dataUrl };
}

async function createItem(data, actor, ipAddress) {
  const sku = data.sku.trim().toUpperCase();
  const name = data.name.trim();
  const openingQty = Number(data.opening_quantity ?? data.current_quantity ?? 0);
  const minLevel = Number(data.minimum_stock_level ?? 10);
  const unitCost = data.unit_cost !== undefined && data.unit_cost !== '' && data.unit_cost !== null
    ? Number(data.unit_cost)
    : null;

  if (openingQty < 0 || !Number.isFinite(openingQty)) {
    throw new ApiError(400, 'Opening stock quantity must be 0 or greater.');
  }
  if (minLevel < 0 || !Number.isFinite(minLevel)) {
    throw new ApiError(400, 'Minimum stock threshold must be 0 or greater.');
  }
  if (unitCost !== null && (unitCost < 0 || !Number.isFinite(unitCost))) {
    throw new ApiError(400, 'Unit cost must be a valid non-negative number.');
  }

  if (isDemoMode()) {
    if (store.items.some((i) => i.sku === sku)) {
      throw new ApiError(409, `An item with SKU "${sku}" already exists.`);
    }
    const now = new Date().toISOString();
    const newItem = {
      id: store.seq.items++,
      sku,
      name,
      description: data.description ? data.description.trim() : null,
      category_id: Number(data.category_id),
      supplier_id: data.supplier_id ? Number(data.supplier_id) : null,
      unit: data.unit.trim(),
      current_quantity: openingQty,
      minimum_stock_level: minLevel,
      unit_cost: unitCost,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    };
    store.items.unshift(newItem);

    if (openingQty > 0) {
      store.stock_transactions.unshift({
        id: store.seq.stock_transactions++,
        transaction_code: generateTransactionCode('OPEN'),
        item_id: newItem.id,
        user_id: actor.id,
        transaction_type: 'IN',
        quantity: openingQty,
        previous_quantity: 0,
        new_quantity: openingQty,
        reference_number: 'OPENING-STOCK',
        supplier_or_recipient: data.supplier_name || null,
        reason: 'Opening Stock Entry',
        notes: 'Initial balance on product creation',
        related_transaction_id: null,
        created_at: now,
      });
    }

    await syncItemAlerts(null, newItem);
    await logAudit({
      userId: actor.id,
      action: 'CREATE_ITEM',
      entityType: 'ITEM',
      entityId: newItem.id,
      description: `Created product "${name}" (${sku}) with opening stock ${openingQty} ${newItem.unit}.`,
      ipAddress,
    });
    emitInventoryUpdate({ type: 'ITEM_CREATED', itemId: newItem.id, sku, name });
    emitAlertsUpdate({ itemId: newItem.id });
    return enrichDemoItem(newItem);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [dup] = await connection.query('SELECT id FROM items WHERE sku = ? LIMIT 1', [sku]);
    if (dup.length > 0) {
      throw new ApiError(409, `An item with SKU "${sku}" already exists.`);
    }

    const [result] = await connection.query(
      `INSERT INTO items
       (sku, name, description, category_id, supplier_id, unit, current_quantity, minimum_stock_level, unit_cost, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        sku,
        name,
        data.description ? data.description.trim() : null,
        data.category_id,
        data.supplier_id || null,
        data.unit.trim(),
        openingQty,
        minLevel,
        unitCost,
      ]
    );

    const itemId = result.insertId;

    if (openingQty > 0) {
      const txCode = generateTransactionCode('OPEN');
      await connection.query(
        `INSERT INTO stock_transactions
         (transaction_code, item_id, user_id, transaction_type, quantity, previous_quantity, new_quantity, reference_number, supplier_or_recipient, reason, notes)
         VALUES (?, ?, ?, 'IN', ?, 0, ?, 'OPENING-STOCK', ?, 'Opening Stock Entry', 'Initial balance on product creation')`,
        [txCode, itemId, actor.id, openingQty, openingQty, data.supplier_name || null]
      );
    }

    await syncItemAlerts(connection, {
      id: itemId,
      sku,
      name,
      unit: data.unit.trim(),
      current_quantity: openingQty,
      minimum_stock_level: minLevel,
    });

    await logAudit(
      {
        userId: actor.id,
        action: 'CREATE_ITEM',
        entityType: 'ITEM',
        entityId: itemId,
        description: `Created product "${name}" (${sku}) with opening stock ${openingQty} ${data.unit.trim()}.`,
        ipAddress,
      },
      connection
    );

    await connection.commit();

    emitInventoryUpdate({ type: 'ITEM_CREATED', itemId, sku, name });
    emitAlertsUpdate({ itemId });

    return await getItemById(itemId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function updateItem(id, data, actor, ipAddress) {
  if (isDemoMode()) {
    const item = store.items.find((i) => i.id === Number(id));
    if (!item) throw new ApiError(404, 'Inventory item not found.');

    const nextSku = data.sku ? data.sku.trim().toUpperCase() : item.sku;
    if (nextSku !== item.sku && store.items.some((i) => i.sku === nextSku && i.id !== item.id)) {
      throw new ApiError(409, `Another item already uses SKU "${nextSku}".`);
    }

    const nextMin = data.minimum_stock_level !== undefined ? Number(data.minimum_stock_level) : item.minimum_stock_level;
    if (!Number.isFinite(nextMin) || nextMin < 0) throw new ApiError(400, 'Minimum stock threshold must be 0 or greater.');

    const nextCost = data.unit_cost !== undefined
      ? (data.unit_cost === '' || data.unit_cost === null ? null : Number(data.unit_cost))
      : item.unit_cost;
    if (nextCost !== null && (!Number.isFinite(nextCost) || nextCost < 0)) throw new ApiError(400, 'Unit cost must be a valid non-negative number.');

    item.sku = nextSku;
    if (data.name) item.name = data.name.trim();
    if (data.description !== undefined) item.description = data.description ? data.description.trim() : null;
    if (data.category_id) item.category_id = Number(data.category_id);
    if (data.supplier_id !== undefined) item.supplier_id = data.supplier_id ? Number(data.supplier_id) : null;
    if (data.unit) item.unit = data.unit.trim();
    item.minimum_stock_level = nextMin;
    item.unit_cost = nextCost;
    item.updated_at = new Date().toISOString();

    await syncItemAlerts(null, item);
    await logAudit({
      userId: actor.id,
      action: 'UPDATE_ITEM',
      entityType: 'ITEM',
      entityId: id,
      description: `Updated product "${item.name}" (${item.sku}).`,
      ipAddress,
    });
    emitInventoryUpdate({ type: 'ITEM_UPDATED', itemId: Number(id) });
    emitAlertsUpdate({ itemId: Number(id) });
    return enrichDemoItem(item);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM items WHERE id = ? FOR UPDATE', [id]);
    const existing = rows[0];
    if (!existing) {
      throw new ApiError(404, 'Inventory item not found.');
    }

    const nextSku = data.sku ? data.sku.trim().toUpperCase() : existing.sku;
    if (nextSku !== existing.sku) {
      const [dup] = await connection.query('SELECT id FROM items WHERE sku = ? AND id != ? LIMIT 1', [nextSku, id]);
      if (dup.length > 0) {
        throw new ApiError(409, `Another item already uses SKU "${nextSku}".`);
      }
    }

    const nextMin = data.minimum_stock_level !== undefined ? Number(data.minimum_stock_level) : existing.minimum_stock_level;
    if (!Number.isFinite(nextMin) || nextMin < 0) {
      throw new ApiError(400, 'Minimum stock threshold must be 0 or greater.');
    }

    const nextCost = data.unit_cost !== undefined
      ? (data.unit_cost === '' || data.unit_cost === null ? null : Number(data.unit_cost))
      : existing.unit_cost;
    if (nextCost !== null && (!Number.isFinite(nextCost) || nextCost < 0)) {
      throw new ApiError(400, 'Unit cost must be a valid non-negative number.');
    }

    const nextName = data.name ? data.name.trim() : existing.name;
    const nextUnit = data.unit ? data.unit.trim() : existing.unit;

    await connection.query(
      `UPDATE items
       SET sku = ?, name = ?, description = ?, category_id = ?, supplier_id = ?, unit = ?,
           minimum_stock_level = ?, unit_cost = ?
       WHERE id = ?`,
      [
        nextSku,
        nextName,
        data.description !== undefined ? (data.description ? data.description.trim() : null) : existing.description,
        data.category_id || existing.category_id,
        data.supplier_id !== undefined ? (data.supplier_id || null) : existing.supplier_id,
        nextUnit,
        nextMin,
        nextCost,
        id,
      ]
    );

    await syncItemAlerts(connection, {
      id: existing.id,
      sku: nextSku,
      name: nextName,
      unit: nextUnit,
      current_quantity: existing.current_quantity,
      minimum_stock_level: nextMin,
    });

    await logAudit(
      {
        userId: actor.id,
        action: 'UPDATE_ITEM',
        entityType: 'ITEM',
        entityId: id,
        description: `Updated product "${nextName}" (${nextSku}).`,
        ipAddress,
      },
      connection
    );

    await connection.commit();

    emitInventoryUpdate({ type: 'ITEM_UPDATED', itemId: Number(id) });
    emitAlertsUpdate({ itemId: Number(id) });

    return await getItemById(id);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function archiveOrDeleteItem(id, actor, ipAddress) {
  if (isDemoMode()) {
    const idx = store.items.findIndex((i) => i.id === Number(id));
    if (idx === -1) throw new ApiError(404, 'Inventory item not found.');
    const item = store.items[idx];
    const hasTx = store.stock_transactions.some((t) => t.item_id === item.id);
    if (hasTx) {
      item.status = 'ARCHIVED';
      store.alerts.forEach((a) => {
        if (a.item_id === item.id && a.status === 'ACTIVE') {
          a.status = 'RESOLVED';
          a.resolved_at = new Date().toISOString();
        }
      });
      await logAudit({ userId: actor.id, action: 'ARCHIVE_ITEM', entityType: 'ITEM', entityId: id, description: `Archived product "${item.name}" (${item.sku}).`, ipAddress });
      emitInventoryUpdate({ type: 'ITEM_ARCHIVED', itemId: Number(id) });
      return { id: Number(id), archived: true };
    }
    store.items.splice(idx, 1);
    await logAudit({ userId: actor.id, action: 'DELETE_ITEM', entityType: 'ITEM', entityId: id, description: `Deleted product "${item.name}" (${item.sku}).`, ipAddress });
    emitInventoryUpdate({ type: 'ITEM_DELETED', itemId: Number(id) });
    return { id: Number(id), archived: false };
  }

  const [txCheck] = await pool.query('SELECT COUNT(*) AS count FROM stock_transactions WHERE item_id = ?', [id]);
  const [itemRows] = await pool.query('SELECT * FROM items WHERE id = ? LIMIT 1', [id]);
  const item = itemRows[0];
  if (!item) {
    throw new ApiError(404, 'Inventory item not found.');
  }

  if (txCheck[0].count > 0) {
    await pool.query("UPDATE items SET status = 'ARCHIVED' WHERE id = ?", [id]);
    await pool.query("UPDATE alerts SET status = 'RESOLVED', resolved_at = NOW() WHERE item_id = ? AND status = 'ACTIVE'", [id]);
    await logAudit({
      userId: actor.id,
      action: 'ARCHIVE_ITEM',
      entityType: 'ITEM',
      entityId: id,
      description: `Archived product "${item.name}" (${item.sku}) to preserve transaction history.`,
      ipAddress,
    });
    emitInventoryUpdate({ type: 'ITEM_ARCHIVED', itemId: Number(id) });
    return { id: Number(id), archived: true };
  }

  await pool.query('DELETE FROM items WHERE id = ?', [id]);
  await logAudit({
    userId: actor.id,
    action: 'DELETE_ITEM',
    entityType: 'ITEM',
    entityId: id,
    description: `Deleted product "${item.name}" (${item.sku}).`,
    ipAddress,
  });
  emitInventoryUpdate({ type: 'ITEM_DELETED', itemId: Number(id) });
  return { id: Number(id), archived: false };
}

module.exports = {
  computeStockStatus,
  listItems,
  getItemById,
  getItemQrCode,
  createItem,
  updateItem,
  archiveOrDeleteItem,
};
