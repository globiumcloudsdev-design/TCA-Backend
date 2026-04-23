// src/routes/v1/vendor.routes.js
import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import * as vendorController from '../../controllers/vendor.controller.js';
import {
  createVendorSchema,
  updateVendorSchema,
  assignStudentsSchema,
} from '../../validators/vendor.validator.js';

const router = Router();

router.use(protect);

// Options routes (for dropdown/creatable select)
router.get('/options', vendorController.getVendorOptions);
router.get('/types', vendorController.getVendorTypes);

router.route('/')
  .get(vendorController.getAllVendors)
  .post(validate(createVendorSchema), vendorController.createVendor);

router.route('/:id')
  .get(vendorController.getVendorById)
  .put(validate(updateVendorSchema), vendorController.updateVendor)
  .delete(vendorController.deleteVendor);

// Assign students to vendor
router.patch('/:id/assign-students', validate(assignStudentsSchema), vendorController.assignStudentsToVendor);

export default router;