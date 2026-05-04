/**
 * The Clouds Academy - Report Controller
 * 
 * Handles report generation, filtering & exports
 * Reports available: Student, Attendance, Fee, Exam, Payroll, etc.
 */

import * as reportService from '../../services/report.service.js';
import models from '../../models/postgres/index.js';
import {
  sendSuccess,
  sendPaginated,
  sendError,
  sendNotFound
} from '../../utils/helpers/response.helper.js';

// Helper to get institute ID from request
const getInstituteId = (req) => {
  return req.user?.school_id || req.user?.institute_id;
};

// ==================== STUDENT REPORTS ====================

/**
 * GET /reports/student
 * Student list report with filters
 */
export const getStudentReport = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const filters = {
      institute_id: instituteId,
      class_id: req.query.class_id,
      section_id: req.query.section_id,
      academic_year_id: req.query.academic_year_id,
      status: req.query.status, // active, inactive, graduated
      search: req.query.search,
      orderBy: req.query.orderBy || 'first_name',
      orderDirection: req.query.orderDirection || 'ASC',
      skip: parseInt(req.query.skip) || 0,
      limit: parseInt(req.query.limit) || 100
    };

    const report = await reportService.generateStudentReport(filters);
    return sendSuccess(res, report, 'Student report generated successfully');
  } catch (error) {
    console.error('Student report error:', error);
    return sendError(res, error.message || 'Failed to generate student report', 400);
  }
};

// ==================== ATTENDANCE REPORTS ====================

/**
 * GET /reports/attendance
 * Attendance report by class/section/month/date
 */
export const getAttendanceReport = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const filters = {
      institute_id: instituteId,
      class_id: req.query.class_id,
      section_id: req.query.section_id,
      academic_year_id: req.query.academic_year_id,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      student_id: req.query.student_id,
      type: req.query.type || 'summary', // summary, detailed, student_wise
      orderBy: req.query.orderBy || 'date',
      orderDirection: req.query.orderDirection || 'DESC',
      skip: parseInt(req.query.skip) || 0,
      limit: parseInt(req.query.limit) || 100
    };

    const report = await reportService.generateAttendanceReport(filters);
    return sendSuccess(res, report, 'Attendance report generated successfully');
  } catch (error) {
    console.error('Attendance report error:', error);
    return sendError(res, error.message || 'Failed to generate attendance report', 400);
  }
};

// ==================== FEE REPORTS ====================

/**
 * GET /reports/fee
 * Fee collection report by status, class, or student
 */
export const getFeeReport = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    // Calculate skip from page/limit or use direct skip
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const skip = req.query.skip !== undefined ? parseInt(req.query.skip) : (page - 1) * limit;

    const filters = {
      institute_id: instituteId,
      class_id: req.query.class_id,
      section_id: req.query.section_id,
      academic_year_id: req.query.academic_year_id,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      status: req.query.status, // pending, paid, partial, overdue, cancelled
      student_id: req.query.student_id,
      search: req.query.search && req.query.search.trim(), // Student name search
      month: req.query.month ? parseInt(req.query.month) : undefined,
      year: req.query.year ? parseInt(req.query.year) : undefined,
      type: req.query.type || 'collection', // collection, outstanding, defaulters
      orderBy: req.query.orderBy || 'issued_date',
      orderDirection: req.query.orderDirection || 'DESC',
      skip,
      limit
    };

    const report = await reportService.generateFeeReport(filters);
    return sendSuccess(res, report, 'Fee report generated successfully');
  } catch (error) {
    console.error('Fee report error:', error);
    return sendError(res, error.message || 'Failed to generate fee report', 400);
  }
};

// ==================== EXAM REPORTS ====================

/**
 * GET /reports/exam
 * Exam results report by class/section or subject
 */
export const getExamReport = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const filters = {
      institute_id: instituteId,
      exam_id: req.query.exam_id,
      class_id: req.query.class_id,
      section_id: req.query.section_id,
      academic_year_id: req.query.academic_year_id,
      subject_id: req.query.subject_id,
      student_id: req.query.student_id,
      type: req.query.type || 'class_wise', // class_wise, student_wise, subject_wise
      orderBy: req.query.orderBy || 'marks_obtained',
      orderDirection: req.query.orderDirection || 'DESC',
      skip: parseInt(req.query.skip) || 0,
      limit: parseInt(req.query.limit) || 100
    };

    const report = await reportService.generateExamReport(filters);
    return sendSuccess(res, report, 'Exam report generated successfully');
  } catch (error) {
    console.error('Exam report error:', error);
    return sendError(res, error.message || 'Failed to generate exam report', 400);
  }
};

// ==================== PAYROLL REPORTS ====================

/**
 * GET /reports/payroll
 * Staff/Teacher payroll report
 */
export const getPayrollReport = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const filters = {
      institute_id: instituteId,
      month: req.query.month,
      year: req.query.year,
      staff_id: req.query.staff_id,
      branch_id: req.query.branch_id,
      status: req.query.status, // pending, paid, on_hold
      search: req.query.search,
      skip: parseInt(req.query.skip) || 0,
      limit: parseInt(req.query.limit) || 100
    };

    const report = await reportService.generatePayrollReport(filters);
    return sendSuccess(res, report, 'Payroll report generated successfully');
  } catch (error) {
    console.error('Payroll report error:', error);
    return sendError(res, error.message || 'Failed to generate payroll report', 400);
  }
};

// ==================== ANALYTICS & SUMMARY ====================

/**
 * GET /reports/analytics
 * High-level analytics dashboard data
 */
export const getAnalyticsReport = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const filters = {
      institute_id: instituteId,
      academic_year_id: req.query.academic_year_id,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      class_id: req.query.class_id
    };

    const report = await reportService.generateAnalyticsReport(filters);
    return sendSuccess(res, report, 'Analytics report generated successfully');
  } catch (error) {
    console.error('Analytics report error:', error);
    return sendError(res, error.message || 'Failed to generate analytics report', 400);
  }
};

// ==================== EXPORT REPORTS ====================

/**
 * POST /reports/export
 * Export any report as PDF or Excel
 */
export const exportReport = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const { report_type, format, filters } = req.body;

    if (!report_type || !format) {
      return sendError(res, 'report_type and format are required', 400);
    }

    if (!['pdf', 'excel'].includes(format)) {
      return sendError(res, 'Format must be pdf or excel', 400);
    }

    const data = {
      report_type,
      format,
      filters: { ...filters, institute_id: instituteId },
      user: req.user
    };

    const result = await reportService.exportReport(data);
    
    // Send file response
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);

  } catch (error) {
    console.error('Export report error:', error);
    return sendError(res, error.message || 'Failed to export report', 400);
  }
};

// ==================== REPORT TEMPLATES & OPTIONS ====================

/**
 * GET /reports/templates
 * Get available report templates
 */
export const getReportTemplates = async (req, res) => {
  try {
    const templates = await reportService.getReportTemplates();
    return sendSuccess(res, templates, 'Report templates retrieved');
  } catch (error) {
    console.error('Get templates error:', error);
    return sendError(res, error.message || 'Failed to get templates', 400);
  }
};

/**
 * GET /reports/options
 * Get filter options for reports
 */
export const getReportOptions = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const options = await reportService.getReportOptions(instituteId);
    return sendSuccess(res, options, 'Report options retrieved');
  } catch (error) {
    console.error('Get options error:', error);
    return sendError(res, error.message || 'Failed to get options', 400);
  }
};

/**
 * GET /reports/permissions
 * Get available reports based on user permissions
 */
export const getUserReportPermissions = async (req, res) => {
  try {
    const permissions = await reportService.getUserReportPermissions(req.user);
    return sendSuccess(res, permissions, 'Report permissions retrieved');
  } catch (error) {
    console.error('Get permissions error:', error);
    return sendError(res, error.message || 'Failed to get permissions', 400);
  }
};

// ==================== CUSTOM REPORTS ====================

/**
 * GET /reports/custom
 * Get saved custom reports
 */
export const getCustomReports = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const filters = {
      institute_id: instituteId,
      created_by: req.user.id,
      search: req.query.search
    };

    const reports = await reportService.getCustomReports(filters);
    return sendSuccess(res, reports, 'Custom reports retrieved');
  } catch (error) {
    console.error('Get custom reports error:', error);
    return sendError(res, error.message || 'Failed to get custom reports', 400);
  }
};

/**
 * POST /reports/custom
 * Save a custom report
 */
export const createCustomReport = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const data = {
      ...req.body,
      institute_id: instituteId,
      created_by: req.user.id
    };

    const report = await reportService.createCustomReport(data);
    return sendSuccess(res, report, 'Custom report saved successfully');
  } catch (error) {
    console.error('Create custom report error:', error);
    return sendError(res, error.message || 'Failed to save custom report', 400);
  }
};
