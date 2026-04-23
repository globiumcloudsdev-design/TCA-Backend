// backend/src/routes/v1/staffAttendance.routes.js
import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import * as staffAttendanceController from '../../controllers/staffAttendance.controller.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import { createAttendanceSchema, updateAttendanceSchema } from '../../validators/staffAttendance.validator.js';

const router = Router();

router.use(protect);

// Bulk upload (CSV)
router.post(
  '/bulk',
  hasPermission('staff_attendance.mark'),
  staffAttendanceController.uploadMiddleware,
  staffAttendanceController.bulkMarkAttendance
);

// Report
router.get('/report', hasPermission('staff_attendance.view'), staffAttendanceController.getAttendanceReport);

// CRUD
router
  .route('/')
  .get(hasPermission('staff_attendance.view'), staffAttendanceController.getAllAttendances)
  .post(hasPermission('staff_attendance.mark'), validate(createAttendanceSchema), staffAttendanceController.markAttendance);

router
  .route('/:id')
  .get(hasPermission('staff_attendance.view'), staffAttendanceController.getAttendanceById)
  .put(hasPermission('staff_attendance.mark'), validate(updateAttendanceSchema), staffAttendanceController.updateAttendance)
  .delete(hasPermission('staff_attendance.mark'), staffAttendanceController.deleteAttendance);

export default router;