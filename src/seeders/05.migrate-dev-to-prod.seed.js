/**
 * Seed Script: Migrate Development Data to Production
 * 
 * Purpose:
 * - Copy MASTER_ADMIN users from dev DB
 * - Copy template roles from dev DB
 * - Copy subscription plans from dev DB
 * - Ensure all are properly seeded in production DB
 * 
 * Usage: node src/seeders/05.migrate-dev-to-prod.seed.js
 */

import sequelize from '../config/database.js';
import { Sequelize } from 'sequelize';
import User from '../models/postgres/User.model.js';
import Role from '../models/postgres/Role.model.js';
import SubscriptionPlan from '../models/postgres/SubscriptionPlan.model.js';
import logger from '../config/logger.js';

// Development DB Connection
const devSequelize = new Sequelize(
  'The Clouds Academy',
  'Globium Clouds',
  'npg_iDZ4CvJM1Nay',
  {
    host: 'ep-calm-bird-a1284utj-pooler.ap-southeast-1.aws.neon.tech',
    port: 5432,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
      channelBinding: 'require',
    },
    logging: false,
  }
);

// Define models for dev DB
const DevUser = devSequelize.define('User', {
  id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  user_type: { type: Sequelize.ENUM('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF') },
  first_name: { type: Sequelize.STRING },
  last_name: { type: Sequelize.STRING },
  email: { type: Sequelize.STRING },
  phone: { type: Sequelize.STRING },
  password_hash: { type: Sequelize.STRING },
  permissions: { type: Sequelize.JSONB },
  details: { type: Sequelize.JSONB },
  avatar_url: { type: Sequelize.STRING },
  avatar_public_id: { type: Sequelize.STRING },
  qr_code_url: { type: Sequelize.STRING },
  qr_code_public_id: { type: Sequelize.STRING },
  is_active: { type: Sequelize.BOOLEAN },
  last_login_at: { type: Sequelize.DATE },
  email_verified: { type: Sequelize.BOOLEAN },
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

const DevRole = devSequelize.define('Role', {
  id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  name: { type: Sequelize.STRING },
  code: { type: Sequelize.STRING },
  description: { type: Sequelize.TEXT },
  is_template: { type: Sequelize.BOOLEAN },
  is_active: { type: Sequelize.BOOLEAN },
  permissions: { type: Sequelize.JSONB },
  created_by: { type: Sequelize.UUID },
}, {
  tableName: 'roles',
  timestamps: true,
});

const DevSubscriptionPlan = devSequelize.define('SubscriptionPlan', {
  id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  name: { type: Sequelize.STRING },
  code: { type: Sequelize.STRING },
  description: { type: Sequelize.TEXT },
  cycle: { type: Sequelize.ENUM('MONTHLY', 'YEARLY', 'QUARTERLY', 'HALF_YEARLY') },
  price: { type: Sequelize.DECIMAL },
  currency: { type: Sequelize.STRING },
  trial_days: { type: Sequelize.INTEGER },
  limits: { type: Sequelize.JSONB },
  is_popular: { type: Sequelize.BOOLEAN },
  is_published: { type: Sequelize.BOOLEAN },
  is_active: { type: Sequelize.BOOLEAN },
  features: { type: Sequelize.JSONB },
  default_role_code: { type: Sequelize.STRING },
  metadata: { type: Sequelize.JSONB },
  display_order: { type: Sequelize.INTEGER },
}, {
  tableName: 'subscription_plans',
  timestamps: true,
});

/**
 * Main seed function
 */
async function seedMigration() {
  try {
    console.log('🔄 Starting migration from Development to Production...\n');

    // Connect to both databases
    console.log('📡 Connecting to Development Database...');
    await devSequelize.authenticate();
    console.log('✅ Development DB connected\n');

    console.log('📡 Connecting to Production Database...');
    await sequelize.authenticate();
    console.log('✅ Production DB connected\n');

    // ============ 1. MIGRATE MASTER_ADMIN USERS ============
    console.log('👤 Migrating MASTER_ADMIN users...');
    const devMasterAdmins = await DevUser.findAll({
      where: { user_type: 'MASTER_ADMIN' },
      raw: true,
    });

    if (devMasterAdmins.length > 0) {
      for (const adminData of devMasterAdmins) {
        const existingUser = await User.findByPk(adminData.id);
        
        if (existingUser) {
          console.log(`  ⚠️  MASTER_ADMIN already exists: ${adminData.email}`);
          continue;
        }

        await User.create(adminData);
        console.log(`  ✅ Migrated MASTER_ADMIN: ${adminData.first_name} ${adminData.last_name}`);
      }
    } else {
      console.log('  ℹ️  No MASTER_ADMIN users found in dev DB');
    }
    console.log();

    // ============ 2. MIGRATE TEMPLATE ROLES ============
    console.log('🔐 Migrating Template Roles...');
    const devTemplateRoles = await DevRole.findAll({
      where: { is_template: true },
      raw: true,
    });

    if (devTemplateRoles.length > 0) {
      for (const roleData of devTemplateRoles) {
        const existingRole = await Role.findByPk(roleData.id);
        
        if (existingRole) {
          console.log(`  ⚠️  Role already exists: ${roleData.code}`);
          continue;
        }

        await Role.create(roleData);
        console.log(`  ✅ Migrated Role: ${roleData.name} (${roleData.code})`);
      }
    } else {
      console.log('  ℹ️  No template roles found in dev DB');
    }
    console.log();

    // ============ 3. MIGRATE SUBSCRIPTION PLANS ============
    console.log('📊 Migrating Subscription Plans...');
    const devPlans = await DevSubscriptionPlan.findAll({
      raw: true,
    });

    if (devPlans.length > 0) {
      for (const planData of devPlans) {
        const existingPlan = await SubscriptionPlan.findByPk(planData.id);
        
        if (existingPlan) {
          console.log(`  ⚠️  Plan already exists: ${planData.code}`);
          continue;
        }

        await SubscriptionPlan.create(planData);
        console.log(`  ✅ Migrated Plan: ${planData.name} (${planData.code})`);
      }
    } else {
      console.log('  ℹ️  No subscription plans found in dev DB');
    }
    console.log();

    // ============ SUMMARY ============
    console.log('📋 Migration Summary:');
    console.log(`  - MASTER_ADMIN users: ${devMasterAdmins.length}`);
    console.log(`  - Template roles: ${devTemplateRoles.length}`);
    console.log(`  - Subscription plans: ${devPlans.length}`);
    console.log('\n✨ Migration completed successfully!\n');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the seed
seedMigration();
