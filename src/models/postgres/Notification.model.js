/**
 * The Clouds Academy - Notification Model
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Notification = sequelize.define(
  'Notification',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    institute_id: { type: DataTypes.UUID, references: { model: 'institutes', key: 'id' } },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Optional — branch-scoped notification',
    },
    user_id: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
    title: { type: DataTypes.STRING(255), allowNull: false },
    body: { type: DataTypes.TEXT },
    type: {
      type: DataTypes.ENUM('fee', 'attendance', 'exam', 'general', 'alert', 'system', 'payroll'),
      defaultValue: 'general',
      comment: 'Notification types: fee, attendance, exam, general, alert, system, payroll',
    },
    channel: { type: DataTypes.ENUM('push', 'email', 'sms', 'in_app'), defaultValue: 'in_app' },
    is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
    read_at: { type: DataTypes.DATE },
    data: { type: DataTypes.JSONB, defaultValue: {} },
  },
  { tableName: 'notifications', underscored: true, paranoid: true }
);

Notification.associate = (models) => {
  Notification.belongsTo(models.Institute, { foreignKey: 'institute_id', as: 'institute' });
  Notification.belongsTo(models.User, { foreignKey: 'user_id' });
};

export default Notification;
