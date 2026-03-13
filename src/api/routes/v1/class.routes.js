// src/routes/v1/class.routes.js

import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import * as classController from '../../controllers/classes.controllers.js';
import { uploadMultiple } from '../../middlewares/upload.middleware.js';

const router = Router();

router.use(protect);

/**
 * CREATE - Class with sections, courses, materials
 * POST /api/v1/classes
 * 
 * FormData fields:
 * - name: string
 * - description: string (optional)
 * - academic_year_id: string
 * - active: 'true'|'false'
 * - sections: JSON string array
 * - courses: JSON string array
 * - materials: files (multiple) with naming convention: course_{index}_material_{index}_filename.pdf
 */
router.post(
  '/',
  hasPermission('classes.create'),
  uploadMultiple('syllabas', 50), // Max 50 files
  classController.createClass
);
  
/**
 * GET - All classes
 * GET /api/v1/classes
 */
router.get(
  '/',
  hasPermission('classes.read'),
  classController.getAllClasses
);

/**
 * GET - Class options for dropdown
 * GET /api/v1/classes/options
 */
router.get(
  '/options',
  hasPermission('classes.read'),
  classController.getClassOptions
);

/**
 * GET - Class by ID
 * GET /api/v1/classes/:id
 */
router.get(
  '/:id',
  hasPermission('classes.read'),
  classController.getClassById
);

/**
 * UPDATE - Class
 * PUT /api/v1/classes/:id
 */
router.put(
  '/:id',
  hasPermission('classes.update'),
  uploadMultiple('syllabas', 50),
  classController.updateClass
);

/**
 * DELETE - Class
 * DELETE /api/v1/classes/:id
 */
router.delete(
  '/:id',
  hasPermission('classes.delete'),
  classController.deleteClass
);

/**
 * TOGGLE STATUS
 * PATCH /api/v1/classes/:id/toggle-status
 */
router.patch(
  '/:id/toggle-status',
  hasPermission('classes.update'),
  classController.toggleStatus
);

export default router;