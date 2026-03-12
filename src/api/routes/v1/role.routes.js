/**
 * The Clouds Academy - Role Routes (Dynamic Role System)
 */

import { Router } from 'express';
import {
  createRoleController,
  getRolesController,
  getRoleByIdController,
  updateRoleController,
  deleteRoleController,
  assignRoleController,
  getAllPermissionsController,
} from '../../controllers/role.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import { schoolContext } from '../../middlewares/schoolContext.middleware.js';

const router = Router();

router.use(protect, schoolContext);

// All permissions list (for Role creation UI)
router.get('/permissions', getAllPermissionsController);

// Role CRUD
router
  .route('/')
  .get(hasPermission('role.read'), getRolesController)
  .post(hasPermission('role.create'), createRoleController);

router
  .route('/:id')
  .get(hasPermission('role.read'), getRoleByIdController)
  .put(hasPermission('role.update'), updateRoleController)
  .delete(hasPermission('role.delete'), deleteRoleController);

// Assign role to user
router.post('/assign', hasPermission('role.assign'), assignRoleController);

export default router;
