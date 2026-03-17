// backend/src/controllers/dashboard/teacherDashboard.controller.js

import * as teacherDashboardService from '../../../services/dashboard/teacherDashboard.service.js';
import { sendSuccess, sendError } from '../../../utils/helpers/response.helper.js';

const getInstituteId = (req) => {
  return req.user?.institute_id || req.user?.school_id;
};

export const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const dashboardData = await teacherDashboardService.getTeacherDashboard(teacherId, instituteId);

    return sendSuccess(res, dashboardData, 'Teacher dashboard data fetched successfully');
  } catch (error) {
    console.error('❌ Teacher dashboard error:', error);
    return sendError(res, error.message || 'Failed to fetch dashboard data', 500);
  }
};