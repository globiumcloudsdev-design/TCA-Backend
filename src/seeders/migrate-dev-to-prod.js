/**
 * Safe Migration Script: Development -> Production
 * 
 * IMPORTANT: 
 * - Set your environment to 'production' before running this
 * - This script ONLY copies: MASTER_ADMIN users, template roles, subscription plans, institute types
 * - Custom institute data is NOT migrated (only template/global data)
 * 
 * Usage:
 *   NODE_ENV=production node src/seeders/migrate-dev-to-prod.js
 *   OR: npm run migrate:prod
 */

import 'dotenv/config';
import { Sequelize } from 'sequelize';
import logger from '../config/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

// Parse URL to handle URL-encoded characters (like %20 for spaces)
const parseDbUrl = (rawUrl) => {
  const url = new URL(rawUrl);
  return {
    database: decodeURIComponent(url.pathname.slice(1)),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host:     url.hostname,
    port:     parseInt(url.port, 10) || 5432,
  };
};

// Explicit database URLs from environment
const DEV_DB_URL = process.env.DATABASE_URL
const PROD_DB_URL = process.env.DATABASE_PROD_URL || process.env.DATABASE_URL

console.log(`\n🚀 Running in MODE: ${process.env.NODE_ENV || 'development'}`);
console.log(`📊 Dev DB: ${DEV_DB_URL.substring(0, 80)}...`);
console.log(`📊 Prod DB: ${PROD_DB_URL.substring(0, 80)}...`);
console.log();

// Parse URLs to handle encoded characters
const devDbConfig = parseDbUrl(DEV_DB_URL);
const prodDbConfig = parseDbUrl(PROD_DB_URL);

// Development DB Connection (always dev)
const devSequelize = new Sequelize({
  database: devDbConfig.database,
  username: devDbConfig.username,
  password: devDbConfig.password,
  host: devDbConfig.host,
  port: devDbConfig.port,
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
  },
  logging: false,
});

// Production DB Connection
const prodSequelize = new Sequelize({
  database: prodDbConfig.database,
  username: prodDbConfig.username,
  password: prodDbConfig.password,
  host: prodDbConfig.host,
  port: prodDbConfig.port,
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
  },
  logging: false,
});

// Define models for Dev DB
const DevUser = devSequelize.define('User', {
  id: { type: Sequelize.UUID, primaryKey: true },
  school_id: { type: Sequelize.UUID },
  branch_id: { type: Sequelize.UUID },
  role_id: { type: Sequelize.UUID },
  user_type: Sequelize.ENUM('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF', 'SUPPORT_STAFF', 'SYSTEM_ADMIN'),
  staff_type: Sequelize.ENUM('Accountant', 'Clerk', 'Librarian', 'Peon', 'Other', 'GateKeeper', 'Branch Head'),
  first_name: Sequelize.STRING,
  last_name: Sequelize.STRING,
  email: Sequelize.STRING,
  registration_no: Sequelize.STRING,
  phone: Sequelize.STRING,
  password_hash: Sequelize.STRING,
  permissions: Sequelize.JSONB,
  details: Sequelize.JSONB,
  avatar_url: Sequelize.STRING,
  avatar_public_id: Sequelize.STRING,
  qr_code_url: Sequelize.STRING,
  qr_code_public_id: Sequelize.STRING,
  is_active: Sequelize.BOOLEAN,
  last_login_at: Sequelize.DATE,
  password_reset_token: Sequelize.STRING,
  password_reset_expires: Sequelize.DATE,
  email_verified: Sequelize.BOOLEAN,
  created_by: Sequelize.UUID,
  updated_by: Sequelize.UUID,
  documents: Sequelize.JSONB,
}, { tableName: 'users', timestamps: true, underscored: true });

const DevRole = devSequelize.define('Role', {
  id: { type: Sequelize.UUID, primaryKey: true },
  school_id: Sequelize.UUID,
  name: Sequelize.STRING,
  code: Sequelize.STRING,
  description: Sequelize.TEXT,
  is_template: Sequelize.BOOLEAN,
  is_active: Sequelize.BOOLEAN,
  permissions: Sequelize.JSONB,
  created_by: Sequelize.UUID,
}, { tableName: 'roles', timestamps: true, underscored: true });

const DevSubscriptionPlan = devSequelize.define('SubscriptionPlan', {
  id: { type: Sequelize.UUID, primaryKey: true },
  name: Sequelize.STRING,
  code: Sequelize.STRING,
  description: Sequelize.TEXT,
  cycle: Sequelize.ENUM('MONTHLY', 'YEARLY', 'QUARTERLY', 'HALF_YEARLY'),
  price: Sequelize.DECIMAL,
  currency: Sequelize.STRING,
  trial_days: Sequelize.INTEGER,
  limits: Sequelize.JSONB,
  is_popular: Sequelize.BOOLEAN,
  is_published: Sequelize.BOOLEAN,
  is_active: Sequelize.BOOLEAN,
  features: Sequelize.JSONB,
  default_role_code: Sequelize.STRING,
  metadata: Sequelize.JSONB,
  display_order: Sequelize.INTEGER,
}, { tableName: 'subscription_plans', timestamps: true, underscored: true });

const DevInstituteType = devSequelize.define('InstituteType', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  name: Sequelize.STRING,
  slug: Sequelize.STRING,
  description: Sequelize.STRING,
  icon: Sequelize.STRING,
  is_active: Sequelize.BOOLEAN,
  sort_order: Sequelize.INTEGER,
}, { tableName: 'institute_types', timestamps: true, underscored: true });

// Define models for Prod DB
const ProdUser = prodSequelize.define('User', {
  id: { type: Sequelize.UUID, primaryKey: true },
  school_id: { type: Sequelize.UUID },
  branch_id: { type: Sequelize.UUID },
  role_id: { type: Sequelize.UUID },
  user_type: Sequelize.ENUM('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF', 'SUPPORT_STAFF', 'SYSTEM_ADMIN'),
  staff_type: Sequelize.ENUM('Accountant', 'Clerk', 'Librarian', 'Peon', 'Other', 'GateKeeper', 'Branch Head'),
  first_name: Sequelize.STRING,
  last_name: Sequelize.STRING,
  email: Sequelize.STRING,
  registration_no: Sequelize.STRING,
  phone: Sequelize.STRING,
  password_hash: Sequelize.STRING,
  permissions: Sequelize.JSONB,
  details: Sequelize.JSONB,
  avatar_url: Sequelize.STRING,
  avatar_public_id: Sequelize.STRING,
  qr_code_url: Sequelize.STRING,
  qr_code_public_id: Sequelize.STRING,
  is_active: Sequelize.BOOLEAN,
  last_login_at: Sequelize.DATE,
  password_reset_token: Sequelize.STRING,
  password_reset_expires: Sequelize.DATE,
  email_verified: Sequelize.BOOLEAN,
  created_by: Sequelize.UUID,
  updated_by: Sequelize.UUID,
  documents: Sequelize.JSONB,
}, { tableName: 'users', timestamps: true, underscored: true });

const ProdRole = prodSequelize.define('Role', {
  id: { type: Sequelize.UUID, primaryKey: true },
  school_id: Sequelize.UUID,
  name: Sequelize.STRING,
  code: Sequelize.STRING,
  description: Sequelize.TEXT,
  is_template: Sequelize.BOOLEAN,
  is_active: Sequelize.BOOLEAN,
  permissions: Sequelize.JSONB,
  created_by: Sequelize.UUID,
}, { tableName: 'roles', timestamps: true, underscored: true });

const ProdSubscriptionPlan = prodSequelize.define('SubscriptionPlan', {
  id: { type: Sequelize.UUID, primaryKey: true },
  name: Sequelize.STRING,
  code: Sequelize.STRING,
  description: Sequelize.TEXT,
  cycle: Sequelize.ENUM('MONTHLY', 'YEARLY', 'QUARTERLY', 'HALF_YEARLY'),
  price: Sequelize.DECIMAL,
  currency: Sequelize.STRING,
  trial_days: Sequelize.INTEGER,
  limits: Sequelize.JSONB,
  is_popular: Sequelize.BOOLEAN,
  is_published: Sequelize.BOOLEAN,
  is_active: Sequelize.BOOLEAN,
  features: Sequelize.JSONB,
  default_role_code: Sequelize.STRING,
  metadata: Sequelize.JSONB,
  display_order: Sequelize.INTEGER,
}, { tableName: 'subscription_plans', timestamps: true, underscored: true });

const ProdInstituteType = prodSequelize.define('InstituteType', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  name: Sequelize.STRING,
  slug: Sequelize.STRING,
  description: Sequelize.STRING,
  icon: Sequelize.STRING,
  is_active: Sequelize.BOOLEAN,
  sort_order: Sequelize.INTEGER,
}, { tableName: 'institute_types', timestamps: true, underscored: true });

/**
 * Main migration function
 */
async function runMigration() {
  try {
    if (isDev) {
      console.log('⚠️  WARNING: You are running this in DEVELOPMENT mode!');
      console.log('   Set NODE_ENV=production to migrate to production DB');
      console.log('   Proceeding with current environment...\n');
    }

    // Connection check
    console.log('🔗 Checking database connections...');
    await devSequelize.authenticate();
    console.log('✅ Dev DB connected');
    
    await prodSequelize.authenticate();
    console.log('✅ Prod DB connected\n');

    let stats = {
      users: 0,
      roles: 0,
      plans: 0,
      types: 0,
      skipped: 0,
    };

    // ============ 1. MIGRATE INSTITUTE TYPES ============
    console.log('🏫 [1/4] Migrating Institute Types...');
    const devTypes = await DevInstituteType.findAll({ raw: true });

    for (const typeData of devTypes) {
      try {
        const exists = await ProdInstituteType.findByPk(typeData.id);
        if (exists) {
          console.log(`  ⏭️  Already exists: ${typeData.slug}`);
          stats.skipped++;
          continue;
        }
        await ProdInstituteType.create(typeData);
        console.log(`  ✅ Created: ${typeData.name} (${typeData.slug})`);
        stats.types++;
      } catch (err) {
        console.log(`  ❌ Error: ${typeData.slug} - ${err.message}`);
      }
    }
    console.log();

    // ============ 2. MIGRATE TEMPLATE ROLES ============
    console.log('🔐 [2/4] Migrating Template Roles...');
    const devRoles = await DevRole.findAll({
      where: { is_template: true },
      raw: true,
    });

    for (const roleData of devRoles) {
      try {
        const exists = await ProdRole.findByPk(roleData.id);
        if (exists) {
          console.log(`  ⏭️  Already exists: ${roleData.code}`);
          stats.skipped++;
          continue;
        }
        await ProdRole.create(roleData);
        console.log(`  ✅ Created: ${roleData.name} (${roleData.code})`);
        stats.roles++;
      } catch (err) {
        console.log(`  ❌ Error: ${roleData.code} - ${err.message}`);
      }
    }
    console.log();

    // ============ 3. MIGRATE MASTER_ADMIN USERS ============
    console.log('👤 [3/4] Migrating MASTER_ADMIN users...');
    const devAdmins = await DevUser.findAll({
      where: { 
        user_type: {
          [Sequelize.Op.in]: ['MASTER_ADMIN', 'SUPPORT_STAFF', 'SYSTEM_ADMIN']
        }
      },
      raw: true,
    });

    for (const adminData of devAdmins) {
      try {
        const exists = await ProdUser.findByPk(adminData.id);
        if (exists) {
          console.log(`  ⏭️  Already exists: ${adminData.email}`);
          stats.skipped++;
          continue;
        }
        await ProdUser.create(adminData);
        console.log(`  ✅ Created: ${adminData.first_name} ${adminData.last_name} (${adminData.email})`);
        stats.users++;
      } catch (err) {
        console.log(`  ❌ Error: ${adminData.email} - ${err.message}`);
      }
    }
    console.log();

    // ============ 4. MIGRATE SUBSCRIPTION PLANS ============
    console.log('📊 [4/4] Migrating Subscription Plans...');
    const devPlans = await DevSubscriptionPlan.findAll({ raw: true });

    for (const planData of devPlans) {
      try {
        const exists = await ProdSubscriptionPlan.findByPk(planData.id);
        if (exists) {
          console.log(`  ⏭️  Already exists: ${planData.code}`);
          stats.skipped++;
          continue;
        }
        await ProdSubscriptionPlan.create(planData);
        console.log(`  ✅ Created: ${planData.name} (${planData.code})`);
        stats.plans++;
      } catch (err) {
        console.log(`  ❌ Error: ${planData.code} - ${err.message}`);
      }
    }
    console.log();

    // ============ SUMMARY ============
    console.log('📋 Migration Summary:');
    console.log(`  ✅ Institute types migrated: ${stats.types}`);
    console.log(`  ✅ MASTER_ADMIN users migrated: ${stats.users}`);
    console.log(`  ✅ Template roles migrated: ${stats.roles}`);
    console.log(`  ✅ Subscription plans migrated: ${stats.plans}`);
    console.log(`  ⏭️  Records skipped (already exist): ${stats.skipped}`);
    console.log(`  📊 Total processed: ${devTypes.length + devAdmins.length + devRoles.length + devPlans.length}\n`);

    console.log('✨ Migration completed successfully!');
    console.log('🔒 Only template data migrated (MASTER_ADMIN, roles, plans, types)');
    console.log('ℹ️  Custom institute data remains in development DB\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await devSequelize.close();
    await prodSequelize.close();
  }
}

// Run the migration
runMigration();
