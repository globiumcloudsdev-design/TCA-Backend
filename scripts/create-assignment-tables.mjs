import models from '../src/models/postgres/index.js';
import { sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';

await models.Assignment.sync({ alter: false, force: false });
await models.AssignmentSubmission.sync({ alter: false, force: false });

const tables = await sequelize.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('assignments','assignment_submissions') ORDER BY table_name",
  { type: QueryTypes.SELECT }
);

console.log('Assignment tables now present:', tables.length);
console.table(tables);

await sequelize.close();
