// /**
//  * The Clouds Academy - Dashboard Routes
//  */

// import { Router } from 'express';
// import { getDashboardStats } from '../../controllers/dashboard.controller.js';
// import { protect } from '../../middlewares/auth.middleware.js';
// import { schoolContext } from '../../middlewares/schoolContext.middleware.js';

// const router = Router();

// router.use(protect, schoolContext);

// router.get('/stats', getDashboardStats);

// export default router;




// backend/src/routes/v1/dashboard.routes.js

import { Router } from 'express';
import {
  protect,
  restrictTo,
  isMasterAdmin,
  isTeacher,
  isStudent,
  isParent,
  belongsToInstitute,
  optionalAuth
} from '../../middlewares/auth.middleware.js';
import * as masterDashboardController from '../../controllers/dashboard/masterDashboard.controller.js';
import * as teacherDashboardController from '../../controllers/dashboard/teacherDashboard.controller.js';
import * as studentDashboardController from '../../controllers/dashboard/studentDashboard.controller.js';
import * as parentDashboardController from '../../controllers/dashboard/parentDashboard.controller.js';
// import * as instituteDashboardController from '../../controllers/dashboard/instituteDashboard.controller.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC DASHBOARD (Optional Auth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/dashboard/public
 * Public dashboard with limited data (no auth required)
 */
router.get(
  '/public',
  optionalAuth,
  (req, res) => {
    res.json({
      success: true,
      data: {
        message: 'Welcome to The Clouds Academy API',
        version: '1.0.0',
        authenticated: !!req.user,
        user: req.user ? {
          name: `${req.user.first_name} ${req.user.last_name}`,
          type: req.user.user_type
        } : null
      }
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED DASHBOARDS (All require authentication)
// ─────────────────────────────────────────────────────────────────────────────

// Apply authentication to all following routes
router.use(protect);

/**
 * GET /api/v1/dashboard/master
 * Master Admin Dashboard
 * Access: MASTER_ADMIN only
 */
router.get(
  '/master',
  isMasterAdmin,
  masterDashboardController.getMasterDashboard
);

/**
 * GET /api/v1/dashboard/teacher
 * Teacher Dashboard
 * Access: TEACHER only
 */
router.get(
  '/teacher',
  isTeacher,
  belongsToInstitute,
  teacherDashboardController.getTeacherDashboard
);

/**
 * GET /api/v1/dashboard/student
 * Student Dashboard
 * Access: STUDENT only (or parent accessing child's data)
 */
router.get(
  '/student',
  restrictTo('STUDENT', 'PARENT'),
  belongsToInstitute,
  studentDashboardController.getStudentDashboard
);

/**
 * GET /api/v1/dashboard/student/:studentId
 * Specific Student Dashboard (for parents)
 * Access: PARENT accessing their child
 */
router.get(
  '/student/:studentId',
  isParent,
  belongsToInstitute,
  studentDashboardController.getStudentDashboardById
);

/**
 * GET /api/v1/dashboard/parent
 * Parent Dashboard
 * Access: PARENT only
 */
router.get(
  '/parent',
  isParent,
  belongsToInstitute,
  parentDashboardController.getParentDashboard
);

/**
 * GET /api/v1/dashboard/institute
 * Institute Admin Dashboard
 * Access: INSTITUTE_ADMIN only
 */
// router.get(
//   '/institute',
//   restrictTo('INSTITUTE_ADMIN', 'BRANCH_ADMIN'),
//   belongsToInstitute,
//   instituteDashboardController.getInstituteDashboard
// );

/**
 * GET /api/v1/dashboard/branch
 * Branch Admin Dashboard
 * Access: BRANCH_ADMIN only
 */
// router.get(
//   '/branch',
//   isBranchAdmin,
//   belongsToBranch,
//   instituteDashboardController.getBranchDashboard
// );

// ─────────────────────────────────────────────────────────────────────────────
// WIDGET ENDPOINTS (Specific data snippets)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/dashboard/widget/attendance
 * Attendance widget for current user
 */
// router.get(
//   '/widget/attendance',
//   restrictTo('STUDENT', 'PARENT', 'TEACHER'),
//   belongsToInstitute,
//   teacherDashboardController.getAttendanceWidget
// );

/**
 * GET /api/v1/dashboard/widget/fees
 * Fees widget for current user
 */
// router.get(
//   '/widget/fees',
//   restrictTo('STUDENT', 'PARENT'),
//   belongsToInstitute,
//   studentDashboardController.getFeeWidget
// );

/**
 * GET /api/v1/dashboard/widget/notices
 * Latest notices widget
 */
// router.get(
//   '/widget/notices',
//   belongsToInstitute,
//   studentDashboardController.getNoticeWidget
// );

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default router;