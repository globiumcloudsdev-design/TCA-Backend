import { publicService } from '../../services/public.service.js';
import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess } from '../../utils/helpers/response.helper.js';
import models from '../../models/postgres/index.js';

const { GlobalSetting } = models;

export const publicController = {
    /**
     * GET /api/v1/public/cms
     * Fetch all public website CMS configs
     */
    getCmsConfig: catchAsync(async (req, res) => {
        const cms = await publicService.getWebsiteCms();
        sendSuccess(res, cms, 'Public website CMS configurations fetched successfully');
    }),

    /**
     * GET /api/v1/public/pricing-plans
     */
    getPricingPlans: catchAsync(async (req, res) => {
        const plans = await publicService.getPricingPlans();
        sendSuccess(res, plans, 'Pricing plans fetched successfully');
    }),

    /**
     * GET /api/v1/public/platform-status
     */
    getPlatformStatus: catchAsync(async (req, res) => {
        const settings = await GlobalSetting.findAll({
            where: {
                key: ['maintenance_mode', 'feature_overrides']
            }
        });

        const status = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        sendSuccess(res, status, 'Platform status fetched');
    })
};
