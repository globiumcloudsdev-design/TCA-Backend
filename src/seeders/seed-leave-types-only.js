/**
 * The Clouds Academy — Standalone Leave Types Seeder
 * 
 * This script only seeds leave types for institutes.
 * Use this to quickly seed leave types without running the full seeder.
 * 
 * Run:  node src/seeders/seed-leave-types-only.js
 */

import 'dotenv/config';
import { testConnection } from '../config/database.js';
import models from '../models/postgres/index.js';
import { seedLeaveTypes } from './04.leaveTypes.seed.js';

const run = async () => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   The Clouds Academy — Leave Types Seeder (Only)     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {
    // 1. Database connection
    await testConnection();

    // 2. Find all active institutes
    const institutes = await models.Institute.findAll({
      where: { is_active: true },
    });

    if (institutes.length === 0) {
      console.log('⚠️  No active institutes found — skipping LeaveType seeding');
      console.log('    Please create an institute first');
      process.exit(0);
    }

    // 3. Seed leave types for each institute
    console.log(`\n📚 Found ${institutes.length} active institute(s)\n`);
    for (const institute of institutes) {
      await seedLeaveTypes(models, institute.id);
    }

    console.log('\n✅  Leave Types seeding completed successfully!\n');
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
