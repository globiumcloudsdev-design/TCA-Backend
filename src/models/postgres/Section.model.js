/**
 * The Clouds Academy - Section Model
 *
 * Each Class can have multiple Sections (e.g., Class 5 → Section A, B, C).
 * Every Section is tied to a specific academic year and class.
 * Section-level assignment happens when enrolling a student.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Section = sequelize.define(
  'Section',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    school_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'institutes', key: 'id' },
      onDelete: 'CASCADE',
    },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Optional — branch this section belongs to',
    },
    class_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'classes', key: 'id' },
      onDelete: 'CASCADE',
    },
    academic_year_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'academic_years', key: 'id' },
      onDelete: 'RESTRICT',
    },
    name: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'e.g. "A", "B", "Blue", "Morning"',
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
    },
    room_number: {
      type: DataTypes.STRING(20),
      comment: 'e.g. "Room 101", "Lab-2"',
    },
    section_teacher_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Section teacher (references users table, TEACHER type)',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'sections',
    paranoid: true,
    indexes: [
      // A class cannot have two sections with the same name in the same academic year
      {
        unique: true,
        fields: ['class_id', 'academic_year_id', 'name'],
        where: { deleted_at: null },
      },
    ],
  }
);

Section.associate = (models) => {
  Section.belongsTo(models.School, { foreignKey: 'school_id' });
  Section.belongsTo(models.Class, { foreignKey: 'class_id', as: 'Class' });
  Section.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'AcademicYear' });
  Section.belongsTo(models.User, { foreignKey: 'section_teacher_id', as: 'SectionTeacher' });
};

export default Section;
