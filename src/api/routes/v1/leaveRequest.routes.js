// src/api/routes/v1/leaveRequest.routes.js
import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import * as leaveRequestController from '../../controllers/leaveRequest.controller.js';
import {
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  approveRejectLeaveSchema,
  getMyLeaveRequestsQuerySchema,
  getLeaveRequestsQuerySchema,
  cancelLeaveRequestSchema,
  adminMarkLeaveSchema,
} from '../../validators/leaveRequest.validator.js';

const router = Router();

// All routes require authentication
router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// MY LEAVE REQUESTS (Personal)
// ─────────────────────────────────────────────────────────────────────────────

// Get my leave statistics
router.get('/statistics/my-stats', leaveRequestController.getMyLeaveStatistics);

// Get my leave requests
router.get('/my-requests', validate(getMyLeaveRequestsQuerySchema, 'query'), leaveRequestController.getMyLeaveRequests);

// Create new leave request
router.post(
  '/',
  validate(createLeaveRequestSchema),
  leaveRequestController.createLeaveRequest
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

// Admin: Mark leave for staff/student (creates approved or pending leave)
router.post(
  '/admin/mark-leave',
  validate(adminMarkLeaveSchema),
  leaveRequestController.adminMarkLeave
);

// ─────────────────────────────────────────────────────────────────────────────
// SPECIFIC LEAVE REQUEST
// ─────────────────────────────────────────────────────────────────────────────

// Get leave request by ID
router.get('/:id', leaveRequestController.getLeaveRequestById);

// Update leave request (only if PENDING)
router.put(
  '/:id',
  validate(updateLeaveRequestSchema),
  leaveRequestController.updateLeaveRequest
);

// Cancel leave request (only if PENDING)
router.patch(
  '/:id/cancel',
  validate(cancelLeaveRequestSchema),
  leaveRequestController.cancelLeaveRequest
);

// Approve or reject leave request
router.patch(
  '/:id/approve-reject',
  validate(approveRejectLeaveSchema),
  leaveRequestController.approveRejectLeaveRequest
);

// ─────────────────────────────────────────────────────────────────────────────
// ALL LEAVE REQUESTS (Admin/Approver)
// ─────────────────────────────────────────────────────────────────────────────

// Get all leave requests (with filters)
router.get(
  '/',
  validate(getLeaveRequestsQuerySchema, 'query'),
  leaveRequestController.getAllLeaveRequests
);

export default router;
