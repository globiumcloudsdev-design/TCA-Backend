/**
 * The Clouds Academy - Exam Model
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Exam = sequelize.define(
  'Exam',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    school_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' } },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Optional — which branch conducted this exam',
    },
    academic_year_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'academic_years', key: 'id' },
      onDelete: 'SET NULL',
    },
    class_id: { type: DataTypes.UUID, references: { model: 'classes', key: 'id' } },
    name: { type: DataTypes.STRING(200), allowNull: false },
    type: { type: DataTypes.ENUM('mid_term', 'final', 'unit_test', 'monthly', 'other'), defaultValue: 'other' },
    start_date: { type: DataTypes.DATEONLY },
    end_date: { type: DataTypes.DATEONLY },
    total_marks: { type: DataTypes.INTEGER, defaultValue: 100 },
    pass_percentage: { type: DataTypes.DECIMAL(5, 2), defaultValue: 40 },
    status: { type: DataTypes.ENUM('scheduled', 'ongoing', 'completed', 'cancelled'), defaultValue: 'scheduled' },
    is_published: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_by: { type: DataTypes.UUID },
  },
  { tableName: 'exams' }
);

Exam.associate = (models) => {
  Exam.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'institute' });
  Exam.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'AcademicYear' });
  Exam.belongsTo(models.Class, { foreignKey: 'class_id' });
  Exam.hasMany(models.ExamResult, { foreignKey: 'exam_id' });
};

export default Exam;
