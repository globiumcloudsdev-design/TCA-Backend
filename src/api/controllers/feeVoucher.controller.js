/**
 * The Clouds Academy - Fee Voucher Controller
 * Endpoints for bulk voucher generation
 */

import * as feeVoucherService from '../../services/feeVoucher.service.js';
import catchAsync from '../../utils/lib/catchAsync.js';
import { AppError } from '../../utils/lib/AppError.js';
import { getInstituteId, getBranchId } from '../../utils/helpers/request.helper.js';

/**
 * Generate voucher for single student
 * POST /api/fee-vouchers/generate-single
 */
export const generateSingleVoucher = catchAsync(async (req, res) => {
  const studentId = req.body.studentId || req.body.student_id;
  const month = req.body.month;
  const year = req.body.year;
  const dueDate = req.body.dueDate || req.body.due_date;
  const academicYearId = req.body.academicYearId || req.body.academic_year_id;
  const feeType = req.body.feeType || req.body.fee_type;
  const feeTemplateId = req.body.feeTemplateId || req.body.fee_template_id;
  const instituteId = getInstituteId(req);
  const branchId = getBranchId(req);
  const createdBy = req.user.id;

  if (!studentId || !month || !year) {
    throw new AppError('Student ID, month, and year are required', 400);
  }

  const voucher = await feeVoucherService.generateSingleVoucher(
    studentId,
    instituteId,
    month,
    year,
    createdBy,
    { 
      dueDate, 
      academicYearId, 
      feeType, 
      feeTemplateId, 
      branch_id: branchId,
      amount: req.body.amount,
      fee_components: req.body.fee_components || req.body.components,
    }
  );

  res.status(201).json({
    success: true,
    message: 'Voucher generated successfully',
    data: voucher
  });
});

/**
 * Generate vouchers for entire class
 * POST /api/fee-vouchers/generate-class
 */
export const generateVouchersForClass = catchAsync(async (req, res) => {
  const classId = req.body.classId || req.body.class_id;
  const month = req.body.month;
  const year = req.body.year;
  const dueDate = req.body.dueDate || req.body.due_date;
  const academicYearId = req.body.academicYearId || req.body.academic_year_id;
  const feeType = req.body.feeType || req.body.fee_type;
  const feeTemplateId = req.body.feeTemplateId || req.body.fee_template_id;
  const instituteId = getInstituteId(req);
  const branchId = getBranchId(req);
  const createdBy = req.user.id;

  if (!classId || !month || !year) {
    throw new AppError('Class ID, month, and year are required', 400);
  }

  const result = await feeVoucherService.generateVouchersForClass(
    classId,
    instituteId,
    month,
    year,
    createdBy,
    { dueDate, academicYearId, feeType, feeTemplateId, branch_id: branchId }
  );

  res.status(201).json({
    success: true,
    message: 'Vouchers generated for class',
    data: result
  });
});

/**
 * Generate vouchers for entire institute
 * POST /api/fee-vouchers/generate-institute
 */
export const generateVouchersForInstitute = catchAsync(async (req, res) => {
  const { month, year, dueDate, academicYearId, feeType, feeTemplateId } = req.body;
  const instituteId = getInstituteId(req);
  const branchId = getBranchId(req);
  const createdBy = req.user.id;

  if (!month || !year) {
    throw new AppError('Month and year are required', 400);
  }

  const result = await feeVoucherService.generateVouchersForInstitute(
    instituteId,
    month,
    year,
    createdBy,
    { dueDate, academicYearId, feeType, feeTemplateId, branch_id: branchId }
  );

  res.status(201).json({
    success: true,
    message: 'Vouchers generated for institute',
    data: result
  });
});

/**
 * Get all fee vouchers
 * GET /api/fee-vouchers
 */
export const getFeeVouchers = catchAsync(async (req, res) => {
  const { month, year, status, student_id, academic_year_id, search, page = 1, limit = 20 } = req.query;
  const instituteId = getInstituteId(req);
  const branchId = getBranchId(req);

  const filters = {};
  if (branchId) filters.branch_id = branchId;
  if (month) filters.month = parseInt(month);
  if (year) filters.year = parseInt(year);
  if (status) filters.status = status;
  if (student_id) filters.student_id = student_id;
  if (academic_year_id) filters.academic_year_id = academic_year_id;
  if (search) filters.search = search;

  const result = await feeVoucherService.getFeeVouchers(
    instituteId,
    filters,
    { page: parseInt(page), limit: parseInt(limit) }
  );

  res.status(200).json({
    success: true,
    message: 'Fee vouchers retrieved',
    data: result
  });
});

/**
 * Delete/Archive voucher
 * DELETE /api/fee-vouchers/:voucherId
 */
export const deleteVoucher = catchAsync(async (req, res) => {
  const { voucherId } = req.params;
  const instituteId = getInstituteId(req);

  const voucher = await feeVoucherService.deleteVoucher(voucherId, instituteId);

  res.status(200).json({
    success: true,
    message: 'Voucher archived successfully',
    data: voucher
  });
});

/**
 * Update voucher status
 * PATCH /api/fee-vouchers/:voucherId/status
 */
export const updateVoucherStatus = catchAsync(async (req, res) => {
  const { voucherId } = req.params;
  const { status, partialAmount } = req.body;
  const instituteId = getInstituteId(req);

  if (!status) {
    throw new AppError('Status is required', 400);
  }

  const voucher = await feeVoucherService.updateVoucherStatus(
    voucherId,
    instituteId,
    status,
    partialAmount,
    { updatedBy: req.user.id }
  );

  res.status(200).json({
    success: true,
    message: `Voucher status updated to ${status}`,
    data: voucher
  });
});

/**
 * Record payment/collection against a fee voucher
 * POST /api/fee-vouchers/:voucherId/payment
 * Body: { amount, paymentMethod, reference, paidDate }
 */
export const recordPayment = catchAsync(async (req, res) => {
  const { voucherId } = req.params;
  const amount = req.body.amount;
  const paymentMethod = req.body.paymentMethod || req.body.payment_method;
  const reference = req.body.reference || req.body.remarks;
  const paidDate = req.body.paidDate || req.body.payment_date;
  const instituteId = getInstituteId(req);
  const collectedBy = req.user.id;

  if (!amount || amount <= 0) {
    throw new AppError('Valid payment amount is required', 400);
  }

  if (!paymentMethod) {
    throw new AppError('Payment method is required', 400);
  }

  const paymentRecord = await feeVoucherService.recordPayment(
    voucherId,
    instituteId,
    {
      amount,
      paymentMethod,
      reference,
      paidDate: paidDate || new Date(),
      collectedBy
    }
  );

  res.status(201).json({
    success: true,
    message: 'Payment recorded successfully',
    data: paymentRecord
  });
});

/**
 * Get payment history for a voucher
 * GET /api/fee-vouchers/:voucherId/payment-history
 */
export const getPaymentHistory = catchAsync(async (req, res) => {
  const { voucherId } = req.params;
  const instituteId = getInstituteId(req);

  const history = await feeVoucherService.getPaymentHistory(
    voucherId,
    instituteId
  );

  res.status(200).json({
    success: true,
    message: 'Payment history retrieved',
    data: history
  });
});

/**
 * Get payment summary for a fee type
 * GET /api/fee-vouchers/payment-summary/:feeTypeId
 */
export const getPaymentSummary = catchAsync(async (req, res) => {
  const { feeTypeId } = req.params;
  const { month, year } = req.query;
  const instituteId = getInstituteId(req);
  const branchId = getBranchId(req);

  const summary = await feeVoucherService.getPaymentSummary(
    feeTypeId,
    instituteId,
    { month: month ? parseInt(month) : null, year: year ? parseInt(year) : null, branch_id: branchId }
  );

  res.status(200).json({
    success: true,
    message: 'Payment summary retrieved',
    data: summary
  });
});

/**
 * Bulk delete vouchers (soft delete via archived flag)
 * POST /api/fee-vouchers/bulk-delete
 */
export const bulkDeleteVouchers = catchAsync(async (req, res) => {
  const { voucherIds } = req.body;
  const instituteId = getInstituteId(req);

  if (!voucherIds || !Array.isArray(voucherIds) || voucherIds.length === 0) {
    throw new AppError('Voucher IDs array is required', 400);
  }

  const result = await feeVoucherService.bulkDeleteVouchers(voucherIds, instituteId);

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} vouchers deleted successfully`,
    data: result
  });
});

export const getFeeVouchersStats = catchAsync(async (req, res) => {
  const { month, year, academic_year_id } = req.query;
  const instituteId = getInstituteId(req);
  const branchId = getBranchId(req);

  const stats = await feeVoucherService.getFeeVouchersStats(instituteId, {
    month,
    year,
    academic_year_id,
    branch_id: branchId
  });

  res.status(200).json({
    success: true,
    message: 'Fee voucher stats retrieved',
    data: stats
  });
});

export const getFeeDefaulters = catchAsync(async (req, res) => {
  const instituteId = getInstituteId(req);
  const branchId = getBranchId(req);
  const defaulters = await feeVoucherService.getFeeDefaulters(instituteId, { branch_id: branchId });

  res.status(200).json({
    success: true,
    message: 'Fee defaulters retrieved',
    data: defaulters
  });
});

export const warnFeeDefaulter = catchAsync(async (req, res) => {
  const { studentId } = req.params;
  const instituteId = getInstituteId(req);

  const result = await feeVoucherService.warnFeeDefaulter(instituteId, studentId);

  res.status(200).json({
    success: true,
    message: result.message,
    data: result
  });
});

export default {
  generateSingleVoucher,
  generateVouchersForClass,
  generateVouchersForInstitute,
  getFeeVouchers,
  deleteVoucher,
  updateVoucherStatus,
  recordPayment,
  getPaymentHistory,
  getPaymentSummary,
  bulkDeleteVouchers,
  getFeeVouchersStats,
  getFeeDefaulters,
  warnFeeDefaulter
};
