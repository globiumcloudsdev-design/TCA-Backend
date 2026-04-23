// backend/src/models/postgres/LeaveType.model.js
/**
 * LeaveType Model
 * 
 * Defines different types of leaves available in the institute
 * Examples: Sick Leave, Casual Leave, Vacation, Earned Leave, etc.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const LeaveType = sequelize.define(
  'LeaveType',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    institute_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'institutes', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'Institute this leave type belongs to',
    },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'Branch this leave type belongs to (optional - if null, applies to all branches)',
    },
    leave_type_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Name of the leave type (e.g., Sick Leave, Casual Leave)',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detailed description of the leave type',
    },
    max_days_per_year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Maximum number of days allowed per year (0 = unlimited)',
    },
    requires_approval: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this leave type requires approval before marking',
    },
    is_paid: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this leave is paid or unpaid',
    },
    color_code: {
      type: DataTypes.STRING(7),
      allowNull: true,
      defaultValue: '#3B82F6',
      comment: 'Hex color code for UI display (e.g., #FF5733)',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this leave type is currently active',
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Order of display in UI (lower = higher priority)',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Soft delete timestamp',
    },
  },
  {
    tableName: 'leave_types',
    timestamps: true,
    underscored: true,
    paranoid: true, // Soft delete support
    indexes: [
      { fields: ['institute_id'] },
      { fields: ['branch_id'] },
      { fields: ['is_active'] },
      { fields: ['institute_id', 'is_active'] },
      { fields: ['institute_id', 'branch_id', 'is_active'] },
    ],
  }
);

// Associations
LeaveType.associate = (models) => {
  LeaveType.belongsTo(models.Institute, {
    foreignKey: 'institute_id',
    as: 'institute',
  });
  LeaveType.hasMany(models.StaffAttendance, {
    foreignKey: 'leave_type_id',
    as: 'staffAttendances',
  });
};

export default LeaveType;
