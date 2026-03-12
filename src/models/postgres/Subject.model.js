/**
 * The Clouds Academy - Subject Model
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Subject = sequelize.define(
  'Subject',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    school_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' } },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Optional — branch where this subject is offered',
    },
    class_id: { type: DataTypes.UUID, references: { model: 'classes', key: 'id' } },
    teacher_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', comment: 'References users table (TEACHER type)' },
    name: { type: DataTypes.STRING(100), allowNull: false },
    code: { type: DataTypes.STRING(20) },
    full_marks: { type: DataTypes.INTEGER, defaultValue: 100 },
    pass_marks: { type: DataTypes.INTEGER, defaultValue: 40 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { tableName: 'subjects' }
);

Subject.associate = (models) => {
  Subject.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'institute' });
  Subject.belongsTo(models.Class, { foreignKey: 'class_id' });
  Subject.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'Teacher' });
};

export default Subject;
