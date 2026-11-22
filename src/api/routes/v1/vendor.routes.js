// src/routes/v1/vendor.routes.js
import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import * as vendorController from '../../controllers/vendor.controller.js';
import {
  createVendorSchema,
  updateVendorSchema,
  assignStudentsSchema,
} from '../../validators/vendor.validator.js';

const router = Router();

router.use(protect);

// Options routes (for dropdown/creatable select)
router.get('/options', hasPermission('vendor.read'), vendorController.getVendorOptions);
router.get('/types', hasPermission('vendor.read'), vendorController.getVendorTypes);

router.route('/')
  .get(hasPermission('vendor.read'), vendorController.getAllVendors)
  .post(hasPermission('vendor.create'), validate(createVendorSchema), vendorController.createVendor);

router.route('/:id')
  .get(hasPermission('vendor.read'), vendorController.getVendorById)
  .put(hasPermission('vendor.update'), validate(updateVendorSchema), vendorController.updateVendor)
  .delete(hasPermission('vendor.delete'), vendorController.deleteVendor);

// Assign students to vendor
router.patch('/:id/assign-students', hasPermission('vendor.update'), validate(assignStudentsSchema), vendorController.assignStudentsToVendor);

export default router;