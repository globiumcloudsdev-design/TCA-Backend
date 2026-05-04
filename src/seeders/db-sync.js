/**
 * The Clouds Academy - Database Schema Sync Script
 * 
 * This script synchronizes all Sequelize models to the database.
 * It uses sequelize.sync({ alter: true }) to update the schema without losing data.
 * 
 * Usage:
 *   NODE_ENV=production node src/seeders/db-sync.js
 */

import 'dotenv/config';
import models from '../models/postgres/index.js';
import logger from '../config/logger.js';

async function syncDatabase() {
  console.log(`\n🚀 Starting Database Sync in ${process.env.NODE_ENV || 'development'} mode...`);
  
  try {
    // 1. Authenticate
    await models.sequelize.authenticate();
    console.log('✅ Database connection established');

    // 2. Sync Models
    console.log('⏳ Syncing models (alter: true)...');
    await models.sequelize.sync({ alter: true });
    
    console.log('\n✨ Database schema synchronized successfully!');
    console.log('ℹ️  All models have been mapped to the database tables.');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database sync failed:');
    console.error(error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.error(error);
    }
    process.exit(1);
  }
}

syncDatabase();
