/**
 * The Clouds Academy — Staff Routes
 * 
 * All routes require authentication plus a role/permission guard
 * (institute/branch admins pass; others need the staff.* permission)
 * Base path: /api/staff
 */

import express from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission, checkPermission } from '../../middlewares/permission.middleware.js';
import catchAsync from '../../../utils/lib/catchAsync.js';
import { AppError } from '../../../utils/lib/AppError.js';
import { setInstitute } from '../../middlewares/institute.middleware.js';
import * as staffController from '../../controllers/staff.controller.js';
import upload from '../../middlewares/upload.middleware.js';

const router = express.Router();

// All staff routes require authentication and institute context
router.use(protect);
router.use(setInstitute);

// Staff management routes
router.get('/available-roles', hasPermission('staff.read'), staffController.getAvailableRoles);
router.get('/', hasPermission('staff.read'), staffController.getAllStaff);
router.get('/search', hasPermission('staff.read'), staffController.searchStaff);
router.get('/:id', hasPermission('staff.read'), staffController.getStaffById);

/**
 * A non-admin with staff.create/update may only grant permissions they hold
 * themselves, and never 'ALL' (prevents privilege escalation via staff creation).
 */
const ADMIN_TYPES = ['MASTER_ADMIN', 'INSTITUTE_ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'CAMPUS_ADMIN'];
const guardPermissionGrant = catchAsync(async (req, res, next) => {
  if (ADMIN_TYPES.includes(String(req.user?.user_type || '').toUpperCase())) return next();
  let perms = req.body?.permissions;
  if (typeof perms === 'string') { try { perms = JSON.parse(perms); } catch { perms = []; } }
  if (!Array.isArray(perms) || perms.length === 0) return next();
  for (const p of perms) {
    if (p === 'ALL' || p === '*' || !(await checkPermission(req, p))) {
      throw new AppError(`You cannot grant a permission you do not hold: ${p}`, 403);
    }
  }
  next();
});

// File upload handling for multiple files
const cpUpload = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'documents', maxCount: 10 }
]);

router.post('/', hasPermission('staff.create'), cpUpload, guardPermissionGrant, staffController.createStaff);
router.put('/:id', hasPermission('staff.update'), cpUpload, guardPermissionGrant, staffController.updateStaff);
router.delete('/:id', hasPermission('staff.delete'), staffController.deleteStaff);
router.patch('/:id/status', hasPermission('staff.update'), staffController.toggleStaffStatus);
router.patch('/:id/permissions', hasPermission('staff.update'), guardPermissionGrant, staffController.updateStaffPermissions);
router.post('/:id/regenerate-qr', hasPermission('staff.update'), staffController.regenerateQRCode);

export default router;