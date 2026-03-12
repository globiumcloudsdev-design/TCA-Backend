/**
 * The Clouds Academy - Attendance Model
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Attendance = sequelize.define(
  'Attendance',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    school_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' } },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Optional — branch where attendance was recorded',
    },
    academic_year_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'academic_years', key: 'id' },
      onDelete: 'SET NULL',
    },
    class_id: { type: DataTypes.UUID, references: { model: 'classes', key: 'id' } },
    section_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'sections', key: 'id' },
      onDelete: 'SET NULL',
    },
    student_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, comment: 'References users table (STUDENT type)' },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    status: {
      type: DataTypes.ENUM('present', 'absent', 'late', 'leave', 'holiday'),
      defaultValue: 'present',
    },
    remarks: { type: DataTypes.STRING(255) },
    marked_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
  },
  {
    tableName: 'attendances',
    indexes: [{ unique: true, fields: ['student_id', 'date'] }],
  }
);

Attendance.associate = (models) => {
  Attendance.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'institute' });
  Attendance.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'AcademicYear' });
  Attendance.belongsTo(models.Class, { foreignKey: 'class_id' });
  Attendance.belongsTo(models.Section, { foreignKey: 'section_id', as: 'Section' });
  Attendance.belongsTo(models.User, { foreignKey: 'student_id', as: 'Student' });
};

export default Attendance;
