import { syncDatabase } from './src/config/database.js';

const run = async () => {
  await syncDatabase({ alter: true });
  process.exit(0);
};

run();
