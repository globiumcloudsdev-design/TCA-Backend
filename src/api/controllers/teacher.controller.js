// backend/src/controllers/teacher.controller.js (COMPLETE FIXED VERSION)

import * as teacherService from '../../services/teacher.service.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';
import { unlink } from 'fs/promises';
import models from '../../models/postgres/index.js';
import { 
  sendSuccess, 
  sendCreated, 
  sendPaginated, 
  sendError, 
  sendNotFound 
} from '../../utils/helpers/response.helper.js';

const { sequelize, User } = models;

/**
 * Get institute ID from request
 */
const getInstituteId = (req) => {
  return req.user?.school_id || req.user?.institute_id || req.query.institute_id || req.headers['x-school-id'] || null;
};

/**
 * Upload documents to Cloudinary
 */
const uploadDocuments = async (files, instituteId, teacherId) => {
  const uploadedDocs = [];
  
  if (!files?.length) return uploadedDocs;
  
  for (const file of files) {
    try {
      const folder = `the-clouds-academy/${instituteId}/teachers/${teacherId}/documents`;
      
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
 * Get teacher roles for dropdown
 * GET /api/v1/teachers/roles
 */
export const getTeacherRoles = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
        
    const roles = await teacherService.getTeacherRoles(instituteId);
    
    const options = roles.map(role => ({
      value: role.id,
      label: role.name,
      code: role.code,
      permissions: role.permissions || []
    }));
    
    return sendSuccess(res, options, 'Teacher roles fetched successfully');
    
  } catch (error) {
    console.error('❌ Get teacher roles error:', error);
    return sendError(res, error.message || 'Failed to fetch teacher roles', 500);
  }
};

/**
 * Create teacher
 * POST /api/v1/teachers
 */
export const createTeacher = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    // Parse form data
    const body = { ...req.body };
    
    // Parse JSON fields
    if (body.subjects) {
      try { 
        body.subjects = JSON.parse(body.subjects); 
      } catch { 
        body.subjects = []; 
      }
    }
    
    if (body.documents) {
      try { 
        body.documents = JSON.parse(body.documents); 
      } catch { 
        body.documents = []; 
      }
    }
    
    // Upload documents if any
    if (req.files?.length) {
      console.log('📎 Uploading', req.files.length, 'documents');
      const tempId = `temp_${Date.now()}`;
      const uploadedDocs = await uploadDocuments(req.files, instituteId, tempId);
      
      body.documents = [...(body.documents || []), ...uploadedDocs.map(doc => ({
        type: 'other',
        title: doc.file_name,
        file_name: doc.file_name,
        file_url: doc.file_url,
        verified: false
      }))];
      
    }
    
    // Prepare data for service
    const teacherData = {
      ...body,
      institute_id: instituteId,
      created_by: req.user.id,
      date_of_birth: body.dob,
      employee_id: body.employee_id
    };
       
    const result = await teacherService.createTeacher(teacherData, { transaction });
    await transaction.commit();
    
    // Remove password from response
    const { password, ...responseData } = result;
        
    return sendCreated(res, {
      ...responseData.user.toJSON(),
      temp_password: password,
      role: responseData.role
    }, 'Teacher created successfully');
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Create teacher error:', error);
    
    // Send proper error message
    return sendError(res, error.message || 'Failed to create teacher', 400);
  }
};

/**
 * Get all teachers
 * GET /api/v1/teachers
 */
export const getAllTeachers = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const filters = {
      institute_id: instituteId,
      search: req.query.search,
      status: req.query.status,
      role_id: req.query.role_id
    };
    
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };
        
    const result = await teacherService.getAllTeachers(filters, pagination);
    
    return sendPaginated(
      res, 
      result.data, 
      result.pagination, 
      'Teachers fetched successfully'
    );
    
  } catch (error) {
    console.error('❌ Get teachers error:', error);
    return sendError(res, error.message || 'Failed to fetch teachers', 500);
  }
};

/**
 * Get teacher by ID
 * GET /api/v1/teachers/:id
 */
export const getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
        
    const teacher = await teacherService.getTeacherById(id, instituteId);
    
    if (!teacher) {
      return sendNotFound(res, 'Teacher not found');
    }
    
    return sendSuccess(res, teacher, 'Teacher fetched successfully');
    
  } catch (error) {
    console.error('❌ Get teacher error:', error);
    return sendError(res, error.message || 'Failed to fetch teacher', 500);
  }
};

/**
 * Update teacher
 * PUT /api/v1/teachers/:id
 */
export const updateTeacher = async (req, res) => {
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
    
    if (body.subjects) {
      try { 
        body.subjects = JSON.parse(body.subjects); 
      } catch { 
        body.subjects = []; 
      }
    }
    
    // Handle existing documents string from multipart/form-data
    if (body.documents && typeof body.documents === 'string') {
      try {
        body.documents = JSON.parse(body.documents);
      } catch (e) {
        console.warn('⚠️ Failed to parse body.documents:', e.message);
        body.documents = [];
      }
    }

    // Upload new documents
    if (req.files?.length) {
      console.log('📎 Uploading', req.files.length, 'new documents');
      const uploadedDocs = await uploadDocuments(req.files, instituteId, id);
      
      if (Array.isArray(body.documents)) {
        body.documents = [...body.documents, ...uploadedDocs];
      } else {
        body.documents = uploadedDocs;
      }
    }
    
    const updatedTeacher = await teacherService.updateTeacher(
      id, instituteId, body, { transaction }
    );
    
    await transaction.commit();
        
    return sendSuccess(res, updatedTeacher, 'Teacher updated successfully');
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Update teacher error:', error);
    
    if (error.message === 'Teacher not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update teacher', 400);
  }
};

/**
 * Delete teacher
 * DELETE /api/v1/teachers/:id
 */
export const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
        
    const teacher = await User.findOne({
      where: { id, school_id: instituteId, user_type: 'TEACHER' }
    });
    
    if (!teacher) {
      return sendNotFound(res, 'Teacher not found');
    }
    
    await teacher.destroy();
        
    return sendSuccess(res, null, 'Teacher deleted successfully');
    
  } catch (error) {
    console.error('❌ Delete teacher error:', error);
    return sendError(res, error.message || 'Failed to delete teacher', 500);
  }
};

/**
 * Regenerate QR code
 * POST /api/v1/teachers/:id/regenerate-qr
 */
export const regenerateQRCode = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
        
    const qrCodeUrl = await teacherService.regenerateQRCode(id, instituteId);
        
    return sendSuccess(res, { qr_code: qrCodeUrl }, 'QR Code regenerated successfully');
    
  } catch (error) {
    console.error('❌ Regenerate QR error:', error);
    if (error.message === 'Teacher not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to regenerate QR code', 400);
  }
};


/**
 * Toggle teacher status (active/inactive)
 * PATCH /api/v1/teachers/:id/toggle-status
 */
export const toggleTeacherStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }
    
    if (is_active === undefined) {
      await transaction.rollback();
      return sendError(res, 'is_active field is required', 400);
    }
    
    // console.log('🔄 Toggling teacher status:', { id, is_active });
    
    const teacher = await User.findOne({
      where: { id, school_id: instituteId, user_type: 'TEACHER' }
    });
    
    if (!teacher) {
      await transaction.rollback();
      return sendNotFound(res, 'Teacher not found');
    }
    
    teacher.is_active = is_active;
    await teacher.save({ transaction });
    
    await transaction.commit();
    
    return sendSuccess(res, { 
      id: teacher.id, 
      is_active: teacher.is_active 
    }, `Teacher ${is_active ? 'activated' : 'deactivated'} successfully`);
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Toggle status error:', error);
    return sendError(res, error.message || 'Failed to toggle teacher status', 400);
  }
};