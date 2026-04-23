import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Payslip = sequelize.define('Payslip', {
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
  },
  staff_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE',
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '1-12',
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  basic_salary: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  allowances: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of { name, amount }',
  },
  total_allowances: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  deductions: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of { name, amount }',
  },
  total_deductions: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  overtime_amount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  net_salary: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'on_hold'),
    defaultValue: 'pending',
  },
  paid_on: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  payment_method: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  generated_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  generated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'payslips',
  timestamps: false,
  indexes: [
    { fields: ['institute_id'] },
    { fields: ['staff_id'] },
    { fields: ['month', 'year'] },
    { fields: ['status'] },
  ],
});

// ⚠️ CRITICAL: Add custom toJSON to ensure DECIMAL fields are properly typed as numbers
Payslip.prototype.toJSON = function() {
  const json = this.get({ plain: true });
  return {
    ...json,
    basic_salary: Number(json.basic_salary) || 0,
    total_allowances: Number(json.total_allowances) || 0,
    total_deductions: Number(json.total_deductions) || 0,
    overtime_amount: Number(json.overtime_amount) || 0,
    net_salary: Number(json.net_salary) || 0,
  };
};

Payslip.associate = (models) => {
  Payslip.belongsTo(models.User, { foreignKey: 'staff_id', as: 'staff' });
  Payslip.belongsTo(models.User, { foreignKey: 'generated_by', as: 'generator' });
  Payslip.belongsTo(models.Institute, { foreignKey: 'institute_id' });
  Payslip.belongsTo(models.Branch, { foreignKey: 'branch_id' });
};

export default Payslip;