import { Router } from 'express';
import { publicController } from '../../controllers/public.controller.js';

const router = Router();

/**
 * @route   GET /api/v1/public/pricing-plans
 * @desc    Get all published subscription plans
 * @access  Public
 */
router.get('/pricing-plans', publicController.getPricingPlans);
router.get('/platform-status', publicController.getPlatformStatus);
router.get('/cms', publicController.getCmsConfig);

export default router;
