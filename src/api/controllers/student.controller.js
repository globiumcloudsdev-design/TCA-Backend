// backend/src/controllers/student.controller.js
/**
 * The Clouds Academy - Student Controller
 */

import * as studentService from '../../services/student.service.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';
import { unlink } from 'fs/promises';
import models from '../../models/postgres/index.js';
import { 
  sendSuccess, 
  sendCreated, 
  sendPaginated, 
  sendError, 
  sendNotFound,
  sendNoContent
} from '../../utils/helpers/response.helper.js';

const { sequelize, User } = models;

/**
 * Get institute ID from request
 */
const getInstituteId = (req) => {
  return req.user?.institute_id || req.user?.school_id;
};

/**
 * Get institute type from request
 */
const getInstituteType = (req) => {
  return req.user?.institute_type || req.user?.school?.institute_type || 'school';
};

/**
 * Upload documents to Cloudinary
 */
const uploadDocuments = async (files, instituteId, studentId) => {
  const uploadedDocs = [];
  
  if (!files?.length) return uploadedDocs;
  
  for (const file of files) {
    try {
      const folder = `the-clouds-academy/${instituteId}/students/${studentId}/documents`;
      
      const result = await uploadToCloudinary(file.path, folder, {
        resource_type: 'raw',
        use_filename: true,
        unique_filename: true
      });
      
      uploadedDocs.push({
        file_name: file.originalname,
        file_url: result.url,
        file_size: file.size,
        mime_type: file.mimetype,
        public_id: result.public_id
      });
      
    } catch (error) {
      console.error('❌ Document upload failed:', error);
    } finally {
      try { await unlink(file.path); } catch { /* ignore */ }
    }
  }
  
  return uploadedDocs;
};

/**
 * Create student
 * POST /api/v1/students
 */
export const createStudent = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const instituteId = getInstituteId(req);
    const instituteType = getInstituteType(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    // Parse form data
    const body = { ...req.body, institute_type: instituteType };
    
    // Parse JSON fields
    if (body.documents) {
      try { 
        body.documents = JSON.parse(body.documents); 
      } catch { 
        // body.documents might be just empty or handled below
      }
    }
    
    // Parse documents_meta from frontend (new approach)
    let metaDocuments = [];
    if (body.documents_meta) {
      try {
        metaDocuments = JSON.parse(body.documents_meta);
      } catch (e) {
        console.error('Error parsing documents_meta', e);
      }
    } else if (Array.isArray(body.documents)) {
       metaDocuments = body.documents;
    }

    if (body.guardians) {
      try {
        body.guardians = JSON.parse(body.guardians);
      } catch {}
    }

    if (body.details) {
      try {
        body.details = JSON.parse(body.details);
      } catch {
        // Handle if details is not JSON
      }
    }
    
    // Handle photo upload
    if (req.files?.photo?.[0]) {
      const folder = `the-clouds-academy/${instituteId}/students/photos`;
      const uploaded = await uploadToCloudinary(req.files.photo[0].path, folder);
      body.photo_url = uploaded.url;
      body.photo_public_id = uploaded.public_id;
      
      try { await unlink(req.files.photo[0].path); } catch { /* ignore */ }
    } else if (req.file) {
      // Fallback if generic upload logic put it in req.file
      const folder = `the-clouds-academy/${instituteId}/students/photos`;
      const uploaded = await uploadToCloudinary(req.file.path, folder);
      body.photo_url = uploaded.url;
      body.photo_public_id = uploaded.public_id;
      try { await unlink(req.file.path); } catch { /* ignore */ }
    }
    
    // Upload documents if any
    const docFiles = req.files?.documents || req.files || [];
    // If req.files is array (uploadMultiple only), use it. If object (uploadFields), extract.
    const filesToUpload = Array.isArray(docFiles) ? docFiles : [];
    
    if (filesToUpload.length > 0) {
      console.log('📎 Uploading', filesToUpload.length, 'documents');
      const tempId = `temp_${Date.now()}`;
      const uploadedDocs = await uploadDocuments(filesToUpload, instituteId, tempId);
      
      // Merge uploaded docs with metadata
      uploadedDocs.forEach(upDoc => {
        const metaIndex = metaDocuments.findIndex(m => m.file_name === upDoc.file_name);
        
        if (metaIndex > -1) {
          // Update existing meta with upload info
          metaDocuments[metaIndex] = {
            ...metaDocuments[metaIndex],
            file_url: upDoc.file_url,
            public_id: upDoc.public_id,
            file_size: upDoc.file_size,
            mime_type: upDoc.mime_type,
            uploaded_at: new Date()
          };
        } else {
          // Add new if not found in meta
          metaDocuments.push({
            type: 'other',
            title: upDoc.file_name,
            file_name: upDoc.file_name,
            file_url: upDoc.file_url,
            public_id: upDoc.public_id,
            uploaded_at: new Date(),
            verified: false
          });
        }
      });
      
      body.documents = metaDocuments;
    } else if (metaDocuments.length > 0) {
      body.documents = metaDocuments;
    }
    
    // Prepare data for service
    const studentData = {
      ...body,
      institute_id: instituteId,
      created_by: req.user.id,
      date_of_birth: body.dob || body.date_of_birth,
      guardians: body.guardians,
    };
    
    const result = await studentService.createStudent(studentData, { transaction });
    await transaction.commit();
    
    // Remove password from response
    const { password, ...responseData } = result;
    
    return sendCreated(res, {
      ...responseData.user.toJSON(),
      temp_password: password,
      role: responseData.role
    }, 'Student created successfully');
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Create student error:', error);
    
    return sendError(res, error.message || 'Failed to create student', 400);
  }
};

/**
 * Get all students
 * GET /api/v1/students
 */
export const getAllStudents = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const filters = {
      institute_id: instituteId,
      search: req.query.search,
      status: req.query.status,
      class_id: req.query.class_id,
      section_id: req.query.section_id,
      academic_year_id: req.query.academic_year_id,
    };
    
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };
    
    const result = await studentService.getAllStudents(filters, pagination);
    
    return sendPaginated(
      res, 
      result.data, 
      result.pagination, 
      'Students fetched successfully'
    );
    
  } catch (error) {
    console.error('❌ Get students error:', error);
    return sendError(res, error.message || 'Failed to fetch students', 500);
  }
};

/**
 * Get student by ID
 * GET /api/v1/students/:id
 */
export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const student = await studentService.getStudentById(id, instituteId);
    
    if (!student) {
      return sendNotFound(res, 'Student not found');
    }
    
    return sendSuccess(res, student, 'Student fetched successfully');
    
  } catch (error) {
    console.error('❌ Get student error:', error);
    return sendError(res, error.message || 'Failed to fetch student', 500);
  }
};

/**
 * Update student
 * PUT /api/v1/students/:id
 */
export const updateStudent = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }
    
    // Parse form data
    const body = { ...req.body };
    
    let metaDocuments = [];
    let hasDocumentsMeta = false;

    if (body.documents && typeof body.documents === 'string') {
      try {
        body.documents = JSON.parse(body.documents);
      } catch (e) {
        console.warn('⚠️ Failed to parse body.documents:', e.message);
        body.documents = [];
      }
    }

    // Frontend sends document metadata in documents_meta for multipart updates
    if (body.documents_meta !== undefined) {
      hasDocumentsMeta = true;
      try {
        metaDocuments = typeof body.documents_meta === 'string'
          ? JSON.parse(body.documents_meta)
          : (Array.isArray(body.documents_meta) ? body.documents_meta : []);
      } catch (e) {
        console.warn('⚠️ Failed to parse body.documents_meta:', e.message);
        metaDocuments = [];
      }
    } else if (Array.isArray(body.documents)) {
      metaDocuments = body.documents;
    }
    
    if (body.details && typeof body.details === 'string') {
      try {
        body.details = JSON.parse(body.details);
      } catch (e) {
        console.warn('⚠️ Failed to parse body.details:', e.message);
        body.details = {};
      }
    }

    if (body.guardians && typeof body.guardians === 'string') {
      try {
        body.guardians = JSON.parse(body.guardians);
      } catch (e) {
        console.warn('⚠️ Failed to parse body.guardians:', e.message);
        body.guardians = [];
      }
    }
    
    // Handle photo upload
    if (req.files?.photo?.[0]) {
      const folder = `the-clouds-academy/${instituteId}/students/photos`;
      const uploaded = await uploadToCloudinary(req.files.photo[0].path, folder);
      body.photo_url = uploaded.url;
      body.photo_public_id = uploaded.public_id;
      
      try { await unlink(req.files.photo[0].path); } catch { /* ignore */ }
      
      // Delete old photo if exists
      const oldStudent = await User.findByPk(id);
      if (oldStudent?.avatar_public_id) {
        await deleteFromCloudinary(oldStudent.avatar_public_id).catch(() => {});
      }
    }
    
    // Upload new documents
    if (req.files?.documents?.length) {
      console.log('📎 Uploading', req.files.documents.length, 'new documents');
      const uploadedDocs = await uploadDocuments(req.files.documents, instituteId, id);

      if (Array.isArray(metaDocuments)) {
        body.documents = [...metaDocuments, ...uploadedDocs];
      } else {
        body.documents = uploadedDocs;
      }
    } else if (hasDocumentsMeta) {
      // Important: pass even empty [] so backend can delete removed docs
      body.documents = metaDocuments;
    }
    
    const updatedStudent = await studentService.updateStudent(
      id, instituteId, body, { transaction }
    );
    
    await transaction.commit();
    
    return sendSuccess(res, updatedStudent, 'Student updated successfully');
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Update student error:', error);
    
    if (error.message === 'Student not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update student', 400);
  }
};

/**
 * Delete student
 * DELETE /api/v1/students/:id
 */
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    await studentService.deleteStudent(id, instituteId);
    
    return sendNoContent(res);
    
  } catch (error) {
    console.error('❌ Delete student error:', error);
    
    if (error.message === 'Student not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to delete student', 500);
  }
};

/**
 * Bulk delete students
 * POST /api/v1/students/bulk-delete
 */
export const bulkDeleteStudents = async (req, res) => {
  try {
    const { ids } = req.body;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 'Student IDs are required', 400);
    }
    
    const result = await studentService.bulkDeleteStudents(ids, instituteId);
    
    return sendSuccess(res, result, `${result.deletedCount} students deleted successfully`);
    
  } catch (error) {
    console.error('❌ Bulk delete error:', error);
    return sendError(res, error.message || 'Failed to delete students', 500);
  }
};

/**
 * Toggle student status
 * PATCH /api/v1/students/:id/toggle-status
 */
export const toggleStudentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    if (is_active === undefined) {
      return sendError(res, 'is_active field is required', 400);
    }
    
    const student = await studentService.toggleStudentStatus(id, instituteId, is_active);
    
    return sendSuccess(res, { 
      id: student.id, 
      is_active: student.is_active 
    }, `Student ${is_active ? 'activated' : 'deactivated'} successfully`);
    
  } catch (error) {
    console.error('❌ Toggle status error:', error);
    
    if (error.message === 'Student not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to toggle student status', 400);
  }
};

/**
 * Add academic session (promote student)
 * POST /api/v1/students/:id/academic-sessions
 */
export const addAcademicSession = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const sessionData = {
      academic_year_id: req.body.academic_year_id,
      class_id: req.body.class_id,
      section_id: req.body.section_id,
      roll_no: req.body.roll_no,
      start_date: req.body.start_date,
    };
    
    const student = await studentService.addAcademicSession(
      id, instituteId, sessionData, { transaction }
    );
    
    await transaction.commit();
    
    return sendSuccess(res, student, 'Academic session added successfully');
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Add academic session error:', error);
    
    if (error.message === 'Student not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to add academic session', 400);
  }
};

/**
 * Get students by class
 * GET /api/v1/students/by-class/:classId
 */
export const getStudentsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const students = await studentService.getStudentsByClass(classId, instituteId);
    
    return sendSuccess(res, students, 'Students fetched successfully');
    
  } catch (error) {
    console.error('❌ Get students by class error:', error);
    return sendError(res, error.message || 'Failed to fetch students', 500);
  }
};

/**
 * Get students by section
 * GET /api/v1/students/by-section/:sectionId
 */
export const getStudentsBySection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const students = await studentService.getStudentsBySection(sectionId, instituteId);
    
    return sendSuccess(res, students, 'Students fetched successfully');
    
  } catch (error) {
    console.error('❌ Get students by section error:', error);
    return sendError(res, error.message || 'Failed to fetch students', 500);
  }
};

/**
 * Get student statistics
 * GET /api/v1/students/stats
 */
export const getStudentStats = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const stats = await studentService.getStudentStats(instituteId);
    
    return sendSuccess(res, stats, 'Student statistics fetched successfully');
    
  } catch (error) {
    console.error('❌ Get stats error:', error);
    return sendError(res, error.message || 'Failed to fetch statistics', 500);
  }
};

export default {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  bulkDeleteStudents,
  toggleStudentStatus,
  addAcademicSession,
  getStudentsByClass,
  getStudentsBySection,
  getStudentStats
};