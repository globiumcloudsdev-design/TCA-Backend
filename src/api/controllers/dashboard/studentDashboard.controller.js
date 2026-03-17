// backend/src/controllers/dashboard/studentDashboard.controller.js

import * as studentDashboardService from '../../../services/dashboard/studentDashboard.service.js';
import { sendSuccess, sendError } from '../../../utils/helpers/response.helper.js';

const getInstituteId = (req) => {
  return req.user?.institute_id || req.user?.school_id;
};

export const getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user.id;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const dashboardData = await studentDashboardService.getStudentDashboard(studentId, instituteId);

    return sendSuccess(res, dashboardData, 'Student dashboard data fetched successfully');
  } catch (error) {
    console.error('❌ Student dashboard error:', error);
    return sendError(res, error.message || 'Failed to fetch dashboard data', 500);
  }
};

export const getStudentDashboardById = async (req, res) => {
  try {
    const { studentId } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const dashboardData = await studentDashboardService.getStudentDashboard(studentId, instituteId);

    return sendSuccess(res, dashboardData, 'Student dashboard data fetched successfully');
  } catch (error) {
    console.error('❌ Student dashboard error:', error);
    return sendError(res, error.message || 'Failed to fetch dashboard data', 500);
  }
};