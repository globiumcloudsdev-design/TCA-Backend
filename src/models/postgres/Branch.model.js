// backend/src/models/Branch.model.js

/**
 * The Clouds Academy - Branch Model
 * 
 * Institute ke branches/campuses store karta hai
 * Multi-campus institutes ke liye
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const Branch = sequelize.define(
  'Branch',
  {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true,
      comment: 'Branch ki unique ID' 
    },

    institute_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'institutes', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'Kis institute ki branch hai'
    },

    // Basic Info
    name: { 
      type: DataTypes.STRING(200), 
      allowNull: false,
      comment: 'Branch ka naam e.g. "Main Campus", "DHA Branch"' 
    },

    code: { 
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      comment: 'Branch code e.g. "MAIN", "DHA-01"' 
    },

    // Contact Info
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Branch ka phone number'
    },

    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: { isEmail: true },
      comment: 'Branch ka email'
    },

    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Branch ka pata'
    },

    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Shahar'
    },

    // Head/Manager
    head_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Branch head/manager ka naam'
    },

    head_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Branch head ka user ID'
    },

    // Statistics
    student_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Kitne students hain is branch mein'
    },

    teacher_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Kitne teachers hain is branch mein'
    },

    class_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Kitni classes hain is branch mein'
    },

    // Settings
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {
        has_hostel: false,
        has_transport: false,
        has_library: true,
        has_lab: true,
        has_playground: false
      },
      comment: 'Branch-specific settings'
    },

    // Status
    is_active: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: true,
      comment: 'Branch active hai ya nahi' 
    },

    is_main: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Main branch hai ya nahi'
    },

    // Audit
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: 'Kis user ne banaya'
    },

    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: 'Kis user ne update kiya'
    }
  },
  {
    tableName: 'branches',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['institute_id'] },
      { fields: ['code'], unique: true },
      { fields: ['is_active'] },
      { fields: ['is_main'] },
      { fields: ['city'] },
      { fields: ['head_user_id'] }
    ]
  }
);

Branch.associate = (models) => {
  Branch.belongsTo(models.Institute, { foreignKey: 'institute_id', as: 'institute' });
  Branch.belongsTo(models.User, { foreignKey: 'head_user_id', as: 'head' });
  Branch.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  Branch.belongsTo(models.User, { foreignKey: 'updated_by', as: 'updater' });
  
  // Branch has many relations
  Branch.hasMany(models.Class, { foreignKey: 'branch_id', as: 'classes' });
  Branch.hasMany(models.User, { foreignKey: 'branch_id', as: 'users' });
  Branch.hasMany(models.FeeTemplate, { foreignKey: 'branch_id', as: 'feeTemplates' });
};

export default Branch;