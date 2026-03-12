/**
 * The Clouds Academy — Main Seeder Runner
 *
 * Execution order:
 *   1. Connect to Neon PostgreSQL
 *   2. Sync schema (ALTER — non-destructive)
 *   3. Seed template roles  (01.roles.seed.js)
 *   4. Seed subscription plans  (02.subscriptionPlans.seed.js)
 *   5. Seed master admin user  (03.masterAdmin.seed.js)
 *
 * Run:  node src/seeders/index.seed.js
 *   or: npm run seed
 */

import 'dotenv/config';
import { testConnection, syncDatabase } from '../config/database.js';
import models from '../models/postgres/index.js';
import { seedInstituteTypes } from './00.instituteTypes.seed.js';
import { seedRoles } from './01.roles.seed.js';
import { seedSubscriptionPlans } from './02.subscriptionPlans.seed.js';
import { seedMasterAdmin } from './03.masterAdmin.seed.js';

const run = async () => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   The Clouds Academy — Database Seeder               ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {
    // 1. Database connection
    await testConnection();

    // 2. Schema sync skipped — tables already exist in Neon with correct schema.
    //    Uncomment the line below only on a completely fresh empty database:
    // await syncDatabase({ alter: false, force: false });

    // 2. Create new tables that don't exist yet (safe — won't drop existing tables)
    await models.InstituteType.sync({ force: false });

    // 3. Seed in dependency order
    await seedInstituteTypes(models); // Step 0: Institute types (School/College/etc)
    await seedRoles(models);
    await seedSubscriptionPlans(models);
    await seedMasterAdmin(models);

    console.log('\n✅  All seeders completed successfully!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌  Seeder failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await models.sequelize.close();
  }
};

run();
