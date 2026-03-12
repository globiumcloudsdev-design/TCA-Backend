/**
 * The Clouds Academy - FeeVoucher Model
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const FeeVoucher = sequelize.define(
  'FeeVoucher',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    school_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' } },
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
    voucher_number: { type: DataTypes.STRING(50), unique: true },
    month: { type: DataTypes.INTEGER },
    year: { type: DataTypes.INTEGER },
    due_date: { type: DataTypes.DATEONLY },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    discount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    fine: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    net_amount: { type: DataTypes.DECIMAL(10, 2) },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'overdue', 'cancelled', 'partial'),
      defaultValue: 'pending',
    },
    fee_breakdown: { type: DataTypes.JSONB, defaultValue: {} },
    notes: { type: DataTypes.TEXT },
    created_by: { type: DataTypes.UUID },
  },
  { tableName: 'fee_vouchers' }
);

FeeVoucher.associate = (models) => {
  FeeVoucher.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'institute' });
  FeeVoucher.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'AcademicYear' });
  FeeVoucher.belongsTo(models.User, { foreignKey: 'student_id', as: 'Student' });
  FeeVoucher.hasMany(models.FeePayment, { foreignKey: 'voucher_id' });
};

export default FeeVoucher;
