// backend/src/routes/v1/portal/parent.portal.routes.js

/**
 * The Clouds Academy - Parent Portal Routes
 */

import { Router } from 'express';
import { protect, isParent } from '../../../middlewares/auth.middleware.js';
import { uploadSingle } from '../../../middlewares/upload.middleware.js';
import { validate } from '../../../middlewares/validation.middleware.js';
import * as parentPortal from '../../../controllers/portal/parentPortal.controller.js';
import * as leaveRequestsPortal from '../../../controllers/portal/leaveRequests.portal.controller.js';
import { createLeaveRequestSchema, getMyLeaveRequestsQuerySchema, cancelLeaveRequestSchema } from '../../../validators/leaveRequest.validator.js';
import * as eventController from '../../../controllers/event.controller.js';

const router = Router();

// All routes require authentication and parent role
router.use(protect);
router.use(isParent);

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', parentPortal.getDashboard);

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', parentPortal.getProfile);
router.put('/profile', uploadSingle('avatar'), parentPortal.updateProfile);
router.put('/children/:childId', uploadSingle('avatar'), parentPortal.updateChildProfile);
// ─────────────────────────────────────────────────────────────────────────────
// CHILDREN
// ─────────────────────────────────────────────────────────────────────────────
router.get('/children', parentPortal.getMyChildren);
router.get('/children/:childId', parentPortal.getChildDetails);

// ─────────────────────────────────────────────────────────────────────────────
// CHILD ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────
// router.get('/children/:childId/attendance', parentPortal.getChildAttendance);
// backend/src/routes/v1/portal/parent.portal.routes.js
// Add this route:

// CHILD ATTENDANCE (updated)
router.get('/children/:childId/attendance', parentPortal.getChildAttendance);
router.get('/children/:childId/attendance/months', parentPortal.getAttendanceMonths);

// ─────────────────────────────────────────────────────────────────────────────
// CHILD RESULTS
// ─────────────────────────────────────────────────────────────────────────────
// router.get('/children/:childId/results', parentPortal.getChildResults);
router.get('/children/:childId/results', parentPortal.getChildResults);
router.get('/children/:childId/results/statistics', parentPortal.getResultStatistics);
router.get('/results/:resultId', parentPortal.getExamResultDetails);

// ─────────────────────────────────────────────────────────────────────────────
// CHILD FEES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/children/:childId/fees', parentPortal.getChildFees);
router.get('/fees/summary', parentPortal.getFeeSummary);
router.get('/fees/voucher/:voucherId', parentPortal.getVoucherDetails);
router.post('/fees/pay/:voucherId', parentPortal.payChildFee);
router.get('/payments/history', parentPortal.getPaymentHistory);
// ─────────────────────────────────────────────────────────────────────────────
// CHILD ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/children/:childId/assignments', parentPortal.getChildAssignments);

// ─────────────────────────────────────────────────────────────────────────────
// CHILD TIMETABLE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/children/:childId/timetable', parentPortal.getChildTimetable);

// ─────────────────────────────────────────────────────────────────────────────
// TEACHERS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/teachers', parentPortal.getChildrenTeachers);

// ─────────────────────────────────────────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/notices', parentPortal.getNotices);
router.get('/children/:childId/notices', parentPortal.getNoticesForChild);

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE REQUESTS (Parent - if also staff)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/leave-requests/statistics', leaveRequestsPortal.getMyLeaveStatistics);
router.get('/leave-balance', leaveRequestsPortal.getLeaveBalance);
router.get('/leave-requests', validate(getMyLeaveRequestsQuerySchema, 'query'), leaveRequestsPortal.getMyLeaveRequests);
router.post('/leave-requests', validate(createLeaveRequestSchema), leaveRequestsPortal.createLeaveRequest);
router.patch('/leave-requests/:id/cancel', validate(cancelLeaveRequestSchema), leaveRequestsPortal.cancelLeaveRequest);

// EVENTS
router.get('/events', eventController.getMyEvents);

export default router;
