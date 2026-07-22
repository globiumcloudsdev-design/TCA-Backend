import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const WebsiteCms = sequelize.define('WebsiteCms', {
  key: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  value: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  updated_by: {
    type: DataTypes.UUID,
    allowNull: true
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'website_cms',
  underscored: true,
  timestamps: true,
  paranoid: false
});

export default WebsiteCms;
