// backend/src/controllers/assignment.controller.js

import * as assignmentService from '../../services/assignment.service.js';
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
  return req.user?.institute_id || req.user?.school_id;
};

/**
 * Create assignment
 * POST /api/v1/assignments
 */
export const createAssignment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    console.log('📝 Creating assignment with data:', req.body);

    const assignmentData = {
      ...req.body,
      institute_id: instituteId,
      teacher_id: req.user.id,
      created_by: req.user.id
    };

    const assignment = await assignmentService.createAssignment(
      assignmentData,
      req.files || [],
      { transaction }
    );

    await transaction.commit();

    return sendCreated(res, assignment, 'Assignment created successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Create assignment error:', error);
    return sendError(res, error.message || 'Failed to create assignment', 400);
  }
};

/**
 * Get teacher's assignments
 * GET /api/v1/assignments/teacher
 */
export const getTeacherAssignments = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const filters = {
      type: req.query.type,
      subject: req.query.subject,
      status: req.query.status,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      search: req.query.search
    };

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    const result = await assignmentService.getTeacherAssignments(
      req.user.id,
      instituteId,
      filters,
      pagination
    );

    return sendPaginated(
      res,
      result.data,
      result.pagination,
      'Assignments fetched successfully'
    );
  } catch (error) {
    console.error('❌ Get assignments error:', error);
    return sendError(res, error.message || 'Failed to fetch assignments', 500);
  }
};

/**
 * Get class assignments (for students)
 * GET /api/v1/assignments/class/:classId
 */
export const getClassAssignments = async (req, res) => {
  try {
    const { classId } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const assignments = await assignmentService.getClassAssignments(
      classId,
      instituteId,
      { is_published: true }
    );

    return sendSuccess(res, assignments, 'Class assignments fetched successfully');
  } catch (error) {
    console.error('❌ Get class assignments error:', error);
    return sendError(res, error.message || 'Failed to fetch class assignments', 500);
  }
};

/**
 * Get assignment by ID
 * GET /api/v1/assignments/:id
 */
export const getAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const assignment = await assignmentService.getAssignmentById(id, instituteId);

    if (!assignment) {
      return sendNotFound(res, 'Assignment not found');
    }

    return sendSuccess(res, assignment, 'Assignment fetched successfully');
  } catch (error) {
    console.error('❌ Get assignment error:', error);
    return sendError(res, error.message || 'Failed to fetch assignment', 500);
  }
};

/**
 * Update assignment
 * PUT /api/v1/assignments/:id
 */
export const updateAssignment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    const updatedAssignment = await assignmentService.updateAssignment(
      id,
      instituteId,
      req.body,
      req.files || [],
      { transaction }
    );

    await transaction.commit();

    return sendSuccess(res, updatedAssignment, 'Assignment updated successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Update assignment error:', error);
    if (error.message === 'Assignment not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update assignment', 400);
  }
};

/**
 * Delete assignment
 * DELETE /api/v1/assignments/:id
 */
export const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const result = await assignmentService.deleteAssignment(id, instituteId);

    return sendSuccess(res, null, result.message);
  } catch (error) {
    console.error('❌ Delete assignment error:', error);
    if (error.message === 'Assignment not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to delete assignment', 500);
  }
};

/**
 * Submit assignment (student)
 * POST /api/v1/assignments/:id/submit
 */
export const submitAssignment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const studentId = req.user.id;

    const result = await assignmentService.submitAssignment(
      id,
      studentId,
      req.files || [],
      { transaction }
    );

    await transaction.commit();

    return sendSuccess(res, result, 'Assignment submitted successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Submit assignment error:', error);
    return sendError(res, error.message || 'Failed to submit assignment', 400);
  }
};

/**
 * Grade submission (teacher)
 * POST /api/v1/assignments/submission/:submissionId/grade
 */
export const gradeSubmission = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { submissionId } = req.params;
    
    const gradeData = {
      ...req.body,
      graded_by: req.user.id
    };

    const submission = await assignmentService.gradeSubmission(
      submissionId,
      gradeData,
      { transaction }
    );

    await transaction.commit();

    return sendSuccess(res, submission, 'Submission graded successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Grade submission error:', error);
    return sendError(res, error.message || 'Failed to grade submission', 400);
  }
};

export default {
  createAssignment,
  getTeacherAssignments,
  getClassAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission
};