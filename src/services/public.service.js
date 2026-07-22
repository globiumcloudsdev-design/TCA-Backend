import models from '../models/postgres/index.js';
const { SubscriptionPlan, WebsiteCms } = models;

export const publicService = {
    /**
     * Get all website CMS configs for public landing page
     */
    getWebsiteCms: async () => {
        try {
            await WebsiteCms.sync({ force: false });
            const settings = await WebsiteCms.findAll();
            return settings.reduce((acc, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});
        } catch (error) {
            console.error('Error fetching public CMS settings:', error);
            throw error;
        }
    },
    /**
     * Get all published subscription plans
     */
    getPricingPlans: async () => {
        try {
            const plans = await SubscriptionPlan.findAll({
                where: {
                    is_published: true,
                    is_active: true
                },
                order: [['display_order', 'ASC'], ['price', 'ASC']]
            });
            return plans;
        } catch (error) {
            console.error('Error fetching pricing plans:', error);
            throw error;
        }
    }
};
