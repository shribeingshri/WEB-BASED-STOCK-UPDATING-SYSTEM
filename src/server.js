const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { testConnection, enableDemoMode, isDemoMode } = require('./config/db');
const { initSocket } = require('./utils/socket');

async function startServer() {
  try {
    const connected = await testConnection();
    if (connected) {
      console.log(`Connected to MySQL database "${env.db.name}" at ${env.db.host}:${env.db.port}`);
    } else {
      console.log('Running in In-Memory Demo Mode (DEMO_MODE=true).');
    }
  } catch (err) {
    enableDemoMode();
    console.log(`MySQL unavailable (${err.message}). Automatically running in In-Memory Demo Mode.`);
  }

  if (isDemoMode()) {
    console.log('Demo Accounts: admin@buildmoreventures.in / Admin@123 | staff@buildmoreventures.in / Staff@123');
  }

  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    console.log(`Buildmore Stock System running at http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

startServer();
