// backend/src/routes/v1/portal/parent.portal.routes.js

/**
 * The Clouds Academy - Parent Portal Routes
 */

import { Router } from 'express';
import { protect, isParent } from '../../../middlewares/auth.middleware.js';
import { uploadSingle } from '../../../middlewares/upload.middleware.js';
import * as parentPortal from '../../../controllers/portal/parentPortal.controller.js';

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

// ─────────────────────────────────────────────────────────────────────────────
// CHILDREN
// ─────────────────────────────────────────────────────────────────────────────
router.get('/children', parentPortal.getMyChildren);
router.get('/children/:childId', parentPortal.getChildDetails);

// ─────────────────────────────────────────────────────────────────────────────
// CHILD ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/children/:childId/attendance', parentPortal.getChildAttendance);

// ─────────────────────────────────────────────────────────────────────────────
// CHILD RESULTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/children/:childId/results', parentPortal.getChildResults);

// ─────────────────────────────────────────────────────────────────────────────
// CHILD FEES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/children/:childId/fees', parentPortal.getChildFees);
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

export default router;