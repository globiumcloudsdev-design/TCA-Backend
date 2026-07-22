import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const GlobalAnnouncement = sequelize.define('GlobalAnnouncement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('info', 'warning', 'success', 'urgent'),
    defaultValue: 'info'
  },
  target_type: {
    type: DataTypes.ENUM('all', 'specific'),
    defaultValue: 'all'
  },
  target_institutes: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of institute IDs if target_type is specific'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true
  },
  updated_by: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'global_announcements',
  underscored: true,
  timestamps: true
});

export default GlobalAnnouncement;
