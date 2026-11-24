/**
 * The Clouds Academy - Test Records Routes (admin)
 *
 * Base: /api/v1/test-records
 * Admins (institute / branch) and staff holding the permission. Teachers use the
 * portal routes (/portal/teacher/test-records), parents/students the portal read routes.
 *
 * Permissions: test_record.<read|create|update|delete|publish>; the matching exam.*
 * permission is accepted too so existing roles keep working.
 */
import { Router } from 'express';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import { schoolContext } from '../../middlewares/schoolContext.middleware.js';
import { hasAnyPermission } from '../../middlewares/permission.middleware.js';
import * as ctrl from '../../controllers/testRecord.controller.js';

const router = Router();

router.use(protect, schoolContext);
router.use(restrictTo('INSTITUTE_ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'CAMPUS_ADMIN', 'STAFF'));

const can = (action) => hasAnyPermission([`test_record.${action}`, `exam.${action === 'read' ? 'read' : action}`]);

router.get('/options', can('read'), ctrl.adminOptions); // before /:id

// Monthly sheet (must be before /:id)
router.get('/sheet', can('read'), ctrl.adminSheetGet);
router.put('/sheet/marks', can('update'), ctrl.adminSheetSaveMarks);
router.post('/sheet/publish', hasAnyPermission(['test_record.publish', 'exam.publish']), ctrl.adminSheetPublish);
router.get('/', can('read'), ctrl.adminList);
router.post('/', can('create'), ctrl.adminCreate);

router.get('/:id', can('read'), ctrl.adminGet);
router.put('/:id', can('update'), ctrl.adminUpdate);
router.delete('/:id', can('delete'), ctrl.adminRemove);

router.put('/:id/marks', can('update'), ctrl.adminSaveMarks);
router.post('/:id/publish', hasAnyPermission(['test_record.publish', 'exam.publish']), ctrl.adminPublish);
router.post('/:id/unpublish', hasAnyPermission(['test_record.publish', 'exam.publish']), ctrl.adminUnpublish);

export default router;
