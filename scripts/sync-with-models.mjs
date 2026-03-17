import models from '../src/models/postgres/index.js';
import { testConnection, syncDatabase, sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';

console.log('Loaded models:', Object.keys(models).length);
await testConnection();
await syncDatabase({ alter: true, force: false });

const tables = await sequelize.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('assignments','assignment_submissions') ORDER BY table_name",
  { type: QueryTypes.SELECT }
);

console.log('Assignment table count:', tables.length);
console.table(tables);

await sequelize.close();
