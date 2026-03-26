// backend/src/controllers/dashboard/masterDashboard.controller.js

import * as masterDashboardService from '../../../services/dashboard/masterDashboard.service.js';
import { sendSuccess, sendError } from '../../../utils/helpers/response.helper.js';

export const getMasterDashboard = async (req, res) => {
  try {
    const stats = await masterDashboardService.getMasterDashboardStats();
    const typeDistribution = await masterDashboardService.getInstituteTypeDistribution();
    const subscriptionDistribution = await masterDashboardService.getSubscriptionDistribution();

    return sendSuccess(res, {
      ...stats,
      type_distribution: typeDistribution,
      subscription_distribution: subscriptionDistribution
    }, 'Master dashboard data fetched successfully');
  } catch (error) {
    console.error('❌ Master dashboard error:', error);
    return sendError(res, error.message || 'Failed to fetch dashboard data', 500);
  }
};