/**
 * The Clouds Academy - Subscription Plan Routes
 *
 * Base: /api/v1/subscription-plans
 *
 * Permission middleware auto-bypasses for MASTER_ADMIN users.
 * Other users need the exact permission code in their role.permissions JSONB.
 */

import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import {
  getAllPlansController,
  getPublicPlansController,
  getPlanByIdController,
  createPlanController,
  updatePlanController,
  deletePlanController,
  togglePublishedController,
  togglePopularController,
  toggleActiveController,
} from '../../controllers/subscriptionPlan.controller.js';

const router = Router();

// ── Public (no auth) ──────────────────────────────────────────────────────────
// Visible on institute sign-up / pricing page
router.get('/public', getPublicPlansController);

// ── Protected CRUD ────────────────────────────────────────────────────────────

router.get(
  '/',
  protect,
  hasPermission('sub_template.read'),
  getAllPlansController
);

router.get(
  '/:id',
  protect,
  hasPermission('sub_template.read'),
  getPlanByIdController
);

router.post(
  '/',
  protect,
  hasPermission('sub_template.create'),
  createPlanController
);

router.put(
  '/:id',
  protect,
  hasPermission('sub_template.update'),
  updatePlanController
);

router.delete(
  '/:id',
  protect,
  hasPermission('sub_template.delete'),
  deletePlanController
);

// ── Toggle helpers ────────────────────────────────────────────────────────────

router.patch(
  '/:id/toggle-publish',
  protect,
  hasPermission('sub_template.update'),
  togglePublishedController
);

router.patch(
  '/:id/toggle-popular',
  protect,
  hasPermission('sub_template.update'),
  togglePopularController
);

router.patch(
  '/:id/toggle-active',
  protect,
  hasPermission('sub_template.update'),
  toggleActiveController
);

export default router;
