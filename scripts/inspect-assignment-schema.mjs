import { sequelize } from '../src/config/database.js';

const [assignmentCols] = await sequelize.query(
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'assignments' ORDER BY ordinal_position"
);

const [submissionCols] = await sequelize.query(
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'assignment_submissions' ORDER BY ordinal_position"
);

console.log('ASSIGNMENTS COLUMNS');
console.table(assignmentCols);
console.log('ASSIGNMENT_SUBMISSIONS COLUMNS');
console.table(submissionCols);

await sequelize.close();
