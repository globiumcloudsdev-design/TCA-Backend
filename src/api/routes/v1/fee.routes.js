/**
 * The Clouds Academy - Fee Routes
 */

import { Router } from 'express';
import {
  createVoucherController,
  getVouchersController,
  collectPaymentController,
} from '../../controllers/fee.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import { schoolContext } from '../../middlewares/schoolContext.middleware.js';
import { requireActiveSubscription } from '../../middlewares/subscription.middleware.js';
import { auditLog } from '../../middlewares/audit.middleware.js';

const router = Router();

router.use(protect, schoolContext, requireActiveSubscription, auditLog);

router
  .route('/vouchers')
  .get(hasPermission('fee.read'), getVouchersController)
  .post(hasPermission('fee.create'), createVoucherController);

router.post('/vouchers/:id/collect', hasPermission('fee.collect'), collectPaymentController);

export default router;
