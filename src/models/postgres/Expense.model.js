// src/models/postgres/Expense.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Expense = sequelize.define('Expense', {
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
  branch_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'branches',
      key: 'id',
    },
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  vendor_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'vendors',
      key: 'id',
    },
  },
  vendor_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Manual vendor name if not using vendor_id',
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'paid', 'rejected'),
    defaultValue: 'pending',
  },
  receipt_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  expense_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Auto-generated expense number like EXP-2026-00001',
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  approved_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  paid_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  payment_reference: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'expenses',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['institute_id'] },
    { fields: ['branch_id'] },
    { fields: ['category'] },
    { fields: ['status'] },
    { fields: ['date'] },
    { fields: ['vendor_id'] },
    { fields: ['institute_id', 'branch_id'] },
  ],
});

Expense.associate = (models) => {
  Expense.belongsTo(models.Institute, { foreignKey: 'institute_id', as: 'institute' });
  Expense.belongsTo(models.Branch, { foreignKey: 'branch_id', as: 'branch' });
  Expense.belongsTo(models.Vendor, { foreignKey: 'vendor_id', as: 'vendor' });
  Expense.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  Expense.belongsTo(models.User, { foreignKey: 'approved_by', as: 'approver' });
  Expense.belongsTo(models.User, { foreignKey: 'paid_by', as: 'payer' });
};

export default Expense;