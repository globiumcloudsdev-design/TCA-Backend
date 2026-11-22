/**
 * The Clouds Academy - Fee Service
 */

import FeeVoucher from '../models/postgres/FeeVoucher.model.js';
import FeePayment from '../models/postgres/FeePayment.model.js';
import User from '../models/postgres/User.model.js';
import { AppError } from '../utils/lib/AppError.js';
import APIFeatures from '../utils/lib/apiFeatures.js';
import { v4 as uuidv4 } from 'uuid';
import { recordPayment } from './feeVoucher.service.js';

/**
 * Generate voucher number
 */
const generateVoucherNumber = () =>
  `VCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const VOUCHER_FIELDS = ['student_id', 'academic_year_id', 'branch_id', 'fee_template_id', 'fee_type', 'month', 'year',
  'issued_date', 'due_date', 'amount', 'discount', 'fine', 'previous_balance', 'fee_breakdown', 'notes', 'currency'];

export const createFeeVoucher = async (schoolId, data, createdBy) => {
  // Whitelist: never let the client set id / status / institute_id / archived etc.
  const clean = {};
  VOUCHER_FIELDS.forEach((f) => { if (data[f] !== undefined) clean[f] = data[f]; });

  const amount = Number(clean.amount);
  if (!clean.student_id) throw new AppError('student_id is required', 400);
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError('A positive amount is required', 400);
  const discount = Number(clean.discount || 0);
  const fine = Number(clean.fine || 0);
  const netAmount = amount - discount + fine + Number(clean.previous_balance || 0);

  const student = await User.findOne({ where: { id: clean.student_id, school_id: schoolId, user_type: 'STUDENT' }, attributes: ['id'] });
  if (!student) throw new AppError('Student not found', 404);

  const voucher = await FeeVoucher.create({
    ...clean,
    amount,
    discount,
    fine,
    status: 'pending',
    institute_id: schoolId,
    voucher_number: generateVoucherNumber(),
    net_amount: netAmount,
    created_by: createdBy,
  });

  return voucher;
};

export const getFeeVouchers = async (schoolId, query = {}) => {
  const features = new APIFeatures({ institute_id: schoolId }, query)
    .filter(['status', 'student_id', 'branch_id', 'class_id', 'section_id', 'month', 'year', 'academic_year_id', 'voucher_number'])
    .allowSort(['created_at', 'due_date', 'net_amount', 'status', 'voucher_number'])
    .sort()
    .paginate();
  const opts = features.build();
  const { count, rows } = await FeeVoucher.findAndCountAll({
    ...opts,
    include: [{ model: User, as: 'Student', attributes: ['id', 'first_name', 'last_name', 'registration_no'] }],
  });
  return { vouchers: rows, pagination: features.getPaginationMeta(count) };
};

export const collectFeePayment = async (schoolId, voucherId, paymentData = {}, collectedBy) => {
  // Single payment path: locks the voucher, rejects overpayment, derives paid/partial status
  return recordPayment(voucherId, schoolId, {
    amount: paymentData.amount_paid ?? paymentData.amount,
    paymentMethod: paymentData.payment_method ?? paymentData.paymentMethod,
    reference: paymentData.transaction_id ?? paymentData.reference,
    paidDate: paymentData.payment_date,
    collectedBy,
  });
};

export default { createFeeVoucher, getFeeVouchers, collectFeePayment };
