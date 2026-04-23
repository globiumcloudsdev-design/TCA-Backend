// src/models/postgres/ExpenseCategory.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const ExpenseCategory = sequelize.define('ExpenseCategory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  institute_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'institutes',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  parent_category: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  budget_limit: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  tableName: 'expense_categories',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['institute_id'] },
    { fields: ['name'] },
    { unique: true, fields: ['institute_id', 'name'] },
  ],
});

ExpenseCategory.associate = (models) => {
  ExpenseCategory.belongsTo(models.Institute, { foreignKey: 'institute_id', as: 'institute' });
  ExpenseCategory.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
};

export default ExpenseCategory;