// backend/src/services/assignment.service.js

/**
 * The Clouds Academy - Assignment Service
 * 
 * Teacher assignments aur homework ke liye complete CRUD
 */

import { Op } from 'sequelize';
import models from '../models/postgres/index.js';
import { v4 as uuidv4 } from 'uuid';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { unlink } from 'fs/promises';
import fs from 'fs';

const { Assignment, User, Class, sequelize } = models;

const normalizeAssignmentStatus = (status, isPublished = false) => {
  if (!status) return isPublished ? 'published' : 'draft';

  const normalized = String(status).toLowerCase();
  if (normalized === 'active') return 'published';
  if (normalized === 'publish') return 'published';
  if (normalized === 'unpublished') return 'draft';
  if (normalized === 'inactive') return 'archived';
  if (['draft', 'published', 'archived'].includes(normalized)) return normalized;

  return isPublished ? 'published' : 'draft';
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create new assignment with attachments
 */
export const createAssignment = async (data, files = [], options = {}) => {
  const { transaction } = options;
  
  console.log('📝 Creating new assignment:', data.title);

  // 1. Upload attachments if any
  const attachments = [];
  if (files?.length) {
    for (const file of files) {
      try {
        const folder = `the-clouds-academy/${data.institute_id}/assignments/${Date.now()}`;
        const result = await uploadToCloudinary(file.path, folder, {
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true
        });

        attachments.push({
          id: uuidv4(),
          name: file.originalname,
          url: result.url,
          public_id: result.public_id,
          size: file.size,
          type: file.mimetype,
          uploaded_at: new Date()
        });

        console.log(`✅ Attachment uploaded: ${result.url}`);
      } catch (error) {
        console.error('❌ Attachment upload failed:', error);
      } finally {
        try { await unlink(file.path); } catch { /* ignore */ }
      }
    }
  }

  // 2. Create assignment
  const normalizedTargetType = data.target_type
    || (data.section_id ? 'section' : data.class_id ? 'class' : data.student_id ? 'individual' : 'all');

  const normalizedTargetIds = Array.isArray(data.target_ids)
    ? data.target_ids
    : (data.section_id ? [data.section_id]
      : data.class_id ? [data.class_id]
      : data.student_id ? [data.student_id]
      : []);

  const isPublished = data.is_published === 'true' || data.is_published === true || data.status === 'published';

  const assignmentStatus = normalizeAssignmentStatus(data.status, isPublished);

  const assignmentData = {
    id: uuidv4(),
    institute_id: data.institute_id,
    teacher_id: data.teacher_id,
    title: data.title,
    description: data.description || '',
    
    // Target (class, section, batch etc.)
    target_type: normalizedTargetType, // 'class', 'section', 'batch', 'individual'
    target_ids: normalizedTargetIds, // Array of IDs
    class_id: data.class_id || null,
    section_id: data.section_id || null,
    academic_year_id: data.academic_year_id || null,
    
    // Assignment details
    type: data.type || 'homework', // 'homework', 'assignment', 'project', 'quiz'
    subject: data.subject,
    subject_id: data.subject_id,
    
    // Due date
    due_date: data.due_date,
    due_time: data.due_time,
    
    // Grading
    total_marks: data.total_marks ? parseInt(data.total_marks) : null,
    passing_marks: data.passing_marks ? parseInt(data.passing_marks) : null,
    grading_type: data.grading_type || 'marks', // 'marks', 'grades', 'pass_fail'
    
    // Instructions & materials
    instructions: data.instructions || '',
    attachments: attachments,
    resources: data.resources || [], // Links to study materials
    
    // Settings
    allow_late_submission: data.allow_late_submission === 'true' || data.allow_late_submission === true,
    late_submission_days: data.late_submission_days ? parseInt(data.late_submission_days) : 0,
    is_published: isPublished,
    status: assignmentStatus,
    assigned_on: data.assigned_on || new Date(),
    published_at: isPublished ? new Date() : null,
    
    // Stats (will update later)
    stats: {
      total_students: 0,
      submitted: 0,
      pending: 0,
      graded: 0,
      average_score: 0
    },
    
    created_by: data.created_by,
    created_at: new Date(),
    updated_at: new Date()
  };

  const assignment = await Assignment.create(assignmentData, { transaction });

  // 3. If target is class/section, calculate total students
  await updateAssignmentStats(assignment.id, data.institute_id);

  console.log(`✅ Assignment created: ${assignment.id}`);
  return assignment;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all assignments for teacher
 */
export const getTeacherAssignments = async (teacherId, instituteId, filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const where = {
    institute_id: instituteId,
    teacher_id: teacherId
  };

  // Apply filters
  if (filters.type) where.type = filters.type;
  if (filters.subject) where.subject = filters.subject;
  if (filters.status === 'published') where.is_published = true;
  if (filters.status === 'draft') where.is_published = false;
  
  // Date filters
  if (filters.from_date) {
    where.created_at = { [Op.gte]: new Date(filters.from_date) };
  }
  if (filters.to_date) {
    where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.to_date) };
  }

  // Search
  if (filters.search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${filters.search}%` } },
      { description: { [Op.iLike]: `%${filters.search}%` } },
      { subject: { [Op.iLike]: `%${filters.search}%` } }
    ];
  }

  const { count, rows } = await Assignment.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
    include: [
      {
        model: User,
        as: 'teacher',
        attributes: ['id', 'first_name', 'last_name', 'avatar_url']
      }
    ]
  });

  // Get submission counts for each assignment
  const assignmentsWithStats = await Promise.all(
    rows.map(async (assignment) => {
      const stats = await getAssignmentStats(assignment.id, instituteId);
      return {
        ...assignment.toJSON(),
        stats
      };
    })
  );

  return {
    data: assignmentsWithStats,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    }
  };
};

/**
 * Get assignments for a specific class
 */
export const getClassAssignments = async (classId, instituteId, filters = {}) => {
  const where = {
    institute_id: instituteId,
    [Op.or]: [
      { target_type: 'class', target_ids: { [Op.contains]: [classId] } },
      { target_type: 'all' }
    ]
  };

  if (filters.is_published !== undefined) {
    where.is_published = filters.is_published;
  }

  const assignments = await Assignment.findAll({
    where,
    order: [['due_date', 'ASC']],
    include: [
      {
        model: User,
        as: 'teacher',
        attributes: ['id', 'first_name', 'last_name']
      }
    ]
  });

  return assignments;
};

/**
 * Get assignment by ID with submissions
 */
export const getAssignmentById = async (id, instituteId) => {
  const assignment = await Assignment.findOne({
    where: { id, institute_id: instituteId },
    include: [
      {
        model: User,
        as: 'teacher',
        attributes: ['id', 'first_name', 'last_name', 'avatar_url']
      },
      {
        model: User,
        as: 'submissions',
        through: { attributes: ['submitted_at', 'marks', 'status', 'feedback'] }
      }
    ]
  });

  if (!assignment) return null;

  // Get detailed stats
  const stats = await getAssignmentStats(id, instituteId);
  
  return {
    ...assignment.toJSON(),
    stats
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update assignment
 */
export const updateAssignment = async (id, instituteId, updateData, files = [], options = {}) => {
  const { transaction } = options;

  const assignment = await Assignment.findOne({
    where: { id, institute_id: instituteId }
  });

  if (!assignment) {
    throw new Error('Assignment not found');
  }

  // Upload new attachments if any
  if (files?.length) {
    const newAttachments = [];
    for (const file of files) {
      try {
        const folder = `the-clouds-academy/${instituteId}/assignments/${Date.now()}`;
        const result = await uploadToCloudinary(file.path, folder, {
          resource_type: 'auto',
          use_filename: true
        });

        newAttachments.push({
          id: uuidv4(),
          name: file.originalname,
          url: result.url,
          public_id: result.public_id,
          size: file.size,
          type: file.mimetype,
          uploaded_at: new Date()
        });
      } catch (error) {
        console.error('❌ Attachment upload failed:', error);
      } finally {
        try { await unlink(file.path); } catch { /* ignore */ }
      }
    }

    // Merge with existing attachments
    updateData.attachments = [...(assignment.attachments || []), ...newAttachments];
  }

  // Update fields
  const updatableFields = [
    'title', 'description', 'due_date', 'due_time',
    'total_marks', 'passing_marks', 'instructions',
    'is_published', 'allow_late_submission', 'late_submission_days'
  ];

  updatableFields.forEach(field => {
    if (updateData[field] !== undefined) {
      assignment[field] = updateData[field];
    }
  });

  if (updateData.attachments) {
    assignment.attachments = updateData.attachments;
    assignment.changed('attachments', true);
  }

  assignment.updated_at = new Date();
  await assignment.save({ transaction });

  return assignment;
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBMISSION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submit assignment (by student)
 */
export const submitAssignment = async (assignmentId, studentId, files = [], options = {}) => {
  const { transaction } = options;

  const assignment = await Assignment.findByPk(assignmentId);
  if (!assignment) {
    throw new Error('Assignment not found');
  }

  // Upload submission files
  const submissionFiles = [];
  if (files?.length) {
    for (const file of files) {
      try {
        const folder = `the-clouds-academy/${assignment.institute_id}/submissions/${assignmentId}/${studentId}`;
        const result = await uploadToCloudinary(file.path, folder, {
          resource_type: 'auto',
          use_filename: true
        });

        submissionFiles.push({
          id: uuidv4(),
          name: file.originalname,
          url: result.url,
          public_id: result.public_id,
          size: file.size,
          type: file.mimetype,
          uploaded_at: new Date()
        });
      } catch (error) {
        console.error('❌ Submission upload failed:', error);
      } finally {
        try { await unlink(file.path); } catch { /* ignore */ }
      }
    }
  }

  // Check if student already submitted
  const existingSubmission = await models.AssignmentSubmission.findOne({
    where: { assignment_id: assignmentId, student_id: studentId }
  });

  if (existingSubmission) {
    // Update existing submission
    existingSubmission.files = [...(existingSubmission.files || []), ...submissionFiles];
    existingSubmission.submitted_at = new Date();
    existingSubmission.status = 'submitted';
    existingSubmission.attempt_number = (existingSubmission.attempt_number || 1) + 1;
    existingSubmission.is_resubmission = true;
    await existingSubmission.save({ transaction });
  } else {
    // Create new submission
    await models.AssignmentSubmission.create({
      id: uuidv4(),
      assignment_id: assignmentId,
      institute_id: assignment.institute_id,
      student_id: studentId,
      files: submissionFiles,
      submitted_at: new Date(),
      status: 'submitted',
      attempt_number: 1,
      is_resubmission: false
    }, { transaction });
  }

  // Update assignment stats
  await updateAssignmentStats(assignmentId, assignment.institute_id);

  return { message: 'Assignment submitted successfully' };
};

/**
 * Grade submission
 */
export const gradeSubmission = async (submissionId, gradeData, options = {}) => {
  const { transaction } = options;

  const submission = await models.AssignmentSubmission.findByPk(submissionId);
  if (!submission) {
    throw new Error('Submission not found');
  }

  submission.marks = gradeData.marks;
  submission.grade = gradeData.grade;
  submission.feedback = gradeData.feedback;
  submission.graded_at = new Date();
  submission.graded_by = gradeData.graded_by;
  submission.status = 'graded';

  await submission.save({ transaction });

  // Update assignment stats
  await updateAssignmentStats(submission.assignment_id);

  return submission;
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete assignment and all attachments
 */
export const deleteAssignment = async (id, instituteId) => {
  const assignment = await Assignment.findOne({
    where: { id, institute_id: instituteId }
  });

  if (!assignment) {
    throw new Error('Assignment not found');
  }

  // Delete all attachments from Cloudinary
  if (assignment.attachments?.length) {
    for (const attachment of assignment.attachments) {
      if (attachment.public_id) {
        await deleteFromCloudinary(attachment.public_id).catch(() => {});
      }
    }
  }

  // Delete all submissions and their files
  const submissions = await models.AssignmentSubmission.findAll({
    where: { assignment_id: id }
  });

  for (const submission of submissions) {
    if (submission.files?.length) {
      for (const file of submission.files) {
        if (file.public_id) {
          await deleteFromCloudinary(file.public_id).catch(() => {});
        }
      }
    }
    await submission.destroy();
  }

  await assignment.destroy();
  return { message: 'Assignment deleted successfully' };
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update assignment statistics
 */
const updateAssignmentStats = async (assignmentId, instituteId) => {
  const stats = await getAssignmentStats(assignmentId, instituteId);
  
  await Assignment.update(
    { stats },
    { where: { id: assignmentId } }
  );
  
  return stats;
};

/**
 * Get assignment statistics
 */
const getAssignmentStats = async (assignmentId, instituteId) => {
  const assignment = await Assignment.findByPk(assignmentId);
  if (!assignment) return null;

  // Count total students based on target
  let totalStudents = 0;
  if (assignment.target_type === 'class' && assignment.target_ids?.length) {
    totalStudents = await User.count({
      where: {
        school_id: instituteId,
        user_type: 'STUDENT',
        is_active: true,
        'details.class_id': { [Op.in]: assignment.target_ids }
      }
    });
  } else if (assignment.target_type === 'all') {
    totalStudents = await User.count({
      where: {
        school_id: instituteId,
        user_type: 'STUDENT',
        is_active: true
      }
    });
  }

  // Count submissions
  const submissions = await models.AssignmentSubmission.findAll({
    where: { assignment_id: assignmentId }
  });

  const submitted = submissions.length;
  const graded = submissions.filter(s => s.status === 'graded').length;
  const pending = totalStudents - submitted;

  // Calculate average score
  const gradedSubmissions = submissions.filter(s => s.marks);
  const averageScore = gradedSubmissions.length
    ? gradedSubmissions.reduce((sum, s) => sum + (s.marks || 0), 0) / gradedSubmissions.length
    : 0;

  return {
    total_students: totalStudents,
    submitted,
    pending: Math.max(0, pending),
    graded,
    pending_grading: submitted - graded,
    average_score: Math.round(averageScore * 100) / 100
  };
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