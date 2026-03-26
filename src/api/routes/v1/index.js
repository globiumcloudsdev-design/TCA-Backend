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
import attendanceRoutes from './attendance.routes.js';
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

const router = Router();

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

// V1 health
router.get('/ping', (req, res) => res.json({ ok: true, version: 'v1' }));

export default router;
