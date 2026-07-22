import { sequelize } from '../src/models/postgres/index.js';

async function fixSchema() {
  try {
    console.log('Recreating public schema...');
    await sequelize.query('CREATE SCHEMA IF NOT EXISTS public;');
    await sequelize.query('SET search_path TO public;');
    console.log('Schema public recreated.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixSchema();
