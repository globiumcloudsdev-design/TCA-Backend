/**
 * The Clouds Academy - V1 Routes Aggregator
 * All v1 routes registered here
 */

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import roleRoutes from './role.routes.js';
import schoolRoutes from './school.routes.js';
import academicYearRoutes from './academicYear.routes.js';
import classRoutes from './class.routes.js';   // includes nested /sections
import studentRoutes from './student.routes.js';
import feeRoutes from './fee.routes.js';
import attendanceRoutes from './studentAttendance.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import subscriptionPlanRoutes from './subscriptionPlan.routes.js';
import masterAdminRoutes from './masterAdmin.routes.js';
import teacherRoutes from './teacher.routes.js'; // ✅ Import teacher routes
import timetableRoutes from './timetable.routes.js'; // ✅ Yahan import karo
import feeTemplateRoutes from './feeTemplate.routes.js'; // ✅ Yahan import karo
import staffRoutes from './staff.routes.js'; // ✅ Yahan import karo
import branchRoutes from './branch.routes.js'
import parentRoutes from './parent.routes.js';
import portalRoutes from './portal/index.js'; // ✅ Portal routes aggregator
import ExamRoutes from './exam.routes.js'; // ✅ Import exam routes
import reportRoutes from './report.routes.js'; // ✅ Import report routes
import expenseRoutes from './expense.routes.js'; // ✅ Import expense routes
import vendorRoutes from './vendor.routes.js'; // ✅ Import vendor routes
import policyRoutes from './policy.routes.js'; // ✅ Import policy routes
import staffAttendanceRoutes from './staffAttendance.routes.js'; // ✅ Import staff attendance routes
import leaveRequestRoutes from './leaveRequest.routes.js'; // ✅ Import leave request routes
import leaveTypeRoutes from './leaveType.routes.js'; // ✅ Import leave type routes
import settingRoutes from './setting.routes.js'; // ✅ Import setting routes
import feeVoucherRoutes from './feeVoucher.routes.js'; // ✅ Import fee voucher routes
import notificationRoutes from './notification.routes.js'; // ✅ Import notification routes
import userRoutes from './user.routes.js'; // ✅ Import user routes
import payrollRoutes from './payroll.routes.js'; // ✅ Import payroll routes
import eventRoutes from './event.routes.js'; // ✅ Import event routes
import publicRoutes from './public.routes.js'; // ✅ Import public routes
import supportRoutes from './support.routes.js'; // ✅ Import support routes

import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { branchIsolation } from '../../middlewares/branchContext.middleware.js';
import { maintenanceGuard } from '../../middlewares/maintenance.middleware.js';

const router = Router();

// ── Public Routes (Landing Page, etc.) ───────────────────────────────────
router.use('/public', publicRoutes);

// ── Authentication & Maintenance Guard ──────────────────────────────────
// optionalAuth extracts user from token but doesn't block if missing.
// This allows maintenanceGuard to bypass Master Admins correctly.
router.use(optionalAuth);
router.use(branchIsolation);
router.use(maintenanceGuard);

// ── Core Auth ──────────────────────────────────────────────────────────────
router.use('/auth', authRoutes);

// ── Institute (profile + role assignment + settings) ─────────────────────
router.use('/institutes', schoolRoutes); // primary
router.use('/schools', schoolRoutes);    // legacy alias

// ── Academic Year CRUD ─────────────────────────────────────────────────────
router.use('/academic-years', academicYearRoutes);

// ── Classes + nested Sections ──────────────────────────────────────────────
// /api/v1/classes
// /api/v1/classes/:classId/sections
router.use('/classes', classRoutes);

// ── Role Management ────────────────────────────────────────────────────────
router.use('/roles', roleRoutes);

// ── Students ───────────────────────────────────────────────────────────────
router.use('/students', studentRoutes);

// ── Parents ────────────────────────────────────────────────────────────────
router.use('/parents', parentRoutes);

// ── Teachers ───────────────────────────────────────────────────────────────
router.use('/teachers', teacherRoutes); // ✅ Mount teacher routes

// ── Timetable ───────────────────────────────────────────────────────────────
router.use('/timetable', timetableRoutes); // ✅ Yahan use karo

// ── Staff Management ───────────────────────────────────────────────────────
router.use('/staff', staffRoutes);

// ── Branch Management ──────────────────────────────────────────────────────
router.use('/branches', branchRoutes); // ✅ Yahan use karo

// ── Fee Management ───────────────────────────────────────────────────────
router.use('/fee-templates', feeTemplateRoutes); // legacy alias, remove later

// ── Fee Management ─────────────────────────────────────────────────────────
router.use('/fees', feeRoutes);

// ── Fee Voucher Management ─────────────────────────────────────────────────────────
router.use('/fee-vouchers', feeVoucherRoutes); // ✅ Mount fee voucher routes

// ── Attendance ─────────────────────────────────────────────────────────────
router.use('/attendance', attendanceRoutes);

// ── Dashboard ──────────────────────────────────────────────────────────────
router.use('/dashboard', dashboardRoutes);

// ── Subscription Plans (Master Admin manages platform plans) ───────────────
router.use('/subscription-plans', subscriptionPlanRoutes);

// ── Master Admin (institutes CRUD + lookups) ───────────────────────────────
router.use('/master-admin', masterAdminRoutes);

// ── Portal Routes / Teacher, Student, Parent ──────────────────────────────────────────────────────────────
router.use('/portal', portalRoutes);

// ── Exam Routes ─────────────────────────────────────────────────────────────
router.use('/exams', ExamRoutes); // ✅ Mount exam routes

// ── Report Routes ─────────────────────────────────────────────────────────
router.use('/reports', reportRoutes); // ✅ Mount report routes

// ── Expense Routes ─────────────────────────────────────────────────────────
router.use('/expenses', expenseRoutes); // ✅ Mount expense routes

// ── Vendor Routes ─────────────────────────────────────────────────────────
router.use('/vendors', vendorRoutes); // ✅ Mount vendor routes

// ── Policy Routes ─────────────────────────────────────────────────────────
router.use('/policies', policyRoutes); // ✅ Mount policy routes

// ── Staff Attendance Routes ─────────────────────────────────────────────────────────
router.use('/staff-attendance', staffAttendanceRoutes); // ✅ Mount staff attendance routes

// ── Leave Request Routes ─────────────────────────────────────────────────────────
router.use('/leave-requests', leaveRequestRoutes); // ✅ Mount leave request routes

// ── Leave Type Routes ─────────────────────────────────────────────────────────
router.use('/leave-types', leaveTypeRoutes); // ✅ Mount leave type routes

// ── Institute Settings Routes ─────────────────────────────────────────────────────────
router.use('/settings', settingRoutes); // ✅ Mount institute settings routes

// ── Notification Routes ─────────────────────────────────────────────────────────
router.use('/notifications', notificationRoutes); // ✅ Mount notification routes

// ── User Routes (for admin management of users) ─────────────────────────────────────────────────────────
router.use('/users', userRoutes); // ✅ Mount user routes

// ── Support Tickets (Institute) ─────────────────────────────────────────────────────────
router.use('/support', supportRoutes); // ✅ Mount support routes

// ── Payroll Routes ─────────────────────────────────────────────────────────
router.use('/payroll', payrollRoutes); // ✅ Mount payroll routes

// ── Event Routes ─────────────────────────────────────────────────────────
router.use('/events', eventRoutes); // ✅ Mount event routes

// V1 health
router.get('/ping', (req, res) => res.json({ ok: true, version: 'v1' }));

export default router;
