import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import { auditLog } from '../../middlewares/audit.middleware.js';
import { uploadFields } from '../../middlewares/upload.middleware.js';
import * as studentController from '../../controllers/student.controller.js';

const router = Router();

// All routes require authentication
router.use(protect, auditLog);

/**
 * CREATE - Student
 * POST /api/v1/students
 */
router.post(
  '/',
  hasPermission('students.create'),
  uploadFields([
    { name: 'photo', maxCount: 1 },
    { name: 'documents', maxCount: 10 }
  ]),
  studentController.createStudent
);

/**
 * GET - All students
 * GET /api/v1/students
 */
router.get(
  '/',
  hasPermission('students.read'),
  studentController.getAllStudents
);

/**
 * GET - Search students (for promotion/search page)
 * Query: ?q=Hassan&limit=20
 */
router.get(
  '/search',
  hasPermission('students.read'),
  studentController.searchStudents
);

// Sirf ek route - simple!
router.post('/bulk-import', hasPermission('students.create'), studentController.bulkImportStudents);

/**
 * GET - Student by ID
 * GET /api/v1/students/:id
 */
router.get(
  '/:id',
  hasPermission('students.read'),
  studentController.getStudentById
);

/**
 * UPDATE - Student
 * PUT /api/v1/students/:id
 */
router.put(
  '/:id',
  hasPermission('students.update'),
  uploadFields([
    { name: 'photo', maxCount: 1 },
    { name: 'documents', maxCount: 10 }
  ]),
  studentController.updateStudent
);

/**
 * DELETE - Student
 * DELETE /api/v1/students/:id
 */
router.delete(
  '/:id',
  hasPermission('students.delete'),
  studentController.deleteStudent
);

router.post('/bulk-delete', hasPermission('students.delete'), studentController.bulkDeleteStudents);

// ==================== PROMOTION ROUTES ====================

/**
 * GET - Check promotion eligibility for a single student
 */
router.get(
  '/:id/promotion-eligibility',
  hasPermission('students.read'),
  studentController.getSingleStudentEligibility
);

/**
 * GET - Get promotion eligibility for all students in a class
 */
router.get(
  '/classes/:classId/promotion-eligibility',
  hasPermission('students.read'),
  studentController.getPromotionEligibilityByClass
);

/**
 * POST - Promote a single student
 */
router.post(
  '/:id/promote',
  hasPermission('students.update'),
  studentController.promoteSingleStudent
);

/**
 * POST - Bulk promote students by current class
 */
router.post(
  '/bulk-promote',
  hasPermission('students.update'),
  studentController.bulkPromoteStudents
);

// ==================== ALUMNI & BEHAVIOR ====================

/**
 * PATCH - Mark a student as Alumni
 */
router.patch(
  '/:id/alumni',
  hasPermission('students.update'),
  studentController.markAsAlumni
);

/**
 * POST - Add a behavioral/discipline record
 */
router.post(
  '/:id/behavior',
  hasPermission('students.update'),
  studentController.addBehaviorRecord
);

/**
 * PATCH - Restore a student from Alumni
 */
router.patch(
  '/:id/restore-alumni',
  hasPermission('students.update'),
  studentController.restoreAlumni
);

export default router;
