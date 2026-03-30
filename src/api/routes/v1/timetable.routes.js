// backend/src/routes/v1/timetable.routes.js

/**
 * The Clouds Academy - Timetable Routes
 * 
 * Yeh route define karta hai ke kis endpoint par kaunsa controller call hoga
 */

import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import * as timetableController from '../../controllers/timetable.controller.js';

const router = Router();

// Har route ke liye authentication zaroori hai
router.use(protect);

/**
 * GET /api/v1/timetable/entities
 * ------------------------------
 * Yeh endpoint entities fetch karta hai dropdown ke liye:
 * - Academic Years
 * - Classes
 * - Sections (nested in classes)
 * - Teachers
 * - Subjects
 * - Courses, Batches (agar coaching ho)
 * - Departments, Programs, Semesters (agar college/university ho)
 */
router.get(
  '/entities',
  hasPermission('timetable.read'),
  timetableController.getEntities
);

/**
 * POST /api/v1/timetable/check-conflict
 * -------------------------------------
 * Teacher conflict check karta hai
 * Jab bhi koi slot add/edit ho to pehle yeh call karo
 */
router.post(
  '/check-conflict',
  hasPermission('timetable.read'),
  timetableController.checkTeacherConflict
);

/**
 * POST /api/v1/timetable
 * ----------------------
 * Naya timetable create karta hai
 * Body mein yeh fields chahiye:
 * - name: string
 * - academic_year_id: uuid
 * - entity_type: 'school' | 'coaching' | 'academy' | 'college' | 'university'
 * - entity_ids: { class_id, section_id, etc. }
 * - period_config: { total_periods, periods[], breaks[] }
 * - slots: [] (optional)
 */
router.post(
  '/',
  hasPermission('timetable.create'),
  timetableController.createTimetable
);

/**
 * GET /api/v1/timetable
 * ---------------------
 * Saare timetables fetch karta hai
 * Query params:
 * - academic_year_id
 * - entity_type
 * - class_id, section_id, course_id, etc.
 * - page, limit
 */
router.get(
  '/',
  hasPermission('timetable.read'),
  timetableController.getAllTimetables
);

/**
 * GET /api/v1/timetable/busy-teachers
 * ------------------------------------
 * Specific day aur period ke liye busy teachers fetch karta hai
 * Yeh route /:id se PEHLE hona chahiye
 */
router.get(
  '/busy-teachers',
  hasPermission('timetable.read'),
  timetableController.getBusyTeachers
);

/**
 * GET /api/v1/timetable/:id
 * -------------------------
 * Ek timetable ki details fetch karta hai
 */
router.get(
  '/:id',
  hasPermission('timetable.read'),
  timetableController.getTimetableById
);

/**
 * PUT /api/v1/timetable/:id
 * -------------------------
 * Timetable update karta hai
 * Body mein wohi fields jo change karni hain
 * Slots update karne ke liye poora slots array bhejna hoga
 */
router.put(
  '/:id',
  hasPermission('timetable.update'),
  timetableController.updateTimetable
);

/**
 * DELETE /api/v1/timetable/:id
 * ----------------------------
 * Timetable delete karta hai
 */
router.delete(
  '/:id',
  hasPermission('timetable.delete'),
  timetableController.deleteTimetable
);

/**
 * PATCH /api/v1/timetable/:id/toggle-status
 * -----------------------------------------
 * Timetable ko activate/deactivate karta hai
 * Body: { is_active: true/false }
 */
router.patch(
  '/:id/toggle-status',
  hasPermission('timetable.update'),
  timetableController.toggleTimetableStatus
);


export default router;