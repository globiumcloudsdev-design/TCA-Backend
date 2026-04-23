// src/models/postgres/Policy.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Policy = sequelize.define('Policy', {
  id: { 
    type: DataTypes.UUID, 
    defaultValue: DataTypes.UUIDV4, 
    primaryKey: true 
  },
  institute_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'institutes', key: 'id' }
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'branches', key: 'id' }
  },
  policy_type: {
    type: DataTypes.ENUM(
      'id_card',
      'payroll',
      'attendance',
      'leave',
      'exam',
      'fee',
      'transport',
      'hostel',
      'library',
      'hr',
      'academic',
      'it',
      'security'
    ),
    allowNull: false
  },
  policy_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  config: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  updated_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'policies',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    { fields: ['institute_id'] },
    { fields: ['branch_id'] },
    { fields: ['policy_type'] },
    { fields: ['is_active'] },
    { fields: ['institute_id', 'policy_type', 'is_active'] }
  ]
});

Policy.associate = (models) => {
  Policy.belongsTo(models.Institute, {
    foreignKey: 'institute_id',
    as: 'institute'
  });
  Policy.belongsTo(models.Branch, {
    foreignKey: 'branch_id',
    as: 'branch'
  });
  Policy.belongsTo(models.User, {
    foreignKey: 'created_by',
    as: 'creator'
  });
  Policy.belongsTo(models.User, {
    foreignKey: 'updated_by',
    as: 'updater'
  });
};

export default Policy;