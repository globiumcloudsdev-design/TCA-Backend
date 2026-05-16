import { publicService } from '../../services/public.service.js';
import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess } from '../../utils/helpers/response.helper.js';

export const publicController = {
    /**
     * GET /api/v1/public/pricing-plans
     */
    getPricingPlans: catchAsync(async (req, res) => {
        const plans = await publicService.getPricingPlans();
        sendSuccess(res, plans, 'Pricing plans fetched successfully');
    })
};
