const mysql = require('mysql2/promise');
const env = require('./env');
const { initDemoStore } = require('./demoStore');

let demoMode = process.env.DEMO_MODE === 'true' || (Boolean(process.env.VERCEL) && !process.env.DB_HOST);
if (demoMode) {
  initDemoStore();
}

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  decimalNumbers: true,
  timezone: 'Z',
});

async function testConnection() {
  if (demoMode) {
    initDemoStore();
    return false;
  }
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}

function enableDemoMode() {
  demoMode = true;
  initDemoStore();
}

function isDemoMode() {
  return demoMode;
}

module.exports = { pool, testConnection, enableDemoMode, isDemoMode };
