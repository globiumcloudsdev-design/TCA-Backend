/**
 * One-time migration script for academic_years table
 * 
 * Changes:
 *  - school_id  → institute_id (references institutes.id)
 *  - branch_id  → removed
 *  - description → removed
 *  - created_by  → removed
 *  - unique index: school_id+name → institute_id+name
 */

import sequelize from '../src/config/database.js';
import '../src/models/postgres/index.js'; // load all models + associations

const migrate = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected!\n');

    // ─── Step 1: Check existing columns ────────────────────────────────────────
    const [existingCols] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'academic_years'
      ORDER BY ordinal_position;
    `);
    const colNames = existingCols.map(r => r.column_name);
    console.log('📋 Existing columns:', colNames.join(', '));

    // ─── Step 2: Add institute_id (if school_id exists but institute_id doesn't) ─
    if (colNames.includes('school_id') && !colNames.includes('institute_id')) {
      console.log('\n🔧 Renaming school_id → institute_id...');
      await sequelize.query(`
        ALTER TABLE academic_years 
        RENAME COLUMN school_id TO institute_id;
      `);
      console.log('   ✅ Renamed school_id → institute_id');

      // Drop old FK constraint on school_id
      await sequelize.query(`
        ALTER TABLE academic_years 
        DROP CONSTRAINT IF EXISTS academic_years_school_id_fkey;
      `);

      // Add correct FK to institutes
      await sequelize.query(`
        ALTER TABLE academic_years
        ADD CONSTRAINT academic_years_institute_id_fkey
        FOREIGN KEY (institute_id) 
        REFERENCES institutes(id) 
        ON DELETE CASCADE;
      `);
      console.log('   ✅ FK updated → institutes.id');
    } else if (!colNames.includes('institute_id')) {
      console.log('\n🔧 Adding institute_id column...');
      await sequelize.query(`
        ALTER TABLE academic_years 
        ADD COLUMN IF NOT EXISTS institute_id UUID 
        REFERENCES institutes(id) ON DELETE CASCADE;
      `);
      console.log('   ✅ institute_id added');
    } else {
      console.log('\n   ℹ️  institute_id already exists — skipping');
    }

    // ─── Step 3: Drop old columns (if they exist) ──────────────────────────────
    const dropCols = ['branch_id', 'description', 'created_by'];
    for (const col of dropCols) {
      if (colNames.includes(col)) {
        console.log(`\n🗑️  Dropping column: ${col}...`);
        await sequelize.query(`ALTER TABLE academic_years DROP COLUMN IF EXISTS ${col};`);
        console.log(`   ✅ Dropped: ${col}`);
      }
    }

    // ─── Step 4: Fix unique index ───────────────────────────────────────────────
    console.log('\n🔧 Fixing unique index...');
    // Drop old index (school_id + name)
    await sequelize.query(`
      DROP INDEX IF EXISTS academic_years_school_id_name;
    `);
    await sequelize.query(`
      DROP INDEX IF EXISTS academic_years_school_id_name_deleted_at;
    `);

    // Check and create new index (institute_id + name)
    const [indexes] = await sequelize.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'academic_years' 
      AND indexdef LIKE '%institute_id%' AND indexdef LIKE '%name%';
    `);
    if (indexes.length === 0) {
      await sequelize.query(`
        CREATE UNIQUE INDEX academic_years_institute_id_name 
        ON academic_years (institute_id, name) 
        WHERE deleted_at IS NULL;
      `);
      console.log('   ✅ New unique index created: (institute_id, name)');
    } else {
      console.log('   ℹ️  Index already exists — skipping');
    }

    // ─── Step 5: Verify final state ────────────────────────────────────────────
    const [finalCols] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'academic_years'
      ORDER BY ordinal_position;
    `);
    console.log('\n✅ Migration complete! Final table structure:');
    console.table(finalCols.map(c => ({
      column: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable,
    })));

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\n🔌 Database connection closed.');
    process.exit(0);
  }
};

migrate();
