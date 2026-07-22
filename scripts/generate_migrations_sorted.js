import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import models, { sequelize } from '../src/models/postgres/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationDir = path.join(__dirname, '../migrations');

// Remove existing migrations
if (fs.existsSync(migrationDir)) {
  fs.readdirSync(migrationDir).forEach(f => {
    if (f.endsWith('.cjs')) {
      fs.unlinkSync(path.join(migrationDir, f));
    }
  });
}

function mapType(attribute) {
  const typeStr = attribute.type.constructor.name; 
  let mappedType = `Sequelize.${typeStr}`;
  
  if (typeStr === 'STRING') {
    if (attribute.type._length) {
      mappedType = `Sequelize.STRING(${attribute.type._length})`;
    }
  } else if (typeStr === 'ENUM') {
    const values = attribute.type.values.map(v => `'${v.replace(/'/g, "\\'")}'`).join(', ');
    mappedType = `Sequelize.ENUM(${values})`;
  } else if (typeStr === 'DECIMAL') {
    mappedType = `Sequelize.DECIMAL(${attribute.type._precision || 10}, ${attribute.type._scale || 2})`;
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
  if (val && val.constructor && val.constructor.name === 'NOW') {
    return 'Sequelize.NOW';
  }
  if (val && val.constructor && val.constructor.name === 'UUIDV4') {
    return 'Sequelize.UUIDV4';
  }
  if (typeof val === 'string') return `'${val}'`;
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

function generateMigrationString(modelName, tableName, attributes) {
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

    if (attr.references) {
      fieldConfig += `        references: {\n`;
      fieldConfig += `          model: '${attr.references.model}',\n`;
      fieldConfig += `          key: '${attr.references.key}'\n`;
      fieldConfig += `        },\n`;
      if (attr.onUpdate) fieldConfig += `        onUpdate: '${attr.onUpdate}',\n`;
      if (attr.onDelete) fieldConfig += `        onDelete: '${attr.onDelete}',\n`;
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

// Extract dependencies
const allModels = Object.keys(models).filter(m => m !== 'sequelize' && m !== 'School');
const dependencyGraph = {};

allModels.forEach(modelName => {
  const model = models[modelName];
  const attributes = model.getAttributes();
  const dependencies = new Set();
  
  for (const attr of Object.values(attributes)) {
    if (attr.references && attr.references.model) {
      // Find which model has this table name
      const refTableName = attr.references.model;
      const refModel = allModels.find(m => models[m].tableName === refTableName);
      if (refModel && refModel !== modelName) {
        dependencies.add(refModel);
      }
    }
  }
  dependencyGraph[modelName] = Array.from(dependencies);
});

// Topological sort
const sortedModels = [];
const visited = new Set();
const visiting = new Set();

function visit(modelName) {
  if (visited.has(modelName)) return;
  if (visiting.has(modelName)) {
    console.warn('Circular dependency detected involving:', modelName);
    return;
  }
  
  visiting.add(modelName);
  const deps = dependencyGraph[modelName] || [];
  deps.forEach(dep => visit(dep));
  
  visiting.delete(modelName);
  visited.add(modelName);
  sortedModels.push(modelName);
}

allModels.forEach(m => visit(m));

console.log('Resolved Migration Order:', sortedModels.join(' -> '));

let timeCounter = Date.now();
sortedModels.forEach((modelName, index) => {
  const model = models[modelName];
  const tableName = model.tableName;
  const attributes = model.getAttributes();
  
  const migrationCode = generateMigrationString(modelName, tableName, attributes);
  
  // Create sequential timestamp
  timeCounter += 1000;
  const dateStr = new Date(timeCounter).toISOString().replace(/[-:T.]/g, '').substring(0, 14);
  const fileName = `${dateStr}-create-${tableName}.cjs`;
  
  fs.writeFileSync(path.join(migrationDir, fileName), migrationCode);
  console.log(`Generated migration [${index + 1}/${sortedModels.length}]: ${fileName}`);
});
