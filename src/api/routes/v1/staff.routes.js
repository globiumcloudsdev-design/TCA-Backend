/**
 * The Clouds Academy — Staff Routes
 * 
 * All routes require authentication plus a role/permission guard
 * (institute/branch admins pass; others need the staff.* permission)
 * Base path: /api/staff
 */

import express from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
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

// File upload handling for multiple files
const cpUpload = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'documents', maxCount: 10 }
]);

router.post('/', hasPermission('staff.create'), cpUpload, staffController.createStaff);
router.put('/:id', hasPermission('staff.update'), cpUpload, staffController.updateStaff);
router.delete('/:id', hasPermission('staff.delete'), staffController.deleteStaff);
router.patch('/:id/status', hasPermission('staff.update'), staffController.toggleStaffStatus);
router.patch('/:id/permissions', hasPermission('staff.update'), staffController.updateStaffPermissions);
router.post('/:id/regenerate-qr', hasPermission('staff.update'), staffController.regenerateQRCode);

export default router;