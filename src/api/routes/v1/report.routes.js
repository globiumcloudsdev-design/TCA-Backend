/**
 * The Clouds Academy - Report Routes
 * 
 * Routes for generating and exporting various reports
 */

import { Router } from 'express';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import * as reportController from '../../controllers/report.controller.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// ALL ROUTES REQUIRE AUTHENTICATION
// ─────────────────────────────────────────────────────────────────────────────
router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// REPORT OPTIONS & TEMPLATES (No specific permission, just authenticated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/templates
 * Get available report templates
 */
router.get(
  '/templates',
  reportController.getReportTemplates
);

/**
 * GET /api/v1/reports/options
 * Get filter options (classes, academic years, etc.)
 */
router.get(
  '/options',
  reportController.getReportOptions
);

/**
 * GET /api/v1/reports/permissions
 * Get available reports based on user permissions
 */
router.get(
  '/permissions',
  reportController.getUserReportPermissions
);

// ─────────────────────────────────────────────────────────────────────────────
// INDIVIDUAL REPORT GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/student
 * Generate student report
 * Permissions: reports.student, reports.read
 * Access: INSTITUTE_ADMIN, BRANCH_ADMIN, TEACHER
 */
router.get(
  '/student',
  hasPermission('reports.student'),
  reportController.getStudentReport
);

/**
 * GET /api/v1/reports/attendance
 * Generate attendance report
 * Permissions: reports.attendance, reports.read
 */
router.get(
  '/attendance',
  hasPermission('reports.attendance'),
  reportController.getAttendanceReport
);

/**
 * GET /api/v1/reports/fee
 * Generate fee collection report
 * Permissions: reports.fee, reports.read
 */
router.get(
  '/fee',
  // hasPermission('reports.fee'),
  reportController.getFeeReport
);

/**
 * GET /api/v1/reports/exam
 * Generate exam results report
 * Permissions: reports.exam, reports.read
 */
router.get(
  '/exam',
  hasPermission('reports.exam'),
  reportController.getExamReport
);

/**
 * GET /api/v1/reports/payroll
 * Generate payroll report
 * Permissions: reports.payroll, reports.read
 * Access: MASTER_ADMIN, INSTITUTE_ADMIN
 */
router.get(
  '/payroll',
  hasPermission('reports.payroll'),
  reportController.getPayrollReport
);

/**
 * GET /api/v1/reports/analytics
 * Generate analytics dashboard report
 * Permissions: reports.analytics, reports.read
 */
router.get(
  '/analytics',
  hasPermission('reports.analytics'),
  reportController.getAnalyticsReport
);

/**
 * GET /api/v1/reports/profit-loss
 * Generate profit and loss report (Income, Expenses, Payroll)
 */
router.get(
  '/profit-loss',
  // hasPermission('reports.profit_loss'),
  reportController.getProfitLossReport
);

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT FUNCTIONALITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/reports/export
 * Export any report as PDF or Excel
 * 
 * Body:
 * {
 *   "report_type": "student|attendance|fee|exam|payroll",
 *   "format": "pdf|excel",
 *   "filters": { ... }
 * }
 */
router.post(
  '/export',
  hasPermission('reports.export'),
  reportController.exportReport
);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM REPORTS (Save & Reuse)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/custom
 * Get saved custom reports
 */
router.get(
  '/custom',
  hasPermission('reports.read'),
  reportController.getCustomReports
);

/**
 * POST /api/v1/reports/custom
 * Save a custom report template
 * 
 * Body:
 * {
 *   "name": "string",
 *   "description": "string",
 *   "report_type": "student|attendance|fee|exam",
 *   "filters": { ... }
 * }
 */
router.post(
  '/custom',
  hasPermission('reports.create'),
  reportController.createCustomReport
);

export default router;
