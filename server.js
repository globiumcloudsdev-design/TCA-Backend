/**
 * The Clouds Academy - Server Entry Point
 * ES6 Module: import/export syntax
 * Starting point: HTTP server + DB connection + Socket.io
 */

import app from './src/app.js';
import { testConnection, syncDatabase, fixForeignKeys } from './src/config/database.js';
import { createServer } from 'https';
import fs from 'fs';
import { initSocket } from './src/sockets/index.js';
import logger from './src/config/logger.js';
import config from './src/config/index.js';

const httpsOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/api.globiumclouds.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/api.globiumclouds.com/fullchain.pem')
};

const httpServer = createServer(httpsOptions, app);

// Initialize Socket.io
initSocket(httpServer);

const startServer = async () => {
  try {
    // Test DB connection
    await testConnection();

    // Fix stale FK: users.school_id was pointing to schools, now must point to institutes
    await fixForeignKeys();

    // Start listening
    httpServer.listen(config.port, config.host, () => {
      logger.info(`🚀 Server running at https://${config.host}:${config.port}`);
      logger.info(`🌍 Environment: ${config.env}`);
      logger.info(`📋 API Docs: https://${config.host}:${config.port}/api/v1/docs`);
    });
  } catch (error) {
    logger.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION:', err);
  httpServer.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

startServer();
