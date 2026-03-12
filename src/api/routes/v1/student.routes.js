/**
 * The Clouds Academy - Student Routes
 */

import { Router } from 'express';
import {
  createStudentController,
  getStudentsController,
  getStudentController,
  updateStudentController,
  deleteStudentController,
} from '../../controllers/student.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import { schoolContext } from '../../middlewares/schoolContext.middleware.js';
import { requireActiveSubscription } from '../../middlewares/subscription.middleware.js';
import { uploadSingle } from '../../middlewares/upload.middleware.js';
import { auditLog } from '../../middlewares/audit.middleware.js';

const router = Router();

router.use(protect, schoolContext, requireActiveSubscription, auditLog);

router
  .route('/')
  .get(hasPermission('student.read'), getStudentsController)
  .post(hasPermission('student.create'), uploadSingle('photo'), createStudentController);

router
  .route('/:id')
  .get(hasPermission('student.read'), getStudentController)
  .put(hasPermission('student.update'), uploadSingle('photo'), updateStudentController)
  .delete(hasPermission('student.delete'), deleteStudentController);

export default router;
