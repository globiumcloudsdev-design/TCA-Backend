/**
 * The Clouds Academy - Class & Section Routes
 *
 * Base path: /api/v1/classes
 *
 * Sections are nested under classes:
 *   GET    /api/v1/classes/:classId/sections
 *   POST   /api/v1/classes/:classId/sections
 *   GET    /api/v1/classes/:classId/sections/:id
 *   PUT    /api/v1/classes/:classId/sections/:id
 *   DELETE /api/v1/classes/:classId/sections/:id
 */

import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { schoolContext } from '../../middlewares/schoolContext.middleware.js';
import { checkSubscription } from '../../middlewares/subscription.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import {
  createSection,
  getSections,
  getSection,
  updateSection,
  deleteSection,
} from '../../controllers/section.controller.js';
import {
  createSectionSchema,
  updateSectionSchema,
} from '../../validators/section.validator.js';

const router = Router({ mergeParams: true });

// All section routes require auth + school context + active subscription
router.use(protect, schoolContext, checkSubscription);

router
  .route('/')
  .get(hasPermission('section.read'), getSections)
  .post(hasPermission('section.create'), validate(createSectionSchema), createSection);

router
  .route('/:id')
  .get(hasPermission('section.read'), getSection)
  .put(hasPermission('section.update'), validate(updateSectionSchema), updateSection)
  .delete(hasPermission('section.delete'), deleteSection);

export default router;
