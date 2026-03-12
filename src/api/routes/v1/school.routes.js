/**
 * The Clouds Academy - School Routes
 *
 * Base path: /api/v1/schools
 *
 * These routes are for school-level profile management.
 * School CRUD for Master Admin is in a separate admin router.
 */

import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { schoolContext } from '../../middlewares/schoolContext.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import {
  getSchoolProfile,
  assignRoleToSchool,
  removeRoleFromSchool,
  updateSchoolSettings,
} from '../../controllers/school.controller.js';

const router = Router();

router.use(protect, schoolContext);

// School profile — every authenticated school user can read
router.get('/profile', getSchoolProfile);

// Role assignment — admin-only
router.patch(
  '/assign-role',
  hasPermission('school.assign_role'),
  assignRoleToSchool
);

router.delete(
  '/assign-role',
  hasPermission('school.assign_role'),
  removeRoleFromSchool
);

// Update settings (has_branches toggle, name, etc.)
router.patch(
  '/settings',
  hasPermission('school.update'),
  updateSchoolSettings
);

export default router;
