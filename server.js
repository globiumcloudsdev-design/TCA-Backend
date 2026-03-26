import app from './src/app.js';
import { testConnection, fixForeignKeys } from './src/config/database.js';
import { createServer } from 'http';
import { initSocket } from './src/sockets/index.js';
import logger from './src/config/logger.js';
import config from './src/config/index.js';

const httpServer = createServer(app);

initSocket(httpServer);

const startServer = async () => {
  try {

    await testConnection();
    await fixForeignKeys();

    httpServer.listen(config.port, config.host, () => {
      logger.info(`🚀 Server running at http://${config.host}:${config.port}`);
      logger.info(`🌍 Environment: ${config.env}`);
      logger.info(`📋 API Docs: http://${config.host}:${config.port}/api/v1/docs`);
    });

  } catch (error) {
    logger.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

startServer();