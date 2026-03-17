// backend/src/controllers/portal/parentPortal.controller.js

/**
 * The Clouds Academy - Parent Portal Controller
 */

import * as parentService from '../../../services/portal/parentPortal.service.js';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound
} from '../../../utils/helpers/response.helper.js';

const getInstituteId = (req) => {
  return req.user?.school_id || req.user?.institute_id;
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export const getDashboard = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const dashboard = await parentService.getParentDashboard(req.user.id, instituteId);
    return sendSuccess(res, dashboard, 'Dashboard fetched successfully');
  } catch (error) {
    console.error('Dashboard error:', error);
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────
export const getProfile = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const profile = await parentService.getParentProfile(req.user.id, instituteId);
    return sendSuccess(res, profile, 'Profile fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const profile = await parentService.updateParentProfile(
      req.user.id,
      instituteId,
      req.body,
      req.file
    );
    return sendSuccess(res, profile, 'Profile updated successfully');
  } catch (error) {
    return sendError(res, error.message, 400);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILDREN
// ─────────────────────────────────────────────────────────────────────────────
export const getMyChildren = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const children = await parentService.getMyChildren(req.user.id, instituteId);
    return sendSuccess(res, children, 'Children fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const getChildDetails = async (req, res) => {
  try {
    const { childId } = req.params;
    const instituteId = getInstituteId(req);
    
    const child = await parentService.getChildDetails(childId, req.user.id, instituteId);
    return sendSuccess(res, child, 'Child details fetched successfully');
  } catch (error) {
    if (error.message.includes('not authorized')) {
      return sendError(res, error.message, 403);
    }
    if (error.message.includes('not found')) {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────
export const getChildAttendance = async (req, res) => {
  try {
    const { childId } = req.params;
    const instituteId = getInstituteId(req);
    
    const attendance = await parentService.getChildFullAttendance(childId, instituteId);
    return sendSuccess(res, attendance, 'Attendance fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD RESULTS
// ─────────────────────────────────────────────────────────────────────────────
export const getChildResults = async (req, res) => {
  try {
    const { childId } = req.params;
    const instituteId = getInstituteId(req);
    
    const results = await parentService.getChildFullResults(childId, instituteId);
    return sendSuccess(res, results, 'Results fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD FEES
// ─────────────────────────────────────────────────────────────────────────────
export const getChildFees = async (req, res) => {
  try {
    const { childId } = req.params;
    const instituteId = getInstituteId(req);
    
    const fees = await parentService.getChildFullFees(childId, instituteId);
    return sendSuccess(res, fees, 'Fees fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const payChildFee = async (req, res) => {
  try {
    const { voucherId } = req.params;
    const instituteId = getInstituteId(req);
    
    const payment = await parentService.payChildFee(
      voucherId,
      req.user.id,
      instituteId,
      req.body
    );
    
    return sendSuccess(res, payment, 'Payment successful');
  } catch (error) {
    return sendError(res, error.message, 400);
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const filters = {
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      limit: req.query.limit
    };
    
    const history = await parentService.getPaymentHistory(req.user.id, instituteId, filters);
    return sendSuccess(res, history, 'Payment history fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const getChildAssignments = async (req, res) => {
  try {
    const { childId } = req.params;
    const instituteId = getInstituteId(req);
    const filters = {
      status: req.query.status
    };
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };
    
    const result = await parentService.getChildAssignments(
      childId,
      instituteId,
      filters,
      pagination
    );
    
    return sendPaginated(res, result.data, result.pagination, 'Assignments fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD TIMETABLE
// ─────────────────────────────────────────────────────────────────────────────
export const getChildTimetable = async (req, res) => {
  try {
    const { childId } = req.params;
    const instituteId = getInstituteId(req);
    
    const timetable = await parentService.getChildTimetable(childId, instituteId);
    return sendSuccess(res, timetable, 'Timetable fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEACHERS
// ─────────────────────────────────────────────────────────────────────────────
export const getChildrenTeachers = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    
    const teachers = await parentService.getChildrenTeachers(req.user.id, instituteId);
    return sendSuccess(res, teachers, 'Teachers fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────────────────────────────────────────
export const getNotices = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const { limit = 10 } = req.query;
    
    const notices = await parentService.getParentNotices(instituteId, parseInt(limit));
    return sendSuccess(res, notices, 'Notices fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};