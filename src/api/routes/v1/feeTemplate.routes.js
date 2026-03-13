// backend/src/routes/v1/feeTemplate.routes.js

/**
 * The Clouds Academy - Fee Template Routes
 */

import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import { schoolContext } from '../../middlewares/schoolContext.middleware.js';
import { checkSubscription } from '../../middlewares/subscription.middleware.js';
import * as feeTemplateController from '../../controllers/feeTemplate.controller.js';

const router = Router();

// Har route ke liye authentication + institute context + subscription check zaroori hai
router.use(protect);

/**
 * GET /api/v1/fee-templates
 * -------------------------
 * Saare fee templates fetch karta hai
 * Query params:
 *   - page, limit (pagination)
 *   - search (search by name/code)
 *   - status (active/inactive)
 *   - branch_id (filter by branch)
 *   - academic_year_id (filter by academic year)
 *   - is_default (filter default templates)
 */
router.get(
  '/',
  hasPermission('fee_templates.read'),
  feeTemplateController.getAllFeeTemplates
);

/**
 * GET /api/v1/fee-templates/:id
 * -----------------------------
 * Ek fee template ki details fetch karta hai
 */
router.get(
  '/:id',
  hasPermission('fee_templates.read'),
  feeTemplateController.getFeeTemplateById
);

/**
 * POST /api/v1/fee-templates
 * --------------------------
 * Naya fee template create karta hai
 * Body:
 *   - name: string (required)
 *   - code: string (optional)
 *   - description: string (optional)
 *   - fee_basis: 'monthly'|'quarterly'|'half_yearly'|'annually'|'one_time'
 *   - due_day: number (1-31)
 *   - late_fine_type: 'fixed'|'percentage'
 *   - late_fine_amount: number
 *   - late_fine_after_days: number
 *   - components: array of components
 *   - applicable_to: object (class_ids, section_ids, etc.)
 */
router.post(
  '/',
  hasPermission('fee_templates.create'),
  feeTemplateController.createFeeTemplate
);

/**
 * PUT /api/v1/fee-templates/:id
 * -----------------------------
 * Fee template update karta hai
 */
router.put(
  '/:id',
  hasPermission('fee_templates.update'),
  feeTemplateController.updateFeeTemplate
);

/**
 * DELETE /api/v1/fee-templates/:id
 * --------------------------------
 * Fee template delete karta hai
 */
router.delete(
  '/:id',
  hasPermission('fee_templates.delete'),
  feeTemplateController.deleteFeeTemplate
);

/**
 * PATCH /api/v1/fee-templates/:id/toggle-status
 * ---------------------------------------------
 * Fee template ko activate/deactivate karta hai
 * Body: { is_active: boolean }
 */
router.patch(
  '/:id/toggle-status',
  hasPermission('fee_templates.update'),
  feeTemplateController.toggleFeeTemplateStatus
);

/**
 * POST /api/v1/fee-templates/:id/assign
 * -------------------------------------
 * Fee template ko classes/sections/students par assign karta hai
 * Body: { 
 *   class_ids: string[],
 *   section_ids: string[],
 *   student_ids: string[],
 *   all_classes: boolean
 * }
 */
router.post(
  '/:id/assign',
  hasPermission('fee_templates.assign'),
  feeTemplateController.assignFeeTemplate
);

export default router;