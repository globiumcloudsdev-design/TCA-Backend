import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Event = sequelize.define('Event', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  institute_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' }, onDelete: 'CASCADE' },
  branch_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'branches', key: 'id' }, onDelete: 'SET NULL' },
  event_name: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT },
  event_type: { type: DataTypes.ENUM('Academic','Sports','PTM','Cultural','Seminar','Holiday','Other'), allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  time: { type: DataTypes.TIME },
  location: { type: DataTypes.STRING(255), allowNull: false },
  audience_type: { type: DataTypes.ENUM('all','all_students','all_teachers','all_staff','selected_classes','custom_users'), allowNull: false },
  selected_class_ids: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
  custom_user_ids: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
  attendance_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  self_attendance_allowed: { type: DataTypes.BOOLEAN, defaultValue: false },
  send_notification: { type: DataTypes.BOOLEAN, defaultValue: true },
  status: { type: DataTypes.ENUM('draft','scheduled','completed','cancelled'), defaultValue: 'draft' },
  created_by: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  deleted_at: { type: DataTypes.DATE },
}, {
  tableName: 'events',
  timestamps: false,
  paranoid: true,
  indexes: [
    { fields: ['institute_id'] }, { fields: ['branch_id'] },
    { fields: ['date'] }, { fields: ['audience_type'] }, { fields: ['status'] },
  ],
});

Event.associate = (models) => {
  Event.belongsTo(models.Institute, { foreignKey: 'institute_id', as: 'institute' });
  Event.belongsTo(models.Branch, { foreignKey: 'branch_id', as: 'branch' });
  Event.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  Event.hasMany(models.StudentAttendance, { foreignKey: 'event_id', as: 'studentAttendances' });
  Event.hasMany(models.StaffAttendance, { foreignKey: 'event_id', as: 'staffAttendances' });
};

export default Event;