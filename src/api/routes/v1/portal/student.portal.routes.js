// backend/src/routes/v1/portal/student.portal.routes.js

/**
 * The Clouds Academy - Student Portal Routes
 */

import { Router } from 'express';
import { protect, isStudent } from '../../../middlewares/auth.middleware.js';
import { uploadMultiple, uploadSingle } from '../../../middlewares/upload.middleware.js';
import { validate } from '../../../middlewares/validation.middleware.js';
import * as studentPortal from '../../../controllers/portal/studentPortal.controller.js';
import * as leaveRequestsPortal from '../../../controllers/portal/leaveRequests.portal.controller.js';
import { createLeaveRequestSchema, cancelLeaveRequestSchema, getMyLeaveRequestsQuerySchema } from '../../../validators/leaveRequest.validator.js';
// EVENTS
import * as eventController from '../../../controllers/event.controller.js';

const router = Router();

// All routes require authentication and student role
router.use(protect);
router.use(isStudent);

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', studentPortal.getDashboard);

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', studentPortal.getProfile);
router.put('/profile', uploadSingle('avatar'), studentPortal.updateProfile);

// ─────────────────────────────────────────────────────────────────────────────
// CLASSES & TIMETABLE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/classes', studentPortal.getMyClasses);
router.get('/timetable', studentPortal.getMyTimetable);
router.get('/today-classes', studentPortal.getTodayClasses);

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/attendance', studentPortal.getMyAttendance);

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/assignments', studentPortal.getMyAssignments);
router.get('/assignments/upcoming', studentPortal.getUpcomingAssignments);
router.post('/assignments/:assignmentId/submit', uploadMultiple('files', 5), studentPortal.submitAssignment);

// ─────────────────────────────────────────────────────────────────────────────
// EXAMS & RESULTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/exams/schedule', studentPortal.getMyExamSchedule);
router.get('/results', studentPortal.getMyResults);
router.get('/results/recent', studentPortal.getRecentResults);

// ─────────────────────────────────────────────────────────────────────────────
// FEES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/fees', studentPortal.getMyFees);
router.get('/fees/summary', studentPortal.getFeeSummary);

// ─────────────────────────────────────────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/notices', studentPortal.getNotices);
router.get('/notices/recent', studentPortal.getRecentNotices);

// ─────────────────────────────────────────────────────────────────────────────
// LIBRARY
// ─────────────────────────────────────────────────────────────────────────────
router.get('/library', studentPortal.getLibraryData);

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE REQUESTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/leave-requests/statistics', leaveRequestsPortal.getMyLeaveStatistics);
router.get('/leave-balance', leaveRequestsPortal.getLeaveBalance);
router.get('/leave-requests', validate(getMyLeaveRequestsQuerySchema, 'query'), leaveRequestsPortal.getMyLeaveRequests);
router.post('/leave-requests', validate(createLeaveRequestSchema), leaveRequestsPortal.createLeaveRequest);
router.patch('/leave-requests/:id/cancel', validate(cancelLeaveRequestSchema), leaveRequestsPortal.cancelLeaveRequest);


router.get('/events', eventController.getMyEvents);

export default router;
