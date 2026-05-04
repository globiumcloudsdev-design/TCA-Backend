import fs from 'fs';
import path from 'path';
import models from '../models/postgres/index.js';

async function generate() {
    const queryInterface = models.sequelize.getQueryInterface();
    const allModels = Object.entries(models).filter(([name]) => name !== 'sequelize' && name !== 'School');
    
    let upContent = '    const transaction = await queryInterface.sequelize.transaction();\n    try {\n';
    let downContent = '    const transaction = await queryInterface.sequelize.transaction();\n    try {\n';

    // Sort models to avoid FK conflicts during creation
    // Simple heuristic: models with fewer FKs first, or just use the order from index.js
    // For a more robust solution, we'd need a dependency graph.
    // But since this is a "Full" initial migration, we can also disable FK checks during migration.
    
    upContent += '      // Disable foreign key checks for bulk creation\n';
    upContent += '      await queryInterface.sequelize.query(\'SET CONSTRAINTS ALL DEFERRED\', { transaction });\n\n';

    for (const [name, model] of allModels) {
        const tableName = model.tableName;
        const attrs = model.getAttributes();
        
        upContent += `      // ============ ${tableName.toUpperCase()} ============ \n`;
        upContent += `      await queryInterface.createTable('${tableName}', {\n`;
        
        for (const [attrName, attr] of Object.entries(attrs)) {
            let typeDef = `Sequelize.${attr.type.constructor.name}`;
            
            if (attr.type.constructor.name === 'DECIMAL' && attr.type.options) {
                const { precision, scale } = attr.type.options;
                if (precision) typeDef += `(${precision}${scale ? `, ${scale}` : ''})`;
            } else if (attr.type.constructor.name === 'ENUM' && attr.type.values) {
                typeDef += `('${attr.type.values.join("', '")}')`;
            } else if (attr.type.constructor.name === 'ARRAY' && attr.type.type) {
                typeDef += `(Sequelize.${attr.type.type.constructor.name})`;
            } else if (attr.type.constructor.name === 'STRING' && attr.type.options?.length) {
                typeDef += `(${attr.type.options.length})`;
            }
            
            let fieldDef = `        ${attrName}: {\n`;
            fieldDef += `          type: ${typeDef},\n`;
            if (attr.primaryKey) fieldDef += `          primaryKey: true,\n`;
            if (attr.autoIncrement) fieldDef += `          autoIncrement: true,\n`;
            if (attr.allowNull === false) fieldDef += `          allowNull: false,\n`;
            if (attr.unique) fieldDef += `          unique: true,\n`;
            if (attr.references) {
                fieldDef += `          references: { model: '${attr.references.model}', key: '${attr.references.key}' },\n`;
                if (attr.onDelete) fieldDef += `          onDelete: '${attr.onDelete}',\n`;
                if (attr.onUpdate) fieldDef += `          onUpdate: '${attr.onUpdate}',\n`;
            }
            fieldDef += `        },\n`;
            upContent += fieldDef;
        }
        
        upContent += `      }, { transaction });\n\n`;
        
        downContent += `      await queryInterface.dropTable('${tableName}', { transaction });\n`;
    }

    upContent += '      await transaction.commit();\n';
    upContent += '    } catch (err) {\n      await transaction.rollback();\n      throw err;\n    }';
    
    downContent += '      await transaction.commit();\n';
    downContent += '    } catch (err) {\n      await transaction.rollback();\n      throw err;\n    }';

    const fullContent = `'use strict';

/**
 * AUTO-GENERATED FULL INITIAL SCHEMA MIGRATION
 * Generated at: ${new Date().toISOString()}
 */

module.exports = {
  async up(queryInterface, Sequelize) {
${upContent}
  },

  async down(queryInterface, Sequelize) {
${downContent}
  }
};
`;

    fs.writeFileSync(path.join(process.cwd(), 'migrations/20260430000000-initial-database-schema.cjs'), fullContent);
    console.log('✅ Full migration file generated successfully!');
}

generate().catch(console.error);
