/**
 * The Clouds Academy - Attendance Routes
 */

import { Router } from 'express';
import {
  markAttendanceController,
  getClassAttendanceController,
  getStudentSummaryController,
} from '../../controllers/attendance.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import { schoolContext } from '../../middlewares/schoolContext.middleware.js';
import { requireActiveSubscription } from '../../middlewares/subscription.middleware.js';

const router = Router();

router.use(protect, schoolContext, requireActiveSubscription);

router.post('/mark', hasPermission('attendance.create'), markAttendanceController);
router.get('/class', hasPermission('attendance.read'), getClassAttendanceController);
router.get('/student/:studentId/summary', hasPermission('attendance.read'), getStudentSummaryController);

export default router;
