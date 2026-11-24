'use strict';

/**
 * Test Records (class tests, separate from formal exams)
 *
 * NOT RUN AUTOMATICALLY. Review, then run on the target DB with:
 *   npx sequelize-cli db:migrate
 *
 * Creates: test_records, test_record_marks. Idempotent (skips tables that exist).
 * Touches no existing table.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.showAllTables();
    const tables = existing.map((t) => (typeof t === 'string' ? t : t.tableName));

    if (!tables.includes('test_records')) {
      await queryInterface.createTable('test_records', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        institute_id: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'institutes', key: 'id' }, onDelete: 'CASCADE',
        },
        branch_id: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'branches', key: 'id' }, onDelete: 'SET NULL',
        },
        academic_year_id: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'academic_years', key: 'id' }, onDelete: 'SET NULL',
        },
        teacher_id: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT',
        },
        class_id: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'classes', key: 'id' }, onDelete: 'CASCADE',
        },
        section_id: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'sections', key: 'id' }, onDelete: 'SET NULL',
        },
        subject_id: { type: Sequelize.UUID, allowNull: true },
        subject_name: { type: Sequelize.STRING(100), allowNull: false },
        title: { type: Sequelize.STRING(200), allowNull: false },
        test_date: { type: Sequelize.DATEONLY, allowNull: false },
        total_marks: { type: Sequelize.DECIMAL(7, 2), allowNull: false },
        passing_marks: { type: Sequelize.DECIMAL(7, 2), allowNull: false },
        status: {
          type: Sequelize.ENUM('draft', 'marks_entered', 'published'),
          allowNull: false, defaultValue: 'draft',
        },
        published_at: { type: Sequelize.DATE, allowNull: true },
        published_by: { type: Sequelize.UUID, allowNull: true },
        created_by: { type: Sequelize.UUID, allowNull: true },
        updated_by: { type: Sequelize.UUID, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
      await queryInterface.addIndex('test_records', ['institute_id', 'test_date'], { name: 'test_records_institute_date' });
      await queryInterface.addIndex('test_records', ['teacher_id', 'status'], { name: 'test_records_teacher_status' });
      await queryInterface.addIndex('test_records', ['class_id', 'section_id'], { name: 'test_records_class_section' });
      await queryInterface.addIndex('test_records', ['institute_id', 'branch_id', 'status'], { name: 'test_records_branch_status' });
    }

    if (!tables.includes('test_record_marks')) {
      await queryInterface.createTable('test_record_marks', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        test_record_id: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'test_records', key: 'id' }, onDelete: 'CASCADE',
        },
        institute_id: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'institutes', key: 'id' }, onDelete: 'CASCADE',
        },
        student_id: {
          type: Sequelize.UUID, allowNull: false,
          references: { model: 'users', key: 'id' }, onDelete: 'CASCADE',
        },
        // NULL = not entered yet (never stored as 0). Absent rows have is_absent = true and NULL marks.
        marks_obtained: { type: Sequelize.DECIMAL(7, 2), allowNull: true },
        is_absent: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        remark: { type: Sequelize.STRING(255), allowNull: true },
        entered_by: { type: Sequelize.UUID, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('test_record_marks', ['test_record_id', 'student_id'], {
        unique: true, name: 'test_record_marks_unique_student',
      });
      await queryInterface.addIndex('test_record_marks', ['student_id'], { name: 'test_record_marks_student' });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('test_record_marks');
    await queryInterface.dropTable('test_records');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_test_records_status";');
  },
};
