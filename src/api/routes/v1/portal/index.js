// backend/src/routes/v1/portal/index.js

/**
 * The Clouds Academy - Portal Routes Aggregator
 * 
 * Teacher, Student aur Parent ke saare portal routes ek jagah
 */

import { Router } from 'express';
import teacherPortalRoutes from './teacher.portal.routes.js';
import studentPortalRoutes from './student.portal.routes.js';
import parentPortalRoutes from './parent.portal.routes.js';

const router = Router();

// Mount portal routes
router.use('/teacher', teacherPortalRoutes);
router.use('/student', studentPortalRoutes);
router.use('/parent', parentPortalRoutes);

export default router;