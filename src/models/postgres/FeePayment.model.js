/**
 * The Clouds Academy - FeePayment Model (Payment records)
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const FeePayment = sequelize.define(
  'FeePayment',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    school_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' } },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Optional — branch where payment was collected',
    },
    voucher_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'fee_vouchers', key: 'id' } },
    amount_paid: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    payment_method: {
      type: DataTypes.ENUM('cash', 'cheque', 'bank_transfer', 'jazzcash', 'easypaisa', 'stripe', 'other'),
      defaultValue: 'cash',
    },
    transaction_id: { type: DataTypes.STRING(100) },
    payment_date: { type: DataTypes.DATEONLY, allowNull: false },
    receipt_number: { type: DataTypes.STRING(50), unique: true },
    collected_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
    notes: { type: DataTypes.TEXT },
  },
  { tableName: 'fee_payments' }
);

FeePayment.associate = (models) => {
  FeePayment.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'institute' });
  FeePayment.belongsTo(models.FeeVoucher, { foreignKey: 'voucher_id' });
  FeePayment.belongsTo(models.User, { foreignKey: 'collected_by', as: 'collector' });
};

export default FeePayment;
