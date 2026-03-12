/**
 * The Clouds Academy - AcademicYear Routes
 * 
 * File: /src/routes/v1/academicYear.routes.js
 */

import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import * as academicYearController from '../../controllers/academicYear.controller.js';
import { createAcademicYearSchema, updateAcademicYearSchema } from '../../validators/academicYear.validator.js';

const router = Router();

router.use(protect);

router.get('/current', academicYearController.getCurrentAcademicYear);

router.route('/')
  .get(academicYearController.getAllAcademicYears)
  .post(validate(createAcademicYearSchema), academicYearController.createAcademicYear);

router.route('/:id')
  .get(academicYearController.getAcademicYearById)
  .put(validate(updateAcademicYearSchema), academicYearController.updateAcademicYear)
  .delete(academicYearController.deleteAcademicYear);

router.patch('/:id/set-current', academicYearController.setCurrentAcademicYear);

export default router;