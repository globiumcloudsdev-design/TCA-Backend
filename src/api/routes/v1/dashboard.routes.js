/**
 * The Clouds Academy - Dashboard Routes
 */

import { Router } from 'express';
import { getDashboardStats } from '../../controllers/dashboard.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { schoolContext } from '../../middlewares/schoolContext.middleware.js';

const router = Router();

router.use(protect, schoolContext);

router.get('/stats', getDashboardStats);

export default router;
