/**
 * The Clouds Academy - Fee Controller
 */

import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/helpers/response.helper.js';
import { getInstituteId, getBranchId } from '../../utils/helpers/request.helper.js';
import {
  createFeeVoucher,
  getFeeVouchers,
  collectFeePayment,
} from '../../services/fee.service.js';

export const createVoucherController = catchAsync(async (req, res) => {
  const schoolId = getInstituteId(req) || req.school?.id;
  const branchId = getBranchId(req);
  const voucherData = {
    ...req.body,
    branch_id: req.isBranchRestricted ? req.allowedBranchId : (branchId || req.body.branch_id || null),
  };
  const voucher = await createFeeVoucher(schoolId, voucherData, req.user.id);
  sendCreated(res, voucher, 'Fee voucher created');
});

export const getVouchersController = catchAsync(async (req, res) => {
  const schoolId = getInstituteId(req) || req.school?.id;
  const branchId = getBranchId(req);
  const query = { ...req.query };
  if (branchId) query.branch_id = branchId;
  const { vouchers, pagination } = await getFeeVouchers(schoolId, query);
  sendPaginated(res, vouchers, pagination, 'Fee vouchers fetched');
});

export const collectPaymentController = catchAsync(async (req, res) => {
  const schoolId = getInstituteId(req) || req.school?.id;
  const receipt = await collectFeePayment(schoolId, req.params.id, req.body, req.user.id);
  sendSuccess(res, receipt, 'Payment collected successfully');
});

export default { createVoucherController, getVouchersController, collectPaymentController };
