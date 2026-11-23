const { pool } = require('../config/db');

async function getDashboardSummary() {
  const [itemStats] = await pool.query(`
    SELECT
      COUNT(*) AS totalProducts,
      COALESCE(SUM(current_quantity), 0) AS totalStockQuantity,
      COALESCE(SUM(CASE WHEN unit_cost IS NOT NULL THEN current_quantity * unit_cost ELSE 0 END), 0) AS totalInventoryValue,
      COUNT(CASE WHEN unit_cost IS NOT NULL THEN 1 END) AS valuedItemsCount,
      COUNT(CASE WHEN current_quantity > 0 AND current_quantity <= minimum_stock_level THEN 1 END) AS lowStockItems,
      COUNT(CASE WHEN current_quantity <= 0 THEN 1 END) AS outOfStockItems,
      COUNT(CASE WHEN current_quantity > minimum_stock_level THEN 1 END) AS inStockItems
    FROM items
    WHERE status = 'ACTIVE'
  `);

  const [todayStats] = await pool.query(`
    SELECT
      COUNT(CASE WHEN transaction_type = 'IN' THEN 1 END) AS stockInTodayCount,
      COALESCE(SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE 0 END), 0) AS stockInTodayQty,
      COUNT(CASE WHEN transaction_type = 'OUT' THEN 1 END) AS stockOutTodayCount,
      COALESCE(SUM(CASE WHEN transaction_type = 'OUT' THEN quantity ELSE 0 END), 0) AS stockOutTodayQty
    FROM stock_transactions
    WHERE DATE(created_at) = CURDATE()
  `);

  const [categoryDistribution] = await pool.query(`
    SELECT c.id, c.name,
           COUNT(i.id) AS item_count,
           COALESCE(SUM(i.current_quantity), 0) AS total_quantity
    FROM categories c
    LEFT JOIN items i ON i.category_id = c.id AND i.status = 'ACTIVE'
    GROUP BY c.id, c.name
    ORDER BY total_quantity DESC, c.name ASC
  `);

  return {
    ...itemStats[0],
    ...todayStats[0],
    categoryDistribution,
  };
}

async function getStockMovement(period = 'daily') {
  let groupExpr;
  let limitDays;

  if (period === 'monthly') {
    groupExpr = "DATE_FORMAT(created_at, '%Y-%m')";
    limitDays = 365;
  } else if (period === 'weekly') {
    groupExpr = "DATE_FORMAT(created_at, '%x-W%v')";
    limitDays = 84;
  } else {
    groupExpr = "DATE_FORMAT(created_at, '%Y-%m-%d')";
    limitDays = 14;
  }

  const [rows] = await pool.query(
    `SELECT
       ${groupExpr} AS period_label,
       COALESCE(SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE 0 END), 0) AS stock_in,
       COALESCE(SUM(CASE WHEN transaction_type = 'OUT' THEN quantity ELSE 0 END), 0) AS stock_out
     FROM stock_transactions
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY period_label
     ORDER BY period_label ASC`,
    [limitDays]
  );

  return rows;
}

async function getRecentTransactions(limit = 8, actor = null) {
  let where = '';
  const params = [];

  if (actor && actor.role === 'STAFF') {
    where = 'WHERE t.user_id = ?';
    params.push(actor.id);
  }

  const [rows] = await pool.query(
    `SELECT t.id, t.transaction_code, t.transaction_type, t.quantity, t.previous_quantity, t.new_quantity,
            t.created_at, i.id AS item_id, i.name AS item_name, i.sku, i.unit, u.name AS user_name
     FROM stock_transactions t
     JOIN items i ON t.item_id = i.id
     JOIN users u ON t.user_id = u.id
     ${where}
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT ?`,
    [...params, Number(limit)]
  );

  return rows;
}

async function getLowStockOverview(limit = 8) {
  const [rows] = await pool.query(
    `SELECT i.id, i.sku, i.name, i.unit, i.current_quantity, i.minimum_stock_level, c.name AS category_name
     FROM items i
     JOIN categories c ON i.category_id = c.id
     WHERE i.status = 'ACTIVE' AND i.current_quantity <= i.minimum_stock_level
     ORDER BY (i.current_quantity <= 0) DESC, (i.current_quantity / NULLIF(i.minimum_stock_level, 0)) ASC
     LIMIT ?`,
    [Number(limit)]
  );
  return rows;
}

module.exports = {
  getDashboardSummary,
  getStockMovement,
  getRecentTransactions,
  getLowStockOverview,
};
