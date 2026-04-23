/**
 * Leave Type Routes
 * Manages leave type CRUD operations
 */

import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import * as leaveTypeController from '../../controllers/leaveType.controller.js';
import {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  getLeaveTypesQuerySchema,
} from '../../validators/leaveType.validator.js';

const router = Router();

// All routes require authentication
router.use(protect);

/**
 * Get all leave types with pagination and filtering
 * GET /api/v1/leave-types?page=1&limit=10&is_active=true&search=""
 */
router.get(
  '/',
  validate(getLeaveTypesQuerySchema, 'query'),
  leaveTypeController.getLeaveTypes
);

/**
 * Create new leave type
 * POST /api/v1/leave-types
 * Body: {
 *   leave_type_name: string,
 *   description?: string,
 *   max_days_per_year?: number,
 *   is_paid?: boolean,
 *   requires_approval?: boolean,
 *   color_code?: string
 * }
 */
router.post(
  '/',
  validate(createLeaveTypeSchema),
  leaveTypeController.createLeaveType
);

/**
 * Get leave type by ID
 * GET /api/v1/leave-types/:id
 */
router.get('/:id', leaveTypeController.getLeaveTypeById);

/**
 * Update leave type
 * PUT /api/v1/leave-types/:id
 */
router.put(
  '/:id',
  validate(updateLeaveTypeSchema),
  leaveTypeController.updateLeaveType
);

/**
 * Delete leave type (soft delete)
 * DELETE /api/v1/leave-types/:id
 */
router.delete('/:id', leaveTypeController.deleteLeaveType);

export default router;
