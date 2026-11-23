const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

let ioInstance = null;

function parseCookies(cookieHeader = '') {
  const list = {};
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (!key) return;
    list[key] = decodeURIComponent(parts.join('='));
  });
  return list;
}

function initSocket(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: env.clientOrigin,
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie || '');
      const token = cookies.bm_token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const decoded = jwt.verify(token, env.jwt.secret);
      socket.user = decoded;
      return next();
    } catch {
      return next(new Error('Invalid authentication token'));
    }
  });

  ioInstance.on('connection', (socket) => {
    socket.join('authenticated');
    if (socket.user?.role) {
      socket.join(`role:${socket.user.role}`);
    }
  });

  return ioInstance;
}

function emitInventoryUpdate(payload) {
  if (ioInstance) {
    ioInstance.to('authenticated').emit('inventory:updated', payload);
  }
}

function emitAlertsUpdate(payload) {
  if (ioInstance) {
    ioInstance.to('authenticated').emit('alerts:updated', payload);
  }
}

module.exports = {
  initSocket,
  emitInventoryUpdate,
  emitAlertsUpdate,
};
