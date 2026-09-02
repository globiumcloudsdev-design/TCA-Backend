import logger from '../src/config/logger.js';
import models, { sequelize } from '../src/models/postgres/index.js';

// Silence verbose logger in test mode unless DEBUG=true
if (process.env.DEBUG !== 'true') {
  logger.transports.forEach((t) => {
    t.silent = true;
  });
}

beforeAll(async () => {
  try {
    await sequelize.authenticate();
  } catch (err) {
    console.error('Database connection error in test setup:', err);
  }
});

afterAll(async () => {
  try {
    await sequelize.close();
  } catch (err) {
    // Ignore close errors
  }
});
