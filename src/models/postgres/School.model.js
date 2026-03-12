/**
 * The Clouds Academy - School Model
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const School = sequelize.define(
  'School',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    email: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING(20) },
    address: { type: DataTypes.TEXT },
    city: { type: DataTypes.STRING(100) },
    logo_url: { type: DataTypes.STRING },
    logo_public_id: { type: DataTypes.STRING },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    subscription_status: {
      type: DataTypes.ENUM('trial', 'active', 'expired', 'suspended'),
      defaultValue: 'trial',
    },
    trial_ends_at: { type: DataTypes.DATE },
    // ─── Branch support ────────────────────────────────────────
    has_branches: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'When true, Classes must specify a branch_id',
    },

    // ─── Role Assignment ──────────────────────────────────────────
    // The role assigned to this school defines WHICH modules/permissions
    // the school can access. Think of it as a "school plan role".
    role_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'roles', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'The role that defines school-level permissions/module access',
    },

    settings: { type: DataTypes.JSONB, defaultValue: {} },
  },
  { tableName: 'schools' }
);

School.associate = (models) => {
  School.hasMany(models.User, { foreignKey: 'school_id', as: 'Users' });
  School.hasMany(models.Role, { foreignKey: 'school_id', as: 'Roles' });
  School.hasMany(models.Class, { foreignKey: 'school_id', as: 'Classes' });
  School.hasMany(models.AcademicYear, { foreignKey: 'school_id', as: 'AcademicYears' });
  School.hasOne(models.SchoolSubscription, { foreignKey: 'school_id', as: 'Subscription' });
  // The role template assigned to this school defines which modules/permissions it has
  School.belongsTo(models.Role, { foreignKey: 'role_id', as: 'AssignedRole' });
};

export default School;
