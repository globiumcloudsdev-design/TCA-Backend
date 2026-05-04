/**
 * DEEP ANALYZE & FIX DATABASE SCHEMA
 * 
 * This script compares each model definition with the actual database table.
 * If a column is missing in the database, it adds it automatically.
 */

import 'dotenv/config';
import models from '../models/postgres/index.js';

async function deepFix() {
  const sequelize = models.sequelize;
  const queryInterface = sequelize.getQueryInterface();
  const allModels = Object.entries(models).filter(([name]) => name !== 'sequelize' && name !== 'School');

  console.log(`\n🔍 Analyzing schema for ${allModels.length} models...`);

  for (const [name, model] of allModels) {
    const tableName = model.tableName;
    try {
      // Check if table exists
      const tableExists = await queryInterface.showAllTables().then(tables => tables.includes(tableName));
      if (!tableExists) {
        console.log(`🚀 Table ${tableName} missing. Creating...`);
        await model.sync();
        continue;
      }

      // Check columns
      const tableDefinition = await queryInterface.describeTable(tableName);
      const attributes = model.rawAttributes;

      for (const [attrName, attr] of Object.entries(attributes)) {
        // Skip virtual fields
        if (attr.type.constructor.name === 'VIRTUAL') continue;

        if (!tableDefinition[attrName]) {
          console.log(`➕ Column [${attrName}] missing in table [${tableName}]. Adding...`);
          
          // Define column structure
          const columnDef = {
            type: attr.type,
            allowNull: attr.allowNull !== false,
            primaryKey: attr.primaryKey || false,
            autoIncrement: attr.autoIncrement || false,
          };
          
          if (attr.defaultValue !== undefined) columnDef.defaultValue = attr.defaultValue;
          if (attr.references) columnDef.references = attr.references;

          await queryInterface.addColumn(tableName, attrName, columnDef);
          console.log(`✅ Added [${attrName}] to [${tableName}]`);
        }
      }
    } catch (err) {
      console.error(`❌ Error processing table [${tableName}]:`, err.message);
    }
  }

  console.log('\n✨ Deep Analyze & Fix completed!');
  process.exit(0);
}

deepFix();
