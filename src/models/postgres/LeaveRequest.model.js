// backend/src/models/postgres/LeaveRequest.model.js
/**
 * LeaveRequest Model
 * 
 * Handles leave applications for both Staff and Students
 * Supports approval workflow for required_approval leave types
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const LeaveRequest = sequelize.define(
  'LeaveRequest',
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
      comment: 'Institute this leave request belongs to',
    },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
    },
    leave_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'leave_types', key: 'id' },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'User applying for leave (staff_id or student_id)',
    },
    user_type: {
      type: DataTypes.ENUM('STAFF', 'STUDENT', 'TEACHER', 'ADMIN', 'HOD', 'OTHER'),
      allowNull: false,
      comment: 'Distinguishes whether this is a staff or student leave request',
    },
    from_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    to_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    number_of_days: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 1,
      comment: 'Total days of leave (including half-days)',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for leave application',
    },
    supporting_document: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL to uploaded supporting document (medical cert, etc)',
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'),
      defaultValue: 'PENDING',
      comment: 'Approval status of the leave request',
    },
    approved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: 'Admin/HOD who approved/rejected this request',
    },
    approval_remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Remarks on approval/rejection',
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp of approval/rejection',
    },
    marked_by_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: 'Admin/Staff who manually marked this leave',
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
    tableName: 'leave_requests',
    timestamps: true,
    underscored: true,
    paranoid: true, // Soft delete support
    indexes: [
      { fields: ['institute_id'] },
      { fields: ['branch_id'] },
      { fields: ['user_id', 'user_type'] },
      { fields: ['leave_type_id'] },
      { fields: ['status'] },
      { fields: ['from_date', 'to_date'] },
      { fields: ['institute_id', 'status'] },
    ],
  }
);

// Associations
LeaveRequest.associate = (models) => {
  LeaveRequest.belongsTo(models.Institute, {
    foreignKey: 'institute_id',
    as: 'institute',
  });
  LeaveRequest.belongsTo(models.Branch, {
    foreignKey: 'branch_id',
    as: 'branch',
  });
  LeaveRequest.belongsTo(models.LeaveType, {
    foreignKey: 'leave_type_id',
    as: 'leaveType',
  });
  LeaveRequest.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user',
  });
  LeaveRequest.belongsTo(models.User, {
    foreignKey: 'approved_by',
    as: 'approver',
  });
  LeaveRequest.belongsTo(models.User, {
    foreignKey: 'marked_by_id',
    as: 'markedBy',
  });
};

export default LeaveRequest;
