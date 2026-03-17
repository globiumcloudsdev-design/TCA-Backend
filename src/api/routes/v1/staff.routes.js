/**
 * The Clouds Academy — Staff Routes
 * 
 * All routes are protected but NO role restrictions
 * Frontend handles permissions via canDo()
 * Base path: /api/staff
 */

import express from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { setInstitute } from '../../middlewares/institute.middleware.js';
import * as staffController from '../../controllers/staff.controller.js';
import upload from '../../middlewares/upload.middleware.js';

const router = express.Router();

// All staff routes require authentication and institute context
router.use(protect);
router.use(setInstitute);

// Staff management routes
router.get('/available-roles', staffController.getAvailableRoles);
router.get('/', staffController.getAllStaff);
router.get('/:id', staffController.getStaffById);

// File upload handling for multiple files
const cpUpload = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'documents', maxCount: 10 }
]);

router.post('/', cpUpload, staffController.createStaff);
router.put('/:id', cpUpload, staffController.updateStaff);
router.delete('/:id', staffController.deleteStaff);
router.patch('/:id/status', staffController.toggleStaffStatus);
router.patch('/:id/permissions', staffController.updateStaffPermissions);
router.post('/:id/regenerate-qr', staffController.regenerateQRCode);

export default router;