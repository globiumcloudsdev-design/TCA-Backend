// backend/src/models/postgres/StaffAttendance.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const StaffAttendance = sequelize.define('StaffAttendance', {
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
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'branches', key: 'id' },
    onDelete: 'SET NULL',
  },
  staff_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE',
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Attendance date (YYYY-MM-DD)',
  },
  status: {
    type: DataTypes.ENUM('PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HOLIDAY', 'WEEKEND'),
    defaultValue: 'PRESENT',
  },
  check_in: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp of check-in',
  },
  check_out: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp of check-out',
  },
  late_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Minutes late (calculated vs shift start time)',
  },
  early_exit_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Minutes left before scheduled end',
  },
  overtime_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Minutes worked beyond shift end',
  },
  leave_type_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'leave_types', key: 'id' },
    comment: 'If status = LEAVE, reference to leave type',
  },
  leave_request_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'leave_requests', key: 'id' },
    comment: 'Optional link to approved leave request',
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  marked_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    comment: 'User who marked this attendance (admin/HR)',
  },
  marked_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'staff_attendances',
  timestamps: false, // we use manual marked_at / updated_at
  indexes: [
    { fields: ['institute_id'] },
    { fields: ['staff_id'] },
    { fields: ['date'] },
    { fields: ['status'] },
    { fields: ['branch_id'] },
    { fields: ['institute_id', 'date'] },
  ],
});

// Associations (to be defined after all models are loaded)
StaffAttendance.associate = (models) => {
  StaffAttendance.belongsTo(models.User, { foreignKey: 'staff_id', as: 'staff' });
  StaffAttendance.belongsTo(models.User, { foreignKey: 'marked_by', as: 'marker' });
  StaffAttendance.belongsTo(models.User, { foreignKey: 'updated_by', as: 'updater' });
  StaffAttendance.belongsTo(models.Institute, { foreignKey: 'institute_id', as: 'institute' });
  StaffAttendance.belongsTo(models.Branch, { foreignKey: 'branch_id', as: 'branch' });
  StaffAttendance.belongsTo(models.LeaveType, { foreignKey: 'leave_type_id', as: 'leaveType' });
  StaffAttendance.belongsTo(models.LeaveRequest, { foreignKey: 'leave_request_id', as: 'leaveRequest' });
};

export default StaffAttendance;