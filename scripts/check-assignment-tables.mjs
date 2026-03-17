import { sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';

const tables = await sequelize.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('assignments','assignment_submissions') ORDER BY table_name",
  { type: QueryTypes.SELECT }
);

console.log('TABLE COUNT:', tables.length);
console.table(tables);

await sequelize.close();
