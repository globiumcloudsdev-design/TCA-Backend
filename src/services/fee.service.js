/**
 * The Clouds Academy - Fee Service
 */

import FeeVoucher from '../models/postgres/FeeVoucher.model.js';
import FeePayment from '../models/postgres/FeePayment.model.js';
import User from '../models/postgres/User.model.js';
import { AppError } from '../utils/lib/AppError.js';
import APIFeatures from '../utils/lib/apiFeatures.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate voucher number
 */
const generateVoucherNumber = () =>
  `VCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export const createFeeVoucher = async (schoolId, data, createdBy) => {
  const netAmount = data.amount - (data.discount || 0) + (data.fine || 0);

  const voucher = await FeeVoucher.create({
    ...data,
    school_id: schoolId,
    voucher_number: generateVoucherNumber(),
    net_amount: netAmount,
    created_by: createdBy,
  });

  return voucher;
};

export const getFeeVouchers = async (schoolId, query = {}) => {
  const features = new APIFeatures({ school_id: schoolId }, query).filter().sort().paginate();
  const opts = features.build();
  const { count, rows } = await FeeVoucher.findAndCountAll({
    ...opts,
    include: [{ model: User, attributes: ['id', 'first_name', 'last_name', 'registration_no'] }],
  });
  return { vouchers: rows, pagination: features.getPaginationMeta(count) };
};

export const collectFeePayment = async (schoolId, voucherId, paymentData, collectedBy) => {
  const voucher = await FeeVoucher.findOne({ where: { id: voucherId, school_id: schoolId } });
  if (!voucher) throw new AppError('Fee voucher not found.', 404);
  if (voucher.status === 'paid') throw new AppError('Voucher already paid.', 400);

  const receipt = await FeePayment.create({
    ...paymentData,
    school_id: schoolId,
    voucher_id: voucherId,
    receipt_number: `RCP-${Date.now()}`,
    collected_by: collectedBy,
  });

  // Update voucher status
  await voucher.update({ status: 'paid' });

  return receipt;
};

export default { createFeeVoucher, getFeeVouchers, collectFeePayment };
