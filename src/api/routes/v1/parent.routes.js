import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import { auditLog } from '../../middlewares/audit.middleware.js';
import * as parentController from '../../controllers/parent.controller.js';

const router = Router();

router.use(protect, auditLog);

router.post('/find-students', hasPermission('parents.read'), parentController.findStudentsByParentInfo);

router.post('/', hasPermission('parents.create'), parentController.createParent);

router.get('/', hasPermission('parents.read'), parentController.getAllParents);

router.get('/:id', hasPermission('parents.read'), parentController.getParentById);

router.put('/:id', hasPermission('parents.update'), parentController.updateParent);

router.delete('/:id', hasPermission('parents.delete'), parentController.deleteParent);

export default router;
