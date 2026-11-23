const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('./auditService');

async function listCategories() {
  const [rows] = await pool.query(
    `SELECT c.*, COUNT(i.id) AS item_count
     FROM categories c
     LEFT JOIN items i ON i.category_id = c.id AND i.status = 'ACTIVE'
     GROUP BY c.id
     ORDER BY c.name ASC`
  );
  return rows;
}

async function createCategory({ name, description = null }, actor, ipAddress) {
  const cleanName = name.trim();
  const [result] = await pool.query(
    'INSERT INTO categories (name, description) VALUES (?, ?)',
    [cleanName, description ? description.trim() : null]
  );

  await logAudit({
    userId: actor.id,
    action: 'CREATE_CATEGORY',
    entityType: 'CATEGORY',
    entityId: result.insertId,
    description: `Created category "${cleanName}".`,
    ipAddress,
  });

  const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
  return rows[0];
}

async function updateCategory(id, { name, description }, actor, ipAddress) {
  const [existing] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
  if (!existing[0]) {
    throw new ApiError(404, 'Category not found.');
  }

  await pool.query(
    'UPDATE categories SET name = ?, description = ? WHERE id = ?',
    [name ? name.trim() : existing[0].name, description !== undefined ? description : existing[0].description, id]
  );

  await logAudit({
    userId: actor.id,
    action: 'UPDATE_CATEGORY',
    entityType: 'CATEGORY',
    entityId: id,
    description: `Updated category #${id}.`,
    ipAddress,
  });

  const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
  return rows[0];
}

async function deleteCategory(id, actor, ipAddress) {
  const [inUse] = await pool.query('SELECT COUNT(*) AS count FROM items WHERE category_id = ?', [id]);
  if (inUse[0].count > 0) {
    throw new ApiError(409, 'Cannot delete category while inventory items are assigned to it.');
  }

  const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [id]);
  if (result.affectedRows === 0) {
    throw new ApiError(404, 'Category not found.');
  }

  await logAudit({
    userId: actor.id,
    action: 'DELETE_CATEGORY',
    entityType: 'CATEGORY',
    entityId: id,
    description: `Deleted category #${id}.`,
    ipAddress,
  });

  return { id: Number(id) };
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
