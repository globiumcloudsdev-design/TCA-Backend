
// backend/src/models/User.model.js

/**
 * The Clouds Academy - User Model (Polymorphic)
 *
 * Single unified User table for all user types:
 *   MASTER_ADMIN | INSTITUTE_ADMIN | BRANCH_ADMIN | TEACHER | STUDENT | PARENT | STAFF
 *
 * Type-specific data is stored in the 'details' JSONB field
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    school_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'institutes', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'FK to institutes.id — NULL for MASTER_ADMIN, set for all other user types',
    },

    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'FK to branches.id — for users assigned to specific branch',
    },

    role_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'roles', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'FK to roles — permissions resolved by role + user_type combination',
    },

    user_type: {
      type: DataTypes.ENUM('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF'),
      allowNull: false,
      defaultValue: 'STAFF',
    },

    staff_type: {
      type: DataTypes.ENUM('Accountant', 'Clerk', 'Librarian', 'Peon', 'Other', 'GateKeeper', 'Branch Head'),
      allowNull: true,
      comment: 'Optional sub-type for STAFF users to distinguish roles',
    },

    first_name: { type: DataTypes.STRING(100), allowNull: false },
    last_name: { type: DataTypes.STRING(100), allowNull: false },

    email: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Optional for STUDENT (use registration_no instead)',
    },

    registration_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Student registration / GR number — used as login credential for STUDENT type',
    },

    phone: { type: DataTypes.STRING(20) },
    password_hash: { type: DataTypes.STRING, allowNull: false },

    // 🔥 Store resolved permissions from role OR custom permissions
    permissions: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Resolved permissions from assigned role or custom permissions',
    },

    details: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Type-specific data: studentDetails | teacherDetails | parentDetails | staffDetails',
    },

    avatar_url: { type: DataTypes.STRING },
    avatar_public_id: { type: DataTypes.STRING },
    qr_code_url: { type: DataTypes.STRING, comment: 'URL to generated QR code' },
    qr_code_public_id: { type: DataTypes.STRING, comment: 'Cloudinary public ID for QR code' },
    
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    last_login_at: { type: DataTypes.DATE },
    password_reset_token: { type: DataTypes.STRING },
    password_reset_expires: { type: DataTypes.DATE },
    email_verified: { type: DataTypes.BOOLEAN, defaultValue: false },

    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'UUID of the admin who created this account',
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'UUID of the admin who last updated this account',
    },

    // Documents Array
    documents: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: '[{ type: "id_card", url: "...", filename: "...", uploaded_at: "..." }]'
    },
  },
  {
    tableName: 'users',
    defaultScope: {
      attributes: { exclude: ['password_hash', 'password_reset_token', 'password_reset_expires'] },
    },
    scopes: {
      withPassword: { attributes: { exclude: [] } },
    },
    indexes: [
      { fields: ['school_id'] },
      { fields: ['branch_id'] },
      { fields: ['user_type'] },
      { fields: ['role_id'] },
      { fields: ['email'] },
      { fields: ['registration_no'] },
    ],
  }
);

// Helper method to add document
User.prototype.addDocument = function(docType, url, filename) {
  const docs = this.documents || [];
  docs.push({
    id: uuidv4(),
    type: docType,
    url,
    filename,
    uploaded_at: new Date()
  });
  return this.update({ documents: docs });
};

// Helper to get role permissions
User.prototype.getRolePermissions = async function(models) {
  if (!this.role_id) return [];
  
  const role = await models.Role.findByPk(this.role_id);
  if (!role) return [];
  
  // Get permissions for this user type
  return role.permissions[this.user_type.toLowerCase()] || [];
};

User.associate = (models) => {
  User.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'institute' });
  User.belongsTo(models.Branch, { foreignKey: 'branch_id', as: 'branch' });
  User.belongsTo(models.Role, { foreignKey: 'role_id', as: 'Role' });
  User.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  User.belongsTo(models.User, { foreignKey: 'updated_by', as: 'updater' });
};

export default User;