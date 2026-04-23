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
    
    // Get filters from query params
    const filters = {
      month: req.query.month ? parseInt(req.query.month) : null,
      year: req.query.year ? parseInt(req.query.year) : null,
      subject_id: req.query.subject_id || null,
      from_date: req.query.from_date || null,
      to_date: req.query.to_date || null,
      include_monthly_breakdown: req.query.include_monthly_breakdown !== 'false'
    };
    
    const attendance = await parentService.getChildFullAttendance(childId, instituteId, filters);
    return sendSuccess(res, attendance, 'Attendance fetched successfully');
  } catch (error) {
    console.error('Attendance error:', error);
    return sendError(res, error.message, 500);
  }
};

// Add endpoint to get attendance months list
export const getAttendanceMonths = async (req, res) => {
  try {
    const { childId } = req.params;
    const instituteId = getInstituteId(req);
    
    const months = await parentService.getAttendanceMonths(childId, instituteId);
    return sendSuccess(res, months, 'Attendance months fetched successfully');
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
    
    const filters = {
      exam_type: req.query.exam_type,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      academic_year: req.query.academic_year,
      include_subject_details: req.query.include_subject_details !== 'false'
    };
    
    const results = await parentService.getChildFullResults(childId, instituteId, filters);
    return sendSuccess(res, results, 'Results fetched successfully');
  } catch (error) {
    console.error('Results error:', error);
    return sendError(res, error.message, 500);
  }
};

export const getExamResultDetails = async (req, res) => {
  try {
    const { resultId } = req.params;
    const instituteId = getInstituteId(req);
    
    const result = await parentService.getExamResultDetails(resultId, req.user.id, instituteId);
    return sendSuccess(res, result, 'Exam result details fetched successfully');
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

export const getResultStatistics = async (req, res) => {
  try {
    const { childId } = req.params;
    const instituteId = getInstituteId(req);
    
    const results = await parentService.getChildFullResults(childId, instituteId);
    
    const statistics = {
      overall_average: results.statistics.average_percentage,
      total_exams: results.statistics.total_exams,
      best_exam: results.statistics.best_performance,
      subject_wise: results.statistics.subjects_performance,
      exam_type_breakdown: results.statistics.exam_type_breakdown,
      trend: calculateTrend(results.results)
    };
    
    return sendSuccess(res, statistics, 'Result statistics fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

const calculateTrend = (results) => {
  if (results.length < 2) return 'stable';
  
  const recent = results[0].percentage;
  const previous = results[1].percentage;
  
  if (recent > previous + 5) return 'improving';
  if (recent < previous - 5) return 'declining';
  return 'stable';
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD FEES
// ─────────────────────────────────────────────────────────────────────────────

export const getChildFees = async (req, res) => {
  try {
    const { childId } = req.params;
    const instituteId = getInstituteId(req);
    
    const filters = {
      status: req.query.status,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      year: req.query.year ? parseInt(req.query.year) : null,
      include_paid: req.query.include_paid !== 'false',
      include_pending: req.query.include_pending !== 'false',
      include_overdue: req.query.include_overdue !== 'false'
    };
    
    const fees = await parentService.getChildFullFees(childId, instituteId, filters);
    return sendSuccess(res, fees, 'Fees fetched successfully');
  } catch (error) {
    console.error('Fees error:', error);
    return sendError(res, error.message, 500);
  }
};

export const getVoucherDetails = async (req, res) => {
  try {
    const { voucherId } = req.params;
    const instituteId = getInstituteId(req);
    
    const voucher = await parentService.getFeeVoucherById(voucherId, req.user.id, instituteId);
    return sendSuccess(res, voucher, 'Voucher details fetched successfully');
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

export const getFeeSummary = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    
    // Get all children
    const children = await parentService.getMyChildren(req.user.id, instituteId);
    
    // Get fee summary for all children
    const childrenFees = await Promise.all(
      children.map(async (child) => {
        const fees = await parentService.getChildFullFees(child.id, instituteId, {});
        return {
          child_id: child.id,
          child_name: child.name,
          registration_no: child.registration_no,
          total_invoiced: fees.summary.total_invoiced,
          total_paid: fees.summary.total_paid,
          total_due: fees.summary.total_due,
          pending_count: fees.summary.pending_count,
          overdue_count: fees.summary.overdue_count
        };
      })
    );
    
    const overallSummary = {
      total_invoiced: childrenFees.reduce((sum, c) => sum + c.total_invoiced, 0),
      total_paid: childrenFees.reduce((sum, c) => sum + c.total_paid, 0),
      total_due: childrenFees.reduce((sum, c) => sum + c.total_due, 0),
      total_pending_vouchers: childrenFees.reduce((sum, c) => sum + c.pending_count, 0),
      total_overdue_vouchers: childrenFees.reduce((sum, c) => sum + c.overdue_count, 0)
    };
    
    return sendSuccess(res, { children: childrenFees, overall: overallSummary }, 'Fee summary fetched successfully');
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

export const getNoticesForChild = async (req, res) => {
  try {
    const { childId } = req.params;
    const instituteId = getInstituteId(req);
    const filters = {
      type: req.query.type,
      is_read: req.query.is_read === 'true' ? true : req.query.is_read === 'false' ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
      page: req.query.page ? parseInt(req.query.page) : 1
    };
    
    const result = await parentService.getNoticesForChild(
      childId,
      req.user.id,
      instituteId,
      filters
    );
    
    // Use sendPaginated (same as getChildAssignments)
    return sendPaginated(res, result.data, result.pagination, 'Notices fetched successfully');
  } catch (error) {
    if (error.message.includes('Not authorized')) {
      return sendError(res, error.message, 403);
    }
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD PROFILE UPDATE (if we allow parents to update child profile)
// ─────────────────────────────────────────────────────────────────────────────
export const updateChildProfile = async (req, res) => {
  const { childId } = req.params;
  const instituteId = getInstituteId(req);
  const updated = await parentService.updateChildProfile(childId, req.user.id, instituteId, req.body, req.file);
  sendSuccess(res, updated, 'Child profile updated');
};