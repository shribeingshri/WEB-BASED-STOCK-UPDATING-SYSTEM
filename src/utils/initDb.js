const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const env = require('../config/env');

async function runSqlFile(connection, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await connection.query(sql);
}

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
    timezone: 'Z',
  });

  try {
    console.log('Running database schema...');
    await runSqlFile(connection, path.resolve(__dirname, '../../database/schema.sql'));

    console.log('Running seed data...');
    await runSqlFile(connection, path.resolve(__dirname, '../../database/seed.sql'));

    await connection.query(`USE \`${env.db.name}\``);

    // Seed default Admin and Staff users if none exist
    const [existingUsers] = await connection.query('SELECT COUNT(*) AS count FROM users');
    if (existingUsers[0].count === 0) {
      const adminHash = await bcrypt.hash('Admin@123', env.bcryptRounds);
      const staffHash = await bcrypt.hash('Staff@123', env.bcryptRounds);

      await connection.query(
        `INSERT INTO users (name, username, email, password_hash, role, status) VALUES
         (?, ?, ?, ?, 'ADMIN', 'ACTIVE'),
         (?, ?, ?, ?, 'STAFF', 'ACTIVE')`,
        [
          'Buildmore Administrator',
          'admin',
          'admin@buildmoreventures.in',
          adminHash,
          'Warehouse Staff',
          'staff',
          'staff@buildmoreventures.in',
          staffHash,
        ]
      );
      console.log('Created default users: admin@buildmoreventures.in (Admin@123) and staff@buildmoreventures.in (Staff@123)');
    }

    // Seed initial items & opening transactions if items table is empty
    const [existingItems] = await connection.query('SELECT COUNT(*) AS count FROM items');
    if (existingItems[0].count === 0) {
      const [users] = await connection.query('SELECT id FROM users ORDER BY id ASC LIMIT 1');
      const adminId = users[0].id;

      const [cats] = await connection.query('SELECT id, name FROM categories');
      const catMap = Object.fromEntries(cats.map((c) => [c.name, c.id]));

      const [sups] = await connection.query('SELECT id, name FROM suppliers');
      const supMap = Object.fromEntries(sups.map((s) => [s.name, s.id]));

      const sampleItems = [
        {
          sku: 'CEM-OPC53-50',
          name: 'OPC 53 Grade Cement',
          description: '50 kg high-strength Ordinary Portland Cement bag',
          category_id: catMap['Cement & Aggregates'],
          supplier_id: supMap['Apex Building Materials Pvt Ltd'] || null,
          unit: 'Bags',
          current_quantity: 120,
          minimum_stock_level: 30,
          unit_cost: 385.0,
        },
        {
          sku: 'STL-TMT12-12M',
          name: 'TMT Steel Bar 12mm',
          description: 'Fe 550D thermo-mechanically treated steel bar (12m length)',
          category_id: catMap['Steel & Metals'],
          supplier_id: supMap['Metro Steel & Hardware'] || null,
          unit: 'Pieces',
          current_quantity: 18,
          minimum_stock_level: 25,
          unit_cost: 640.0,
        },
        {
          sku: 'PLB-CPVC-25',
          name: 'CPVC Pipe 25mm (3m)',
          description: 'SDR 11 hot and cold water plumbing pipe',
          category_id: catMap['Plumbing & Pipes'],
          supplier_id: supMap['Kaveri Pipes & Fittings'] || null,
          unit: 'Metres',
          current_quantity: 240,
          minimum_stock_level: 60,
          unit_cost: 92.5,
        },
        {
          sku: 'ELC-CAB-25SQ',
          name: 'FR PVC Insulated Copper Cable 2.5 sqmm',
          description: '90m coil flame-retardant house wiring cable',
          category_id: catMap['Electrical'],
          supplier_id: supMap['Metro Steel & Hardware'] || null,
          unit: 'Boxes',
          current_quantity: 0,
          minimum_stock_level: 10,
          unit_cost: 1850.0,
        },
        {
          sku: 'PNT-PRM-20L',
          name: 'Exterior Wall Primer',
          description: 'Water-based acrylic exterior wall primer 20L bucket',
          category_id: catMap['Paints & Finishes'],
          supplier_id: supMap['Apex Building Materials Pvt Ltd'] || null,
          unit: 'Litres',
          current_quantity: 80,
          minimum_stock_level: 40,
          unit_cost: 195.0,
        },
        {
          sku: 'TLS-HLM-STD',
          name: 'Industrial Safety Helmet',
          description: 'HDPE ventilated construction safety helmet with ratchet',
          category_id: catMap['Tools & Safety'],
          supplier_id: supMap['Metro Steel & Hardware'] || null,
          unit: 'Units',
          current_quantity: 12,
          minimum_stock_level: 15,
          unit_cost: 220.0,
        },
      ];

      for (let i = 0; i < sampleItems.length; i += 1) {
        const item = sampleItems[i];
        const [res] = await connection.query(
          `INSERT INTO items
           (sku, name, description, category_id, supplier_id, unit, current_quantity, minimum_stock_level, unit_cost, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
          [
            item.sku,
            item.name,
            item.description,
            item.category_id,
            item.supplier_id,
            item.unit,
            item.current_quantity,
            item.minimum_stock_level,
            item.unit_cost,
          ]
        );
        const itemId = res.insertId;

        if (item.current_quantity > 0) {
          const txCode = `TXN-INIT-${String(itemId).padStart(4, '0')}`;
          await connection.query(
            `INSERT INTO stock_transactions
             (transaction_code, item_id, user_id, transaction_type, quantity, previous_quantity, new_quantity, reference_number, supplier_or_recipient, reason, notes)
             VALUES (?, ?, ?, 'IN', ?, 0, ?, 'OPENING-BALANCE', 'Initial Stock', 'Opening Stock Entry', 'Initial seeded inventory')`,
            [txCode, itemId, adminId, item.current_quantity, item.current_quantity]
          );
        }

        if (item.current_quantity === 0) {
          await connection.query(
            `INSERT INTO alerts (item_id, alert_type, message, status)
             VALUES (?, 'OUT_OF_STOCK', ?, 'ACTIVE')`,
            [itemId, `${item.name} (${item.sku}) is out of stock (0 ${item.unit}).`]
          );
        } else if (item.current_quantity <= item.minimum_stock_level) {
          await connection.query(
            `INSERT INTO alerts (item_id, alert_type, message, status)
             VALUES (?, 'LOW_STOCK', ?, 'ACTIVE')`,
            [
              itemId,
              `${item.name} (${item.sku}) is low on stock (${item.current_quantity} / min ${item.minimum_stock_level} ${item.unit}).`,
            ]
          );
        }
      }
      console.log('Seeded initial inventory items, opening transactions, and alerts.');
    }

    console.log('Database initialization completed successfully.');
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Database initialization failed:', err.message);
      process.exit(1);
    });
}

module.exports = { initDatabase };

