import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const GlobalSetting = sequelize.define('GlobalSetting', {
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
  }
}, {
  tableName: 'global_settings',
  underscored: true,
  timestamps: true,
  paranoid: false
});

export default GlobalSetting;
