// backend/src/controllers/portal/teacherPortal.controller.js

/**
 * The Clouds Academy - Teacher Portal Controller
 * 
 * Routes ke liye controller functions
 */

import * as teacherService from '../../../services/portal/teacherPortal.service.js';
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

const normalizeUploadedFiles = (filesPayload) => {
  if (Array.isArray(filesPayload)) return filesPayload;
  if (!filesPayload || typeof filesPayload !== 'object') return [];

  const attachments = Array.isArray(filesPayload.attachments) ? filesPayload.attachments : [];
  const files = Array.isArray(filesPayload.files) ? filesPayload.files : [];
  return [...attachments, ...files];
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export const getDashboard = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const dashboard = await teacherService.getTeacherDashboard(req.user.id, instituteId);
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
    const profile = await teacherService.getTeacherProfile(req.user.id, instituteId);
    return sendSuccess(res, profile, 'Profile fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const profile = await teacherService.updateTeacherProfile(
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
// CLASSES
// ─────────────────────────────────────────────────────────────────────────────
export const getMyClasses = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const classes = await teacherService.getMyClasses(req.user.id, instituteId);
    return sendSuccess(res, classes, 'Classes fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const getClassDetails = async (req, res) => {
  try {
    const { classId } = req.params;
    const instituteId = getInstituteId(req);
    const classDetails = await teacherService.getClassDetails(classId, req.user.id, instituteId);
    return sendSuccess(res, classDetails, 'Class details fetched successfully');
  } catch (error) {
    if (error.message.includes('not found')) {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STUDENTS
// ─────────────────────────────────────────────────────────────────────────────
export const getMyStudents = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const filters = {
      search: req.query.search,
      class_id: req.query.class_id
    };
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };
    
    const result = await teacherService.getMyStudents(
      req.user.id,
      instituteId,
      filters,
      pagination
    );
    
    return sendPaginated(res, result.data, result.pagination, 'Students fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const getStudentDetails = async (req, res) => {
  try {
    const { studentId } = req.params;
    const instituteId = getInstituteId(req);
    const student = await teacherService.getStudentDetails(studentId, req.user.id, instituteId);
    return sendSuccess(res, student, 'Student details fetched successfully');
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('do not teach')) {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const createAssignment = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const uploadedFiles = normalizeUploadedFiles(req.files);
    const assignment = await teacherService.createAssignment(
      req.user.id,
      instituteId,
      req.body,
      uploadedFiles
    );
    return sendCreated(res, assignment, 'Assignment created successfully');
  } catch (error) {
    return sendError(res, error.message, 400);
  }
};

export const getMyAssignments = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const filters = {
      type: req.query.type,
      subject: req.query.subject,
      status: req.query.status,
      search: req.query.search
    };
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };
    
    const result = await teacherService.getMyAssignments(
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

export const getAssignmentDetails = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const instituteId = getInstituteId(req);
    const assignment = await teacherService.getAssignmentWithSubmissions(
      assignmentId,
      req.user.id,
      instituteId
    );
    return sendSuccess(res, assignment, 'Assignment details fetched successfully');
  } catch (error) {
    if (error.message.includes('not found')) {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message, 500);
  }
};

export const updateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const instituteId = getInstituteId(req);
    const uploadedFiles = normalizeUploadedFiles(req.files);
    const assignment = await teacherService.updateAssignment(
      assignmentId,
      req.user.id,
      instituteId,
      req.body,
      uploadedFiles
    );
    return sendSuccess(res, assignment, 'Assignment updated successfully');
  } catch (error) {
    if (error.message.includes('not found')) {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message, 400);
  }
};

export const deleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const instituteId = getInstituteId(req);
    const result = await teacherService.deleteAssignment(
      assignmentId,
      req.user.id,
      instituteId
    );
    return sendSuccess(res, result, 'Assignment deleted successfully');
  } catch (error) {
    if (error.message.includes('not found')) {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message, 400);
  }
};

export const getAssignmentSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const instituteId = getInstituteId(req);
    const assignment = await teacherService.getAssignmentWithSubmissions(
      assignmentId,
      req.user.id,
      instituteId
    );
    return sendSuccess(res, assignment.submissions || [], 'Submissions fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const gradeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const submission = await teacherService.gradeSubmission(
      submissionId,
      req.body,
      req.user.id
    );
    return sendSuccess(res, submission, 'Submission graded successfully');
  } catch (error) {
    return sendError(res, error.message, 400);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────
export const markAttendance = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const result = await teacherService.markAttendance(
      req.user.id,
      instituteId,
      req.body
    );
    return sendSuccess(res, result, 'Attendance marked successfully');
  } catch (error) {
    return sendError(res, error.message, 400);
  }
};

export const getClassAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;
    const instituteId = getInstituteId(req);
    
    const attendance = await teacherService.getClassAttendance(
      req.user.id,
      instituteId,
      classId,
      date
    );
    return sendSuccess(res, attendance, 'Attendance fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const instituteId = getInstituteId(req);
    
    // First verify teacher teaches this student
    await teacherService.getStudentDetails(studentId, req.user.id, instituteId);
    
    const attendance = await teacherService.getStudentAttendanceHistory(studentId, instituteId);
    return sendSuccess(res, attendance, 'Student attendance fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TIMETABLE
// ─────────────────────────────────────────────────────────────────────────────
export const getMyTimetable = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const { week } = req.query;
    
    const timetable = await teacherService.getMyTimetable(
      req.user.id,
      instituteId,
      week
    );
    return sendSuccess(res, timetable, 'Timetable fetched successfully');
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
    
    const notices = await teacherService.getNotices(req.user.id, instituteId, parseInt(limit));
    return sendSuccess(res, notices, 'Notices fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXAM MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const getAssignments = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    
    const assignments = await teacherService.getTeacherAssignments(
      req.user.id,
      instituteId
    );
    
    return sendSuccess(res, assignments, 'Teacher assignments fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const createExam = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const { class_id, section_id, subject_schedules, exam_date, exam_type, duration_minutes } = req.body;
    
    // Validate required fields
    if (!class_id || !subject_schedules || !Array.isArray(subject_schedules)) {
      return sendError(res, 'class_id and subject_schedules are required', 400);
    }
    
    if (subject_schedules.length === 0) {
      return sendError(res, 'At least one subject is required', 400);
    }
    
    const result = await teacherService.createTeacherExam(
      req.user.id,
      instituteId,
      {
        class_id,
        section_id,
        subject_schedules,
        exam_date,
        exam_type: exam_type || 'PERIODIC',
        duration_minutes: duration_minutes || 60
      },
      { transaction: true }
    );
    
    return sendSuccess(res, result, 'Exam created successfully', 201);
  } catch (error) {
    return sendError(res, error.message, error.message.includes('not assigned') ? 403 : 500);
  }
};

export const getExams = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const { 
      page = 1, 
      limit = 10, 
      status, 
      type, 
      class_id, 
      is_published 
    } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (class_id) filters.class_id = class_id;
    if (is_published !== undefined) filters.is_published = is_published === 'true';
    
    const result = await teacherService.getTeacherExams(
      req.user.id,
      instituteId,
      filters,
      {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    );
    
    return sendSuccess(res, result, 'Teacher exams fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const getExamDetails = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const { examId } = req.params;
    
    if (!examId) {
      return sendError(res, 'examId is required', 400);
    }
    
    const result = await teacherService.getTeacherExamDetails(
      req.user.id,
      instituteId,
      examId
    );
    
    if (!result) {
      return sendError(res, 'Exam not found or unauthorized', 404);
    }
    
    return sendSuccess(res, result, 'Exam details fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const getExamResults = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const { examId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    
    if (!examId) {
      return sendError(res, 'examId is required', 400);
    }
    
    const filters = {};
    if (status) filters.status = status;
    
    const result = await teacherService.getTeacherExamResults(
      req.user.id,
      instituteId,
      examId,
      filters,
      {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    );
    
    if (!result) {
      return sendError(res, 'Exam not found or unauthorized', 404);
    }
    
    return sendSuccess(res, result, 'Exam results fetched successfully');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const addExamResults = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const { examId } = req.params;
    const { results } = req.body;
    
    if (!examId) {
      return sendError(res, 'examId is required', 400);
    }
    
    if (!results || !Array.isArray(results)) {
      return sendError(res, 'results array is required', 400);
    }
    
    if (results.length === 0) {
      return sendError(res, 'At least one result is required', 400);
    }
    
    const result = await teacherService.addTeacherExamResults(
      req.user.id,
      instituteId,
      examId,
      results,
      { transaction: true }
    );
    
    return sendSuccess(res, result, 'Exam results saved successfully');
  } catch (error) {
    return sendError(
      res, 
      error.message, 
      error.message.includes('not assigned') || error.message.includes('unauthorized') ? 403 : 500
    );
  }
};

// backend/src/controllers/portal/teacherPortal.controller.js

/**
 * Get ALL students for exam entry (with existing results if any)
 * This is specifically for the "Enter Marks" page
 */
export const getExamEntryStudents = async (req, res) => {
  try {
    const { examId } = req.params;
    const instituteId = getInstituteId(req);
    const teacherId = req.user.id;

    if (!examId) {
      return sendError(res, 'examId is required', 400);
    }

    const filters = {
      search: req.query.search,
      status: req.query.status
    };

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 100
    };

    const result = await teacherService.getExamEntryStudents(
      examId,
      teacherId,
      instituteId,
      filters,
      pagination
    );

    return sendSuccess(res, result, 'Exam entry data fetched successfully');
  } catch (error) {
    console.error('Get exam entry students error:', error);
    if (error.message.includes('not authorized')) {
      return sendError(res, error.message, 403);
    }
    if (error.message.includes('not found')) {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message, 500);
  }
};