const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { pool } = require('../config/db');
const env = require('../config/env');

async function getCompanyName() {
  const [rows] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'company_name' LIMIT 1");
  return rows[0]?.setting_value || env.companyName;
}

async function getInventoryReport(filters = {}) {
  let where = "WHERE i.status = 'ACTIVE'";
  const params = [];

  if (filters.categoryId) {
    where += ' AND i.category_id = ?';
    params.push(filters.categoryId);
  }
  if (filters.itemId) {
    where += ' AND i.id = ?';
    params.push(filters.itemId);
  }

  const [rows] = await pool.query(
    `SELECT i.id, i.sku, i.name, c.name AS category, i.current_quantity, i.unit,
            i.minimum_stock_level, i.unit_cost,
            CASE
              WHEN i.current_quantity <= 0 THEN 'Out of Stock'
              WHEN i.current_quantity <= i.minimum_stock_level THEN 'Low Stock'
              ELSE 'In Stock'
            END AS stock_status,
            i.updated_at
     FROM items i
     JOIN categories c ON i.category_id = c.id
     ${where}
     ORDER BY c.name ASC, i.name ASC`,
    params
  );
  return rows;
}

async function getLowStockReport(filters = {}) {
  let where = "WHERE i.status = 'ACTIVE' AND i.current_quantity <= i.minimum_stock_level";
  const params = [];

  if (filters.categoryId) {
    where += ' AND i.category_id = ?';
    params.push(filters.categoryId);
  }

  const [rows] = await pool.query(
    `SELECT i.id, i.sku, i.name, c.name AS category, i.current_quantity, i.unit,
            i.minimum_stock_level,
            GREATEST(i.minimum_stock_level - i.current_quantity, 0) AS shortage_quantity,
            CASE WHEN i.current_quantity <= 0 THEN 'Out of Stock' ELSE 'Low Stock' END AS stock_status
     FROM items i
     JOIN categories c ON i.category_id = c.id
     ${where}
     ORDER BY i.current_quantity ASC, i.name ASC`,
    params
  );
  return rows;
}

async function getStockTransactionsReport(type, filters = {}) {
  let where = 'WHERE 1=1';
  const params = [];

  if (type) {
    where += ' AND t.transaction_type = ?';
    params.push(type);
  } else if (filters.transactionType) {
    where += ' AND t.transaction_type = ?';
    params.push(filters.transactionType);
  }

  if (filters.startDate) {
    where += ' AND DATE(t.created_at) >= ?';
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    where += ' AND DATE(t.created_at) <= ?';
    params.push(filters.endDate);
  }
  if (filters.itemId) {
    where += ' AND t.item_id = ?';
    params.push(filters.itemId);
  }
  if (filters.categoryId) {
    where += ' AND i.category_id = ?';
    params.push(filters.categoryId);
  }
  if (filters.userId) {
    where += ' AND t.user_id = ?';
    params.push(filters.userId);
  }

  const [rows] = await pool.query(
    `SELECT t.transaction_code, i.sku, i.name AS product_name, c.name AS category,
            t.transaction_type, t.quantity, i.unit, t.previous_quantity, t.new_quantity,
            t.supplier_or_recipient, t.reference_number, t.reason, u.name AS performed_by, t.created_at
     FROM stock_transactions t
     JOIN items i ON t.item_id = i.id
     JOIN categories c ON i.category_id = c.id
     JOIN users u ON t.user_id = u.id
     ${where}
     ORDER BY t.created_at DESC`,
    params
  );
  return rows;
}

async function getStockMovementReport(filters = {}) {
  let txWhere = 'WHERE 1=1';
  const params = [];

  if (filters.startDate) {
    txWhere += ' AND DATE(t.created_at) >= ?';
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    txWhere += ' AND DATE(t.created_at) <= ?';
    params.push(filters.endDate);
  }

  let itemWhere = "WHERE i.status = 'ACTIVE'";
  if (filters.categoryId) {
    itemWhere += ' AND i.category_id = ?';
    params.push(filters.categoryId);
  }
  if (filters.itemId) {
    itemWhere += ' AND i.id = ?';
    params.push(filters.itemId);
  }

  const [rows] = await pool.query(
    `SELECT i.sku, i.name AS product_name, c.name AS category, i.unit,
            COALESCE(SUM(CASE WHEN t.transaction_type = 'IN' THEN t.quantity ELSE 0 END), 0) AS total_in,
            COALESCE(SUM(CASE WHEN t.transaction_type = 'OUT' THEN t.quantity ELSE 0 END), 0) AS total_out,
            COALESCE(SUM(CASE WHEN t.transaction_type = 'IN' THEN t.quantity WHEN t.transaction_type = 'OUT' THEN -t.quantity ELSE 0 END), 0) AS net_movement,
            i.current_quantity
     FROM items i
     JOIN categories c ON i.category_id = c.id
     LEFT JOIN stock_transactions t ON t.item_id = i.id ${txWhere.replace('WHERE 1=1', '')}
     ${itemWhere}
     GROUP BY i.id, i.sku, i.name, c.name, i.unit, i.current_quantity
     ORDER BY i.name ASC`,
    params
  );
  return rows;
}

const REPORT_CONFIG = {
  inventory: {
    title: 'Current Inventory Report',
    columns: [
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Product Name', key: 'name', width: 28 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Available Qty', key: 'current_quantity', width: 14 },
      { header: 'Unit', key: 'unit', width: 12 },
      { header: 'Min Level', key: 'minimum_stock_level', width: 12 },
      { header: 'Status', key: 'stock_status', width: 14 },
    ],
    fetch: (f) => getInventoryReport(f),
  },
  'stock-in': {
    title: 'Stock-In Report',
    columns: [
      { header: 'Txn Code', key: 'transaction_code', width: 20 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Product', key: 'product_name', width: 26 },
      { header: 'Qty Received', key: 'quantity', width: 14 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Supplier', key: 'supplier_or_recipient', width: 22 },
      { header: 'Reference', key: 'reference_number', width: 16 },
      { header: 'User', key: 'performed_by', width: 18 },
      { header: 'Date', key: 'created_at', width: 20 },
    ],
    fetch: (f) => getStockTransactionsReport('IN', f),
  },
  'stock-out': {
    title: 'Stock-Out Report',
    columns: [
      { header: 'Txn Code', key: 'transaction_code', width: 20 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Product', key: 'product_name', width: 26 },
      { header: 'Qty Issued', key: 'quantity', width: 14 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Recipient/Dept', key: 'supplier_or_recipient', width: 20 },
      { header: 'Reason', key: 'reason', width: 22 },
      { header: 'User', key: 'performed_by', width: 18 },
      { header: 'Date', key: 'created_at', width: 20 },
    ],
    fetch: (f) => getStockTransactionsReport('OUT', f),
  },
  'low-stock': {
    title: 'Low-Stock & Out-of-Stock Report',
    columns: [
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Product Name', key: 'name', width: 28 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Available Qty', key: 'current_quantity', width: 14 },
      { header: 'Min Threshold', key: 'minimum_stock_level', width: 14 },
      { header: 'Shortage', key: 'shortage_quantity', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Status', key: 'stock_status', width: 14 },
    ],
    fetch: (f) => getLowStockReport(f),
  },
  movements: {
    title: 'Stock Movement Summary Report',
    columns: [
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Product Name', key: 'product_name', width: 28 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Total In', key: 'total_in', width: 14 },
      { header: 'Total Out', key: 'total_out', width: 14 },
      { header: 'Net Movement', key: 'net_movement', width: 14 },
      { header: 'Current Stock', key: 'current_quantity', width: 14 },
      { header: 'Unit', key: 'unit', width: 10 },
    ],
    fetch: (f) => getStockMovementReport(f),
  },
};

function formatCellValue(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString().replace('T', ' ').slice(0, 19);
  return String(val);
}

function escapeCsv(val) {
  const str = formatCellValue(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function generateCsv(reportType, filters) {
  const cfg = REPORT_CONFIG[reportType];
  const rows = await cfg.fetch(filters);
  const company = await getCompanyName();
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const range = filters.startDate || filters.endDate
    ? `${filters.startDate || 'Start'} to ${filters.endDate || 'Today'}`
    : 'All Dates';

  const lines = [
    `${escapeCsv(company)},${escapeCsv(cfg.title)}`,
    `Generated At,${escapeCsv(timestamp)},Date Range,${escapeCsv(range)}`,
    '',
    cfg.columns.map((c) => escapeCsv(c.header)).join(','),
    ...rows.map((r) => cfg.columns.map((c) => escapeCsv(r[c.key])).join(',')),
  ];

  return lines.join('\n');
}

async function generateExcelBuffer(reportType, filters) {
  const cfg = REPORT_CONFIG[reportType];
  const rows = await cfg.fetch(filters);
  const company = await getCompanyName();
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const range = filters.startDate || filters.endDate
    ? `${filters.startDate || 'Start'} to ${filters.endDate || 'Today'}`
    : 'All Dates';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = company;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(cfg.title.slice(0, 31));
  sheet.addRow([company]);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow([cfg.title]);
  sheet.getRow(2).font = { bold: true, size: 11 };
  sheet.addRow([`Generated: ${timestamp}`, `Date Range: ${range}`]);
  sheet.addRow([]);

  const headerRow = sheet.addRow(cfg.columns.map((c) => c.header));
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

  cfg.columns.forEach((c, idx) => {
    sheet.getColumn(idx + 1).width = c.width;
  });

  rows.forEach((row) => {
    sheet.addRow(cfg.columns.map((c) => {
      const v = row[c.key];
      if (v instanceof Date) return v.toISOString().replace('T', ' ').slice(0, 19);
      return v ?? '';
    }));
  });

  return workbook.xlsx.writeBuffer();
}

async function generatePdfBuffer(reportType, filters) {
  const cfg = REPORT_CONFIG[reportType];
  const rows = await cfg.fetch(filters);
  const company = await getCompanyName();
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const range = filters.startDate || filters.endDate
    ? `${filters.startDate || 'Start'} to ${filters.endDate || 'Today'}`
    : 'All Dates';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0F172A').text(company);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#2563EB').text(cfg.title);
    doc.fontSize(9).font('Helvetica').fillColor('#475569').text(`Generated: ${timestamp}   |   Date Range: ${range}   |   Records: ${rows.length}`);
    doc.moveDown(1);

    const pageWidth = doc.page.width - 72;
    const colWidth = pageWidth / cfg.columns.length;
    let y = doc.y;

    const drawHeader = () => {
      doc.rect(36, y, pageWidth, 20).fill('#0F172A');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
      cfg.columns.forEach((col, i) => {
        doc.text(col.header, 40 + i * colWidth, y + 6, { width: colWidth - 8, ellipsis: true });
      });
      y += 22;
    };

    drawHeader();

    doc.font('Helvetica').fontSize(8).fillColor('#1E293B');
    rows.forEach((row, idx) => {
      if (y > doc.page.height - 55) {
        doc.addPage();
        y = 36;
        drawHeader();
        doc.font('Helvetica').fontSize(8).fillColor('#1E293B');
      }
      if (idx % 2 === 1) {
        doc.rect(36, y - 2, pageWidth, 18).fill('#F8FAFC');
        doc.fillColor('#1E293B');
      }
      cfg.columns.forEach((col, i) => {
        doc.text(formatCellValue(row[col.key]), 40 + i * colWidth, y + 2, {
          width: colWidth - 8,
          height: 14,
          ellipsis: true,
        });
      });
      y += 18;
    });

    if (rows.length === 0) {
      doc.moveDown(1).fontSize(10).fillColor('#64748B').text('No records matched the selected filters.');
    }

    doc.end();
  });
}

module.exports = {
  REPORT_CONFIG,
  getInventoryReport,
  getLowStockReport,
  getStockTransactionsReport,
  getStockMovementReport,
  generateCsv,
  generateExcelBuffer,
  generatePdfBuffer,
};
