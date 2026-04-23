// backend/src/controllers/portal/studentPortal.controller.js

/**
 * The Clouds Academy - Student Portal Controller
 */

import * as studentService from '../../../services/portal/studentPortal.service.js';
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
    const dashboard = await studentService.getStudentDashboard(req.user.id, instituteId);
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
    const profile = await studentService.getStudentProfile(req.user.id, instituteId);
    return sendSuccess(res, profile, 'Profile fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const profile = await studentService.updateStudentProfile(
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
// CLASSES & TIMETABLE
// ─────────────────────────────────────────────────────────────────────────────
export const getMyClasses = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const classes = await studentService.getMyClasses(req.user.id, instituteId);
    return sendSuccess(res, classes, 'Classes fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const getMyTimetable = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const { week } = req.query;
    const timetable = await studentService.getMyTimetable(req.user.id, instituteId, week);
    return sendSuccess(res, timetable, 'Timetable fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const getTodayClasses = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const classes = await studentService.getTodayClasses(req.user.id, instituteId);
    return sendSuccess(res, classes, 'Today\'s classes fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────
export const getMyAttendance = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const filters = {
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      subject: req.query.subject,
      limit: req.query.limit
    };
    
    const attendance = await studentService.getMyAttendance(req.user.id, instituteId, filters);
    return sendSuccess(res, attendance, 'Attendance fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const getMyAssignments = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const filters = {
      type: req.query.type,
      subject: req.query.subject,
      status: req.query.status
    };
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };
    
    const result = await studentService.getMyAssignments(
      req.user.id,
      instituteId,
      filters,
      pagination
    );
    
    return sendPaginated(res, result.data, result.pagination, 'Assignments fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const getUpcomingAssignments = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const { limit = 5 } = req.query;
    
    const assignments = await studentService.getUpcomingAssignments(
      req.user.id,
      instituteId,
      parseInt(limit)
    );
    
    return sendSuccess(res, assignments, 'Upcoming assignments fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const submitAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const instituteId = getInstituteId(req);
    
    const submission = await studentService.submitAssignment(
      assignmentId,
      req.user.id,
      instituteId,
      req.files
    );
    
    return sendSuccess(res, submission, 'Assignment submitted successfully');
  } catch (error) {
    return sendError(res, error.message, 400);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXAMS & RESULTS
// ─────────────────────────────────────────────────────────────────────────────
export const getMyExamSchedule = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const schedule = await studentService.getMyExamSchedule(req.user.id, instituteId);
    return sendSuccess(res, schedule, 'Exam schedule fetched successfully');
  } catch (error) {
    console.error('Exam schedule error:', error);
    return sendError(res, error.message, 500);
  }
};

export const getMyResults = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const filters = {
      exam_type: req.query.exam_type,
      academic_year_id: req.query.academic_year_id
    };
    
    const results = await studentService.getMyResults(req.user.id, instituteId, filters);
    return sendSuccess(res, results, 'Results fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const getRecentResults = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const { limit = 3 } = req.query;
    
    const results = await studentService.getRecentResults(
      req.user.id,
      instituteId,
      parseInt(limit)
    );
    
    return sendSuccess(res, results, 'Recent results fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FEES
// ─────────────────────────────────────────────────────────────────────────────
export const getMyFees = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const filters = {
      status: req.query.status
    };
    
    const fees = await studentService.getMyFees(req.user.id, instituteId, filters);
    return sendSuccess(res, fees, 'Fees fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const getFeeSummary = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const summary = await studentService.getFeeSummary(req.user.id, instituteId);
    return sendSuccess(res, summary, 'Fee summary fetched successfully');
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
    const filters = {
      priority: req.query.priority
    };
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };
    
    const result = await studentService.getNotices(instituteId, filters, pagination);
    return sendPaginated(res, result.data, result.pagination, 'Notices fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const getRecentNotices = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const { limit = 5 } = req.query;
    
    const notices = await studentService.getRecentNotices(instituteId, parseInt(limit));
    return sendSuccess(res, notices, 'Recent notices fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LIBRARY
// ─────────────────────────────────────────────────────────────────────────────
export const getLibraryData = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const libraryData = await studentService.getLibraryData(req.user.id, instituteId);
    return sendSuccess(res, libraryData, 'Library data fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};