const { pool, isDemoMode } = require('../config/db');
const { store } = require('../config/demoStore');

async function getDashboardSummary() {
  if (isDemoMode()) {
    const activeItems = store.items.filter((i) => i.status === 'ACTIVE');
    const today = new Date().toISOString().slice(0, 10);

    const totalProducts = activeItems.length;
    const totalStockQuantity = activeItems.reduce((s, i) => s + Number(i.current_quantity), 0);
    const valuedItems = activeItems.filter((i) => i.unit_cost !== null && i.unit_cost !== undefined);
    const totalInventoryValue = valuedItems.reduce((s, i) => s + Number(i.current_quantity) * Number(i.unit_cost), 0);
    const lowStockItems = activeItems.filter((i) => i.current_quantity > 0 && i.current_quantity <= i.minimum_stock_level).length;
    const outOfStockItems = activeItems.filter((i) => i.current_quantity <= 0).length;
    const inStockItems = activeItems.filter((i) => i.current_quantity > i.minimum_stock_level).length;

    const todayTx = store.stock_transactions.filter((t) => t.created_at.slice(0, 10) === today);
    const stockInToday = todayTx.filter((t) => t.transaction_type === 'IN');
    const stockOutToday = todayTx.filter((t) => t.transaction_type === 'OUT');

    const categoryDistribution = store.categories.map((c) => {
      const catItems = activeItems.filter((i) => i.category_id === c.id);
      return {
        id: c.id,
        name: c.name,
        item_count: catItems.length,
        total_quantity: catItems.reduce((s, i) => s + Number(i.current_quantity), 0),
      };
    }).sort((a, b) => b.total_quantity - a.total_quantity || a.name.localeCompare(b.name));

    return {
      totalProducts,
      totalStockQuantity,
      totalInventoryValue,
      valuedItemsCount: valuedItems.length,
      lowStockItems,
      outOfStockItems,
      inStockItems,
      stockInTodayCount: stockInToday.length,
      stockInTodayQty: stockInToday.reduce((s, t) => s + Number(t.quantity), 0),
      stockOutTodayCount: stockOutToday.length,
      stockOutTodayQty: stockOutToday.reduce((s, t) => s + Number(t.quantity), 0),
      categoryDistribution,
    };
  }

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
  if (isDemoMode()) {
    const groups = new Map();
    for (const t of store.stock_transactions) {
      const d = new Date(t.created_at);
      let label;
      if (period === 'monthly') {
        label = t.created_at.slice(0, 7);
      } else if (period === 'weekly') {
        const start = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
        label = `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
      } else {
        label = t.created_at.slice(0, 10);
      }

      if (!groups.has(label)) {
        groups.set(label, { period_label: label, stock_in: 0, stock_out: 0 });
      }
      const entry = groups.get(label);
      if (t.transaction_type === 'IN') entry.stock_in += Number(t.quantity);
      if (t.transaction_type === 'OUT') entry.stock_out += Number(t.quantity);
    }
    return Array.from(groups.values()).sort((a, b) => a.period_label.localeCompare(b.period_label));
  }

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
  if (isDemoMode()) {
    return store.stock_transactions
      .filter((t) => !(actor && actor.role === 'STAFF' && t.user_id !== actor.id))
      .slice(0, Number(limit))
      .map((t) => {
        const item = store.items.find((i) => i.id === t.item_id);
        const user = store.users.find((u) => u.id === t.user_id);
        return {
          id: t.id,
          transaction_code: t.transaction_code,
          transaction_type: t.transaction_type,
          quantity: t.quantity,
          previous_quantity: t.previous_quantity,
          new_quantity: t.new_quantity,
          created_at: t.created_at,
          item_id: item?.id,
          item_name: item?.name || 'Unknown',
          sku: item?.sku || '',
          unit: item?.unit || '',
          user_name: user?.name || 'Unknown',
        };
      });
  }

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
  if (isDemoMode()) {
    return store.items
      .filter((i) => i.status === 'ACTIVE' && i.current_quantity <= i.minimum_stock_level)
      .map((i) => {
        const cat = store.categories.find((c) => c.id === i.category_id);
        return {
          id: i.id,
          sku: i.sku,
          name: i.name,
          unit: i.unit,
          current_quantity: i.current_quantity,
          minimum_stock_level: i.minimum_stock_level,
          category_name: cat?.name || '',
        };
      })
      .sort((a, b) => a.current_quantity - b.current_quantity)
      .slice(0, Number(limit));
  }

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
