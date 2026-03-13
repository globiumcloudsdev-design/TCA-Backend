// backend/src/routes/v1/teacher.routes.js

import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import * as teacherController from '../../controllers/teacher.controller.js';
import { uploadMultiple } from '../../middlewares/upload.middleware.js';

const router = Router();

router.use(protect);

/**
 * GET teacher roles for dropdown
 * GET /api/v1/teachers/roles
 */
router.get(
  '/roles',
  hasPermission('teachers.read'),
  teacherController.getTeacherRoles
);

/**
 * CREATE - Teacher
 * POST /api/v1/teachers
 */
router.post(
  '/',
  hasPermission('teachers.create'),
  uploadMultiple('documents', 20),
  teacherController.createTeacher
);

/**
 * GET - All teachers
 * GET /api/v1/teachers
 */
router.get(
  '/',
  hasPermission('teachers.read'),
  teacherController.getAllTeachers
);

/**
 * GET - Teacher by ID
 * GET /api/v1/teachers/:id
 */
router.get(
  '/:id',
  hasPermission('teachers.read'),
  teacherController.getTeacherById
);

/**
 * UPDATE - Teacher
 * PUT /api/v1/teachers/:id
 */
router.put(
  '/:id',
  hasPermission('teachers.update'),
  uploadMultiple('documents', 20),
  teacherController.updateTeacher
);

/**
 * DELETE - Teacher
 * DELETE /api/v1/teachers/:id
 */
router.delete(
  '/:id',
  hasPermission('teachers.delete'),
  teacherController.deleteTeacher
);

/**
 * Regenerate QR Code
 * POST /api/v1/teachers/:id/regenerate-qr
 */
router.post(
  '/:id/regenerate-qr',
  hasPermission('teachers.update'),
  teacherController.regenerateQRCode
);

/**
 * Toggle teacher status
 * PATCH /api/v1/teachers/:id/toggle-status
 */
router.patch(
  '/:id/toggle-status',
  hasPermission('teachers.update'),
  teacherController.toggleTeacherStatus
);

export default router;