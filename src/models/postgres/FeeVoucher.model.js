/**
 * The Clouds Academy - FeeVoucher Model
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const FeeVoucher = sequelize.define(
  'FeeVoucher',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    institute_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' } },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Optional — branch that issued this fee voucher',
    },
    academic_year_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'academic_years', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Allows filtering/reporting fee collection by academic year',
    },
    student_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, comment: 'References users table (STUDENT type)' },
    fee_template_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'fee_templates', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Optional reference to fee template used',
    },
    fee_type: {
      type: DataTypes.ENUM('monthly', 'annual', 'lab', 'admission', 'fee_template'),
      allowNull: false,
      defaultValue: 'monthly',
      comment: 'Type of fee: monthly, annual, lab charges, admission charges, or fee template based',
    },
    voucher_number: { type: DataTypes.STRING(50), unique: true },
    month: { type: DataTypes.INTEGER, comment: 'Month for monthly fees (1-12)' },
    year: { type: DataTypes.INTEGER, comment: 'Year of the fee' },
    issued_date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW, comment: 'Date when voucher was issued' },
    currency: { type: DataTypes.STRING(10), defaultValue: 'PKR' },
    due_date: { type: DataTypes.DATEONLY },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    discount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    fine: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    previous_balance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      comment: 'Pending amount from previous partial payments',
    },
    net_amount: { type: DataTypes.DECIMAL(10, 2) },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'overdue', 'cancelled', 'partial'),
      defaultValue: 'pending',
    },
    fee_breakdown: { type: DataTypes.JSONB, defaultValue: {} },
    notes: { type: DataTypes.TEXT },
    archived: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'Soft delete/archive flag' },
    created_by: { type: DataTypes.UUID },
  },
  {
    tableName: 'fee_vouchers',
    timestamps: true, // created_at, updated_at
    paranoid: false, // Don't use deleted_at, we have archived field instead
  }
);

FeeVoucher.associate = (models) => {
  FeeVoucher.belongsTo(models.Institute, { foreignKey: 'institute_id', as: 'institute' });
  FeeVoucher.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'AcademicYear' });
  FeeVoucher.belongsTo(models.User, { foreignKey: 'student_id', as: 'Student' });
  FeeVoucher.hasMany(models.FeePayment, { foreignKey: 'voucher_id', as: 'payments' });
};

export default FeeVoucher;
