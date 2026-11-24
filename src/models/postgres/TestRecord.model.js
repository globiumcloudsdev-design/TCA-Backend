/**
 * The Clouds Academy - TestRecord Model
 *
 * A class test (quick test), separate from formal Exams. Marks live in TestMark.
 * Table: test_records (see migrations/20261124000000-create-test-records.cjs)
 */
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const TestRecord = sequelize.define(
  'TestRecord',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    institute_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' } },
    branch_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'branches', key: 'id' } },
    academic_year_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'academic_years', key: 'id' } },
    teacher_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
    class_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'classes', key: 'id' } },
    section_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'sections', key: 'id' } },
    subject_id: { type: DataTypes.UUID, allowNull: true },
    subject_name: { type: DataTypes.STRING(100), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    test_date: { type: DataTypes.DATEONLY, allowNull: false },
    total_marks: { type: DataTypes.DECIMAL(7, 2), allowNull: false },
    passing_marks: { type: DataTypes.DECIMAL(7, 2), allowNull: false },
    status: {
      type: DataTypes.ENUM('draft', 'marks_entered', 'published'),
      allowNull: false,
      defaultValue: 'draft',
    },
    published_at: { type: DataTypes.DATE, allowNull: true },
    published_by: { type: DataTypes.UUID, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
  },
  { tableName: 'test_records' } // global define: underscored, timestamps, paranoid (deleted_at)
);

TestRecord.associate = (models) => {
  TestRecord.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'teacher' });
  TestRecord.belongsTo(models.Class, { foreignKey: 'class_id', as: 'class' });
  TestRecord.belongsTo(models.Section, { foreignKey: 'section_id', as: 'section' });
  TestRecord.hasMany(models.TestMark, { foreignKey: 'test_record_id', as: 'marks' });
};

export default TestRecord;
