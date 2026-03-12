/**
 * The Clouds Academy - Fee Validators
 */

import Joi from 'joi';

export const feeVoucherSchema = Joi.object({
  student_id: Joi.string().uuid().required(),
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2020).max(2100).required(),
  due_date: Joi.date().iso().required(),
  amount: Joi.number().positive().required(),
  discount: Joi.number().min(0).default(0),
  fine: Joi.number().min(0).default(0),
  fee_breakdown: Joi.object(),
  notes: Joi.string().max(500),
});

export const collectPaymentSchema = Joi.object({
  amount_paid: Joi.number().positive().required(),
  payment_method: Joi.string()
    .valid('cash', 'cheque', 'bank_transfer', 'jazzcash', 'easypaisa', 'stripe', 'other')
    .required(),
  payment_date: Joi.date().iso().required(),
  transaction_id: Joi.string().max(100),
  notes: Joi.string().max(500),
});

export default { feeVoucherSchema, collectPaymentSchema };
