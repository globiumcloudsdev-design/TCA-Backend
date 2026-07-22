/**
 * The Clouds Academy - Fee Voucher Routes
 */

import express from 'express';
import * as feeVoucherController from '../../controllers/feeVoucher.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * Generate vouchers
 */

// Generate single student voucher
router.post(
  '/generate-single',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER', 'STAFF'),
  feeVoucherController.generateSingleVoucher
);

// Generate vouchers for entire class
router.post(
  '/generate-class',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER', 'STAFF'),
  feeVoucherController.generateVouchersForClass
);

// Generate vouchers for entire institute
router.post(
  '/generate-institute',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'STAFF'),
  feeVoucherController.generateVouchersForInstitute
);

/**
 * Get and manage vouchers
 */

// Get monthly/academic statistics for vouchers
router.get(
  '/stats',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER', 'STAFF'),
  feeVoucherController.getFeeVouchersStats
);

// Get list of fee defaulters with >= 2 unpaid months
router.get(
  '/defaulters',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'STAFF'),
  feeVoucherController.getFeeDefaulters
);

// Warn fee defaulter and send real-time alerts
router.post(
  '/defaulters/:studentId/warn',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'STAFF'),
  feeVoucherController.warnFeeDefaulter
);

// Get all vouchers
router.get(
  '/',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER', 'STAFF'),
  feeVoucherController.getFeeVouchers
);

// Delete/Archive voucher
router.delete(
  '/:voucherId',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'STAFF'),
  feeVoucherController.deleteVoucher
);

// Bulk delete/archive vouchers
router.post(
  '/bulk-delete',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'STAFF'),
  feeVoucherController.bulkDeleteVouchers
);

// Update voucher status (mark as paid, etc.)
router.patch(
  '/:voucherId/status',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'STAFF'),
  feeVoucherController.updateVoucherStatus
);

/**
 * Payment endpoints
 */

// Record payment/collection against voucher
router.post(
  '/:voucherId/payment',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'STAFF'),
  feeVoucherController.recordPayment
);

// Get payment history for a voucher
router.get(
  '/:voucherId/payment-history',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'),
  feeVoucherController.getPaymentHistory
);

// Get payment summary for a fee type
router.get(
  '/payment-summary/:feeTypeId',
  restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'STAFF'),
  feeVoucherController.getPaymentSummary
);

export default router;
