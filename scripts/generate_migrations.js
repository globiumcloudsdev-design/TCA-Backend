import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import models, { sequelize } from '../src/models/postgres/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationDir = path.join(__dirname, '../migrations');

if (!fs.existsSync(migrationDir)) {
  fs.mkdirSync(migrationDir, { recursive: true });
} else {
  // clear old files
  fs.readdirSync(migrationDir).forEach(f => {
    if (f.endsWith('.cjs')) {
      fs.unlinkSync(path.join(migrationDir, f));
    }
  });
}

const order = [
  // Level 0 - Independent tables
  'InstituteType', 'GlobalSetting', 'SubscriptionPlan', 'WebsiteCms', 'GlobalAnnouncement',
  // Level 1 - Base tables
  'Institute',
  // Level 2 - Depend on Institute
  'Branch', 'Role', 'AcademicYear', 'Vendor', 'InstituteSettings', 'ExpenseCategory', 'LeaveType', 'Policy',
  // Level 3 - Depend on above
  'User', 'FeeTemplate', 'Class', 'Invoice', 'Event', 'SupportTicket',
  // Level 4
  'Section', 'Subject', 'Timetable', 'Exam', 'FeeVoucher', 'LeaveRequest', 'StaffAttendance', 'Payslip', 'Expense', 'Notification', 'AuditLog', 'Assignment',
  // Level 5
  'StudentAttendance', 'ExamResult', 'FeePayment', 'AssignmentSubmission'
];

function mapType(attribute) {
  const typeStr = attribute.type.constructor.name;
  let mappedType = `Sequelize.${typeStr}`;
  if (typeStr === 'STRING') {
    if (attribute.type._length) mappedType = `Sequelize.STRING(${attribute.type._length})`;
  } else if (typeStr === 'ENUM') {
    const values = attribute.type.values.map(v => `'${v.replace(/'/g, "\\'")}'`).join(', ');
    mappedType = `Sequelize.ENUM(${values})`;
  } else if (typeStr === 'DECIMAL') {
    mappedType = `Sequelize.DECIMAL(${attribute.type._precision || 10}, ${attribute.type._scale || 2})`;
  } else if (typeStr === 'ARRAY') {
    const innerTypeStr = attribute.type.type.constructor.name;
    mappedType = `Sequelize.ARRAY(Sequelize.${innerTypeStr})`;
  }
  return mappedType;
}

function formatDefaultValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'function') {
    if (val.name === 'uuidv4' || val.name === 'V4') return 'Sequelize.UUIDV4';
    if (val.name === 'now') return 'Sequelize.NOW';
    return null;
  }
  if (val && val.constructor && val.constructor.name === 'NOW') return 'Sequelize.NOW';
  if (val && val.constructor && val.constructor.name === 'UUIDV4') return 'Sequelize.UUIDV4';
  if (typeof val === 'string') return `'${val}'`;
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

function generateMigrationString(modelName, tableName, attributes, createdTables) {
  let fieldsStr = '';
  for (const [key, attr] of Object.entries(attributes)) {
    if (attr.type.constructor.name === 'VIRTUAL') continue;
    
    let fieldConfig = `      ${key}: {\n`;
    fieldConfig += `        type: ${mapType(attr)},\n`;
    
    if (attr.primaryKey) fieldConfig += `        primaryKey: true,\n`;
    if (attr.autoIncrement) fieldConfig += `        autoIncrement: true,\n`;
    if (attr.allowNull !== undefined) fieldConfig += `        allowNull: ${attr.allowNull},\n`;
    if (attr.unique) fieldConfig += `        unique: true,\n`;
    
    const defVal = formatDefaultValue(attr.defaultValue);
    if (defVal !== null) {
      fieldConfig += `        defaultValue: ${defVal},\n`;
    }

    if (attr.references && attr.references.model) {
      // DYNAMIC CIRCULAR DEPENDENCY FIX:
      if (createdTables.includes(attr.references.model)) {
        fieldConfig += `        references: {\n`;
        fieldConfig += `          model: '${attr.references.model}',\n`;
        fieldConfig += `          key: '${attr.references.key}'\n`;
        fieldConfig += `        },\n`;
        if (attr.onUpdate) fieldConfig += `        onUpdate: '${attr.onUpdate}',\n`;
        if (attr.onDelete) fieldConfig += `        onDelete: '${attr.onDelete}',\n`;
      } else {
        console.warn(`[!] Skipping FK constraint on ${tableName}.${key} -> ${attr.references.model} (table not created yet)`);
      }
    }
    
    fieldConfig += `      },\n`;
    fieldsStr += fieldConfig;
  }

  return `/**
 * Migration for ${modelName} (${tableName})
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('${tableName}', {
${fieldsStr.trimEnd()}
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('${tableName}');
  }
};
`;
}

let timeCounter = Date.now();
const createdTables = [];

order.forEach(modelName => {
  const model = models[modelName];
  if (!model) {
    console.warn(`Model ${modelName} not found!`);
    return;
  }
  const tableName = model.tableName;
  const attributes = model.getAttributes();
  
  const migrationCode = generateMigrationString(modelName, tableName, attributes, createdTables);
  
  createdTables.push(tableName);

  timeCounter += 1000;
  const dateStr = new Date(timeCounter).toISOString().replace(/[-:T.]/g, '').substring(0, 14);
  const fileName = `${dateStr}-create-${tableName}.cjs`;
  fs.writeFileSync(path.join(migrationDir, fileName), migrationCode);
  console.log(`Generated migration for ${modelName} -> ${fileName}`);
});

console.log('All migrations generated successfully!');
