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

export default router;
