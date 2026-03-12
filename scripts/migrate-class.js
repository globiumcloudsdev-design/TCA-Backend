/**
 * Migration script for classes table
 * 
 * Changes:
 *  - ADD: description (TEXT)
 *  - ADD: sections (JSONB)
 *  - ADD: courses (JSONB)
 *  - UPDATE unique index: (school_id, academic_year_id, branch_id, name) stays same
 *  - ADD GIN indexes for sections and courses JSONB columns
 */

import sequelize from '../src/config/database.js';
import '../src/models/postgres/index.js'; // load all models

const migrate = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected!\n');

    // ─── Check existing columns ─────────────────────────────────────────────────
    const [existingCols] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'classes'
      ORDER BY ordinal_position;
    `);
    const colNames = existingCols.map(r => r.column_name);
    console.log('📋 Existing columns:', colNames.join(', '));

    // ─── Step 1: Add description column ────────────────────────────────────────
    if (!colNames.includes('description')) {
      console.log('\n🔧 Adding description column...');
      await sequelize.query(`
        ALTER TABLE classes 
        ADD COLUMN description TEXT;
      `);
      console.log('   ✅ description column added');
    } else {
      console.log('\n   ℹ️  description already exists — skipping');
    }

    // ─── Step 2: Add sections JSONB column ─────────────────────────────────────
    if (!colNames.includes('sections')) {
      console.log('\n🔧 Adding sections JSONB column...');
      await sequelize.query(`
        ALTER TABLE classes 
        ADD COLUMN sections JSONB NOT NULL DEFAULT '[]'::jsonb;
      `);
      console.log('   ✅ sections column added (JSONB, default [])');
    } else {
      console.log('\n   ℹ️  sections already exists — skipping');
    }

    // ─── Step 3: Add courses JSONB column ──────────────────────────────────────
    if (!colNames.includes('courses')) {
      console.log('\n🔧 Adding courses JSONB column...');
      await sequelize.query(`
        ALTER TABLE classes 
        ADD COLUMN courses JSONB NOT NULL DEFAULT '[]'::jsonb;
      `);
      console.log('   ✅ courses column added (JSONB, default [])');
    } else {
      console.log('\n   ℹ️  courses already exists — skipping');
    }

    // ─── Step 4: Add GIN index for sections ────────────────────────────────────
    console.log('\n🔧 Checking GIN indexes...');
    const [ginIndexes] = await sequelize.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'classes' AND indexdef LIKE '%gin%';
    `);
    const ginIndexNames = ginIndexes.map(i => i.indexname);

    if (!ginIndexNames.some(n => n.includes('sections'))) {
      await sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS classes_sections_gin 
        ON classes USING GIN (sections);
      `);
      console.log('   ✅ GIN index created on sections');
    } else {
      console.log('   ℹ️  GIN index on sections already exists — skipping');
    }

    if (!ginIndexNames.some(n => n.includes('courses'))) {
      await sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS classes_courses_gin 
        ON classes USING GIN (courses);
      `);
      console.log('   ✅ GIN index created on courses');
    } else {
      console.log('   ℹ️  GIN index on courses already exists — skipping');
    }

    // ─── Step 5: Verify final state ────────────────────────────────────────────
    const [finalCols] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'classes'
      ORDER BY ordinal_position;
    `);

    console.log('\n✅ Migration complete! Final table structure:');
    console.table(finalCols.map(c => ({
      column:   c.column_name,
      type:     c.data_type,
      nullable: c.is_nullable,
      default:  c.column_default ? c.column_default.substring(0, 20) : null,
    })));

    const [finalIndexes] = await sequelize.query(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'classes';
    `);
    console.log('\n📑 Indexes:');
    finalIndexes.forEach(i => console.log('  -', i.indexname));

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
