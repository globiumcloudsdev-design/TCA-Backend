// backend/src/controllers/dashboard/parentDashboard.controller.js

import * as parentDashboardService from '../../../services/dashboard/parentDashboard.service.js';
import { sendSuccess, sendError } from '../../../utils/helpers/response.helper.js';

const getInstituteId = (req) => {
  return req.user?.institute_id || req.user?.school_id;
};

export const getParentDashboard = async (req, res) => {
  try {
    const parentId = req.user.id;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const dashboardData = await parentDashboardService.getParentDashboard(parentId, instituteId);

    return sendSuccess(res, dashboardData, 'Parent dashboard data fetched successfully');
  } catch (error) {
    console.error('❌ Parent dashboard error:', error);
    return sendError(res, error.message || 'Failed to fetch dashboard data', 500);
  }
};