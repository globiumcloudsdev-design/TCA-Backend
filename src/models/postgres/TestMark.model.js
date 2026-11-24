/**
 * The Clouds Academy - TestMark Model (per-student marks of a TestRecord)
 *
 * marks_obtained NULL = not entered (never stored as 0). Absent => is_absent=true, marks NULL.
 * Unique per (test_record_id, student_id): marks are upserted, never bulk-replaced.
 */
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const TestMark = sequelize.define(
  'TestMark',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    test_record_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'test_records', key: 'id' } },
    institute_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' } },
    student_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
    marks_obtained: { type: DataTypes.DECIMAL(7, 2), allowNull: true },
    is_absent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    remark: { type: DataTypes.STRING(255), allowNull: true },
    entered_by: { type: DataTypes.UUID, allowNull: true },
  },
  { tableName: 'test_record_marks', paranoid: false }
);

TestMark.associate = (models) => {
  TestMark.belongsTo(models.TestRecord, { foreignKey: 'test_record_id', as: 'test' });
  TestMark.belongsTo(models.User, { foreignKey: 'student_id', as: 'student' });
};

export default TestMark;
