import { sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';

const tables = await sequelize.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
  { type: QueryTypes.SELECT }
);

console.log('PUBLIC TABLE COUNT:', tables.length);
console.table(tables);

await sequelize.close();
