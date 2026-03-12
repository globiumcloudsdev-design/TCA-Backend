/**
 * The Clouds Academy - Role Model (Polymorphic Permissions)
 *
 * Permissions are stored as JSONB keyed by userType:
 *   { instituteAdmin: [...], teacher: [...], student: [...], parent: [...] }
 *
 * Special value ['ALL'] grants full access for that user type.
 *
 * Platform template roles (is_template = true) have school_id = NULL.
 * Custom institute roles have school_id pointing to the owning institute.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Role = sequelize.define(
  'Role',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    school_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'institutes', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'NULL for platform template roles; institute UUID for custom institute roles',
    },

    name: { type: DataTypes.STRING(100), allowNull: false },
    code: { type: DataTypes.STRING(50), allowNull: false },
    description: { type: DataTypes.TEXT },

    is_template: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'true = platform-level seeded role | false = school-created custom role',
    },

    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },

    /**
     * JSONB permissions keyed by userType.
     * Example:
     * {
     *   instituteAdmin: ['students.create', 'fees.collect', ...],
     *   teacher:        ['attendance.mark', 'exam_results.enter', ...],
     *   student:        ['attendance.view', 'exam_results.view', ...],
     *   parent:         ['attendance.view', 'fees.read', ...]
     * }
     * Use ['ALL'] to grant unrestricted access for that type.
     */
    permissions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Keyed by userType: instituteAdmin | teacher | student | parent | master',
    },

    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'User UUID who created this role (NULL for seeded platform roles)',
    },
  },
  {
    tableName: 'roles',
    indexes: [
      // Unique code per school for custom roles
      { unique: true, fields: ['school_id', 'code'], name: 'unique_school_role_code' },
      // Unique code globally for template roles (school_id IS NULL)
      { unique: true, fields: ['code'], where: { school_id: null }, name: 'unique_template_role_code' },
    ],
  }
);

Role.associate = (models) => {
  Role.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'Institute' });
  Role.hasMany(models.Institute, { foreignKey: 'role_id', as: 'AssignedInstitutes' });
  Role.hasMany(models.User, { foreignKey: 'role_id', as: 'Users' });
};

export default Role;
