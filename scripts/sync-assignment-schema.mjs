import { testConnection, syncDatabase, sequelize } from '../src/config/database.js';

await testConnection();
await syncDatabase({ alter: true, force: false });

const [tables] = await sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('assignments','assignment_submissions') ORDER BY table_name");
console.log('Created/available assignment tables:');
console.table(tables);

await sequelize.close();
