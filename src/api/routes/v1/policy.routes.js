// src/api/routes/v1/policy.routes.js
import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import * as policyController from '../../controllers/policy.controller.js';
import {
  createPolicySchema,
  updatePolicySchema,
  togglePolicyStatusSchema
} from '../../validators/policy.validator.js';

const router = Router();

// All routes require authentication
router.use(protect);

// Options route (must be before /:id routes)
router.get('/options', policyController.getPolicyOptions);

// Active policy by type
router.get('/active/:type', policyController.getActivePolicyByType);

// Policies by type
router.get('/type/:type', policyController.getPoliciesByType);

// CRUD routes
router.route('/')
  .get(policyController.getAllPolicies)
  .post(hasPermission('policy.create'), validate(createPolicySchema), policyController.createPolicy);

router.route('/:id')
  .get(policyController.getPolicyById)
  .put(hasPermission('policy.update'), validate(updatePolicySchema), policyController.updatePolicy)
  .delete(hasPermission('policy.delete'), policyController.deletePolicy);

// Toggle status
router.patch('/:id/toggle-status', hasPermission('policy.update'), validate(togglePolicyStatusSchema), policyController.togglePolicyStatus);

export default router;