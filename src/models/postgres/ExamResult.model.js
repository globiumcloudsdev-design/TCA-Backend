/**
 * The Clouds Academy - ExamResult Model
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const ExamResult = sequelize.define(
  'ExamResult',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    school_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' } },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Optional — branch context for this result',
    },
    exam_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'exams', key: 'id' } },
    student_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, comment: 'References users table (STUDENT type)' },
    subject_id: { type: DataTypes.UUID, references: { model: 'subjects', key: 'id' } },
    marks_obtained: { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
    grade: { type: DataTypes.STRING(5) },
    remarks: { type: DataTypes.TEXT },
    is_absent: { type: DataTypes.BOOLEAN, defaultValue: false },
    entered_by: { type: DataTypes.UUID },
  },
  { tableName: 'exam_results' }
);

ExamResult.associate = (models) => {
  ExamResult.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'institute' });
  ExamResult.belongsTo(models.Exam, { foreignKey: 'exam_id' });
  ExamResult.belongsTo(models.User, { foreignKey: 'student_id', as: 'Student' });
  ExamResult.belongsTo(models.Subject, { foreignKey: 'subject_id' });
};

export default ExamResult;
