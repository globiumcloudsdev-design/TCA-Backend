import models from '../models/postgres/index.js';
const { SubscriptionPlan } = models;

export const publicService = {
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
