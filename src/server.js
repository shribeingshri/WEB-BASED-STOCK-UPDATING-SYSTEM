const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { testConnection } = require('./config/db');
const { initSocket } = require('./utils/socket');

async function startServer() {
  try {
    await testConnection();
    console.log(`Connected to MySQL database "${env.db.name}" at ${env.db.host}:${env.db.port}`);
  } catch (err) {
    console.error('Warning: MySQL connection failed on startup:', err.message);
    console.error('Please verify your .env database credentials and ensure MySQL is running.');
  }

  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    console.log(`Buildmore Stock System running at http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

startServer();
