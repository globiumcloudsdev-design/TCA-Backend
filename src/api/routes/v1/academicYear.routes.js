/**
 * The Clouds Academy - AcademicYear Routes
 * 
 * File: /src/routes/v1/academicYear.routes.js
 */

import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import * as academicYearController from '../../controllers/academicYear.controller.js';
import { createAcademicYearSchema, updateAcademicYearSchema } from '../../validators/academicYear.validator.js';

const router = Router();

router.use(protect);

router.get('/current', academicYearController.getCurrentAcademicYear);

// ✅ OPTIONS ENDPOINT - Frontend dropdown ke liye
router.get('/options', academicYearController.getAcademicYearOptions);

router.route('/')
  .get(academicYearController.getAllAcademicYears)
  .post(hasPermission('academic_year.create'), validate(createAcademicYearSchema), academicYearController.createAcademicYear);

router.route('/:id')
  .get(academicYearController.getAcademicYearById)
  .put(hasPermission('academic_year.update'), validate(updateAcademicYearSchema), academicYearController.updateAcademicYear)
  .delete(hasPermission('academic_year.delete'), academicYearController.deleteAcademicYear);

router.patch('/:id/set-current', hasPermission('academic_year.update'), academicYearController.setCurrentAcademicYear);

export default router;