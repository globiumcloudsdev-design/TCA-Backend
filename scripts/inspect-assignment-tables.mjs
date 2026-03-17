import { sequelize } from '../src/config/database.js';

const [tables] = await sequelize.query(
  "SELECT table_schema, table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_name ILIKE '%assignment%' ORDER BY table_schema, table_name"
);
console.table(tables);

await sequelize.close();
