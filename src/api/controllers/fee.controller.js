/**
 * The Clouds Academy - Fee Controller
 */

import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/helpers/response.helper.js';
import {
  createFeeVoucher,
  getFeeVouchers,
  collectFeePayment,
} from '../../services/fee.service.js';

export const createVoucherController = catchAsync(async (req, res) => {
  const voucher = await createFeeVoucher(req.school.id, req.body, req.user.id);
  sendCreated(res, voucher, 'Fee voucher created');
});

export const getVouchersController = catchAsync(async (req, res) => {
  const { vouchers, pagination } = await getFeeVouchers(req.school.id, req.query);
  sendPaginated(res, vouchers, pagination, 'Fee vouchers fetched');
});

export const collectPaymentController = catchAsync(async (req, res) => {
  const receipt = await collectFeePayment(req.school.id, req.params.id, req.body, req.user.id);
  sendSuccess(res, receipt, 'Payment collected successfully');
});

export default { createVoucherController, getVouchersController, collectPaymentController };
