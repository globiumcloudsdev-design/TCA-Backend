// backend/src/controllers/exam.controller.js

/**
 * The Clouds Academy - Exam Controller
 * 
 * Yeh controller request/response handle karta hai:
 * - Exam CRUD operations
 * - Results management
 * - Attendance tracking
 * - Analytics & reports
 */

import * as examService from '../../services/exam.service.js';
import models from '../../models/postgres/index.js';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound
} from '../../utils/helpers/response.helper.js';

const { sequelize } = models;

const getInstituteId = (req) => {
  return req.user?.school_id || req.user?.institute_id;
};

// ==================== EXAM CRUD ====================

export const createExam = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    const examData = {
      ...req.body,
      school_id: instituteId,
      created_by: req.user.id,
      updated_by: req.user.id
    };

    const exam = await examService.createExam(examData, { transaction });
    await transaction.commit();

    return sendCreated(res, exam, 'Exam created successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Create exam error:', error);
    return sendError(res, error.message || 'Failed to create exam', 400);
  }
};

export const getAllExams = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const filters = {
      institute_id: instituteId,
      academic_year_id: req.query.academic_year_id,
      entity_type: req.query.entity_type,
      class_id: req.query.class_id,
      section_id: req.query.section_id,
      status: req.query.status,
      type: req.query.type,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      search: req.query.search,
      orderBy: req.query.orderBy,
      orderDirection: req.query.orderDirection,
      includeDeleted: req.query.include_deleted
    };

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    const result = await examService.getAllExams(filters, pagination);

    return sendPaginated(res, result.data, result.pagination, 'Exams fetched successfully');
  } catch (error) {
    console.error('Get exams error:', error);
    return sendError(res, error.message || 'Failed to fetch exams', 500);
  }
};

export const getExamById = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const exam = await examService.getExamById(id, instituteId);

    if (!exam) {
      return sendNotFound(res, 'Exam not found');
    }

    return sendSuccess(res, exam, 'Exam fetched successfully');
  } catch (error) {
    console.error('Get exam error:', error);
    return sendError(res, error.message || 'Failed to fetch exam', 500);
  }
};

export const updateExam = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    const updateData = {
      ...req.body,
      updated_by: req.user.id
    };

    const updatedExam = await examService.updateExam(id, instituteId, updateData, { transaction });
    await transaction.commit();

    return sendSuccess(res, updatedExam, 'Exam updated successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Update exam error:', error);
    
    if (error.message === 'Exam not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update exam', 400);
  }
};

export const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const result = await examService.deleteExam(id, instituteId);

    return sendSuccess(res, null, result.message);
  } catch (error) {
    console.error('Delete exam error:', error);
    
    if (error.message === 'Exam not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to delete exam', 500);
  }
};

export const updateExamStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    if (!status) {
      return sendError(res, 'Status field is required', 400);
    }

    const exam = await examService.updateExamStatus(id, instituteId, status);

    return sendSuccess(res, exam, `Exam status updated to ${status}`);
  } catch (error) {
    console.error('Update status error:', error);
    
    if (error.message === 'Exam not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update status', 500);
  }
};

export const publishExam = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const exam = await examService.publishExam(id, instituteId);

    return sendSuccess(res, exam, 'Exam published successfully');
  } catch (error) {
    console.error('Publish exam error:', error);
    
    if (error.message === 'Exam not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to publish exam', 500);
  }
};

// ==================== RESULTS MANAGEMENT ====================

export const addExamResults = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { results } = req.body;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    if (!results || !Array.isArray(results)) {
      await transaction.rollback();
      return sendError(res, 'Results array is required', 400);
    }

    const result = await examService.addExamResults(id, instituteId, results, {
      transaction,
      userId: req.user.id
    });

    await transaction.commit();

    return sendSuccess(res, result, 'Results uploaded successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Add results error:', error);
    return sendError(res, error.message || 'Failed to add results', 400);
  }
};

export const getExamResults = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const filters = {
      section_id: req.query.section_id,
      student_id: req.query.student_id,
      status: req.query.status,
      grade: req.query.grade,
      search: req.query.search,
      orderBy: req.query.orderBy,
      orderDirection: req.query.orderDirection
    };

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    const result = await examService.getExamResults(id, instituteId, filters, pagination);

    return sendPaginated(res, result.data, result.pagination, 'Results fetched successfully', result.summary);
  } catch (error) {
    console.error('Get results error:', error);
    return sendError(res, error.message || 'Failed to fetch results', 500);
  }
};

export const updateExamResult = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { resultId } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    const updateData = {
      ...req.body,
      updated_by: req.user.id
    };

    const result = await examService.updateExamResult(resultId, instituteId, updateData, { transaction });
    await transaction.commit();

    return sendSuccess(res, result, 'Result updated successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Update result error:', error);
    
    if (error.message === 'Result not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update result', 400);
  }
};

export const deleteExamResult = async (req, res) => {
  try {
    const { resultId } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const result = await examService.deleteExamResult(resultId, instituteId);

    return sendSuccess(res, null, 'Result deleted successfully');
  } catch (error) {
    console.error('Delete result error:', error);
    
    if (error.message === 'Result not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to delete result', 500);
  }
};

export const publishExamResults = async (req, res) => {
  try {
    const { id } = req.params;
    const { publish_date } = req.body;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const exam = await examService.publishExamResults(id, instituteId, publish_date);

    return sendSuccess(res, exam, 'Results published successfully');
  } catch (error) {
    console.error('Publish results error:', error);
    
    if (error.message === 'Exam not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to publish results', 500);
  }
};

export const downloadExamResults = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const csvData = await examService.exportExamResults(id, instituteId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=exam_${id}_results.csv`);
    
    return res.send(csvData);
  } catch (error) {
    console.error('Download error:', error);
    return sendError(res, error.message || 'Failed to download results', 500);
  }
};

// ==================== ANALYTICS ====================

export const getExamAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const analytics = await examService.getExamAnalytics(id, instituteId);

    return sendSuccess(res, analytics, 'Analytics fetched successfully');
  } catch (error) {
    console.error('Get analytics error:', error);
    return sendError(res, error.message || 'Failed to fetch analytics', 500);
  }
};

export const generateGradeSheet = async (req, res) => {
  try {
    const { id } = req.params;
    const { student_id } = req.query;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const gradeSheet = await examService.generateGradeSheet(id, instituteId, student_id || req.user.id);

    return sendSuccess(res, gradeSheet, 'Grade sheet generated successfully');
  } catch (error) {
    console.error('Generate grade sheet error:', error);
    return sendError(res, error.message || 'Failed to generate grade sheet', 500);
  }
};

// ==================== STUDENT VIEWS ====================

export const getMyExams = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const studentId = req.user.id;

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const exams = await examService.getStudentExams(instituteId, studentId);

    return sendSuccess(res, exams, 'My exams fetched successfully');
  } catch (error) {
    console.error('Get my exams error:', error);
    return sendError(res, error.message || 'Failed to fetch exams', 500);
  }
};

export const getMyResults = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const studentId = req.user.id;

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const results = await examService.getStudentResults(instituteId, studentId);

    return sendSuccess(res, results, 'My results fetched successfully');
  } catch (error) {
    console.error('Get my results error:', error);
    return sendError(res, error.message || 'Failed to fetch results', 500);
  }
};

export const getExamOptions = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const filters = {
      institute_id: instituteId,
      academic_year_id: req.query.academic_year_id,
      class_id: req.query.class_id,
      section_id: req.query.section_id,
      status: req.query.status || 'published'
    };

    const exams = await examService.getExamOptions(filters);

    return sendSuccess(res, exams, 'Exam options fetched successfully');
  } catch (error) {
    console.error('Get exam options error:', error);
    return sendError(res, error.message || 'Failed to fetch options', 500);
  }
};