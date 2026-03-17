import { sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';

const [schema] = await sequelize.query('SELECT current_schema() as schema_name', { type: QueryTypes.SELECT });
const tables = await sequelize.query(
  "SELECT table_schema, table_name FROM information_schema.tables WHERE table_type='BASE TABLE' ORDER BY table_schema, table_name LIMIT 100",
  { type: QueryTypes.SELECT }
);

console.log('CURRENT SCHEMA:', schema.schema_name);
console.log('TOTAL TABLES RETURNED:', tables.length);
console.table(tables.slice(0, 30));

await sequelize.close();
