// backend/src/controllers/dashboard/instituteDashboard.controller.js

import * as instituteDashboardService from '../../../services/dashboard/instituteDashboard.service.js';
import { sendSuccess, sendError } from '../../../utils/helpers/response.helper.js';

const getInstituteId = (req) => {
  return req.user?.school_id || req.user?.institute_id || req.headers['x-school-id'] || null;
};

export const getInstituteDashboard = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const data = await instituteDashboardService.getInstituteDashboard({
      instituteId,
      user: req.user,
      type: req.query.type,
      branchId: req.query.branch_id || null,
    });

    return sendSuccess(res, data, 'Institute dashboard fetched successfully');
  } catch (error) {
    console.error('❌ Institute dashboard error:', error);
    return sendError(res, error.message || 'Failed to fetch institute dashboard', 500);
  }
};

export const changeUserPassword = async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return sendError(res, 'User ID and new password are required', 400);
    }

    const data = await instituteDashboardService.changeUserPassword({
      userId,
      newPassword: password,
    });

    return sendSuccess(res, data, 'Password changed successfully');
  } catch (error) {
    console.error('❌ Change password error:', error);
    return sendError(res, error.message || 'Failed to change password', 500);
  }
};

export default {
  getInstituteDashboard,
  changeUserPassword,
};
