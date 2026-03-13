// /**
//  * The Clouds Academy - Class Controller
//  * 
//  * File: /src/controllers/class.controller.js
//  */
// src/controllers/class.controller.js

import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound
} from '../../utils/helpers/response.helper.js';
import * as classService from '../../services/class.service.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';
import { unlink } from 'fs/promises';
import models from '../../models/postgres/index.js';
import path from 'path';

const { sequelize } = models;

/**
 * Parse uploaded files and attach to materials
 */
const attachUploadedFiles = async (files, courses, instituteId) => {
  const oldPublicIds = [];
  
  if (!files?.length || !courses?.length) return oldPublicIds;

  for (const file of files) {
    // Parse filename: course_{index}_material_{index}_originalname.pdf
    const match = file.originalname.match(/^course_(\d+)_material_(\d+)_(.*)$/);
    if (!match) {
      console.log('⚠️ File naming convention wrong:', file.originalname);
      continue;
    }

    const courseIdx = parseInt(match[1]);
    const materialIdx = parseInt(match[2]);
    const originalName = match[3];
    
    console.log(`📄 Processing: course[${courseIdx}], material[${materialIdx}], file: ${originalName}`);

    // Find course and material
    const course = courses[courseIdx];
    if (!course?.materials?.[materialIdx]) {
      console.log(`⚠️ Course/Material not found at [${courseIdx}][${materialIdx}]`);
      continue;
    }

    const material = course.materials[materialIdx];

    // Remember old file for deletion
    if (material.pdf_url?.includes('cloudinary.com')) {
      const publicId = extractPublicId(material.pdf_url);
      if (publicId) oldPublicIds.push(publicId);
    }

    try {
      // Institute-wise folder
      const folder = `the-clouds-academy/${instituteId}/materials/${new Date().getFullYear()}`;
      
      const result = await uploadToCloudinary(file.path, folder, {
        resource_type: 'raw',
        use_filename: true,
        unique_filename: true,
        filename_override: originalName
      });
      
      material.pdf_url = result.url;
      console.log(`✅ Uploaded: ${result.url}`);
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      material.pdf_url = `/uploads/temp/${file.filename}`;
    } finally {
      try { await unlink(file.path); } catch { /* ignore */ }
    }
  }

  return oldPublicIds;
};

/**
 * Extract public_id from Cloudinary URL
 */
const extractPublicId = (url) => {
  try {
    const parts = url.split('/');
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;
    
    let publicIdParts = parts.slice(uploadIdx + 1);
    if (publicIdParts[0]?.startsWith('v')) publicIdParts = publicIdParts.slice(1);
    
    return publicIdParts.join('/').replace(/\.[^.]+$/, '');
  } catch {
    return null;
  }
};

/**
 * Get institute ID
 */
const getInstituteId = (req) => {
  return req.user?.institute_id || req.user?.school_id;
};

/**
 * CREATE Class - FIXED VERSION
 */
export const createClass = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    console.log('📥 RAW Request Body:', req.body);
    console.log('📥 RAW Files:', req.files?.map(f => ({ name: f.originalname, size: f.size })));

    // IMPORTANT: Parse FormData correctly
    const body = { ...req.body };
    
    // 1. Parse sections
    if (body.sections) {
      try {
        body.sections = JSON.parse(body.sections);
        console.log('✅ Sections parsed:', body.sections.length);
      } catch (e) {
        console.log('❌ Sections parse error:', e.message);
        body.sections = [];
      }
    } else {
      body.sections = [];
    }

    // 2. Parse courses - YE SABSE IMPORTANT HAI
    if (body.courses) {
      try {
        body.courses = JSON.parse(body.courses);
        console.log('✅ Courses parsed:', JSON.stringify(body.courses, null, 2));
      } catch (e) {
        console.log('❌ Courses parse error:', e.message);
        console.log('Raw courses string:', body.courses);
        body.courses = [];
      }
    } else {
      body.courses = [];
    }

    // 3. Parse active boolean
    body.is_active = body.active === 'true' || body.active === true;
    
    // 4. Attach files to materials
    if (req.files?.length) {
      await attachUploadedFiles(req.files, body.courses, instituteId);
    }

    // 5. Prepare final data
    const classData = {
      institute_id: instituteId,
      name: body.name,
      description: body.description || '',
      academic_year_id: body.academic_year_id,
      is_active: body.is_active,
      sections: body.sections,
      courses: body.courses,
      created_by: req.user.id
    };

    console.log('📦 Final classData:', JSON.stringify(classData, null, 2));

    // 6. Create class
    const newClass = await classService.createCompleteClass(classData, { transaction });
    await transaction.commit();

    return sendCreated(res, newClass, 'Class created successfully');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Create class error:', error);
    return sendError(res, error.message || 'Failed to create class', 400);
  }
};

/**
 * UPDATE Class - FIXED VERSION
 */
export const updateClass = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    console.log('📝 Updating class:', id);

    // Parse FormData
    const body = { ...req.body };
    
    // Parse sections
    if (body.sections) {
      try { body.sections = JSON.parse(body.sections); } catch { body.sections = []; }
    }
    
    // Parse courses - IMPORTANT
    if (body.courses) {
      try { 
        body.courses = JSON.parse(body.courses); 
        console.log('✅ Courses parsed for update');
      } catch { 
        body.courses = []; 
      }
    }

    // Parse active
    body.is_active = body.active === 'true' || body.active === true;

    // Handle files
    let oldPublicIds = [];
    if (req.files?.length) {
      oldPublicIds = await attachUploadedFiles(req.files, body.courses, instituteId);
    }

    const updatedClass = await classService.updateCompleteClass(
      id, instituteId, body, { transaction }
    );

    await transaction.commit();

    // Delete old files
    for (const pubId of oldPublicIds) {
      deleteFromCloudinary(pubId).catch(() => {});
    }

    return sendSuccess(res, updatedClass, 'Class updated successfully');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Update error:', error);
    return sendError(res, error.message || 'Failed to update class', 400);
  }
};
/**
 * GET - All classes
 * GET /api/v1/classes
 */
export const getAllClasses = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendError(res, 'Institute ID not found', 400);

    const filters = {
      institute_id: instituteId,
      academic_year_id: req.query.academic_year_id,
      status: req.query.status
    };

    const pagination = {
      page: req.query.page || 1,
      limit: req.query.limit || 10
    };

    const result = await classService.getAllClasses(filters, pagination);
    return sendPaginated(res, result.data, result.pagination, 'Classes fetched successfully');

  } catch (error) {
    console.error('❌ Get all classes error:', error);
    return sendError(res, error.message || 'Failed to fetch classes');
  }
};

/**
 * GET - Class options for dropdown
 * GET /api/v1/classes/options
 */
export const getClassOptions = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendError(res, 'Institute ID not found', 400);

    const options = await classService.getClassOptions(
      instituteId,
      req.query.academic_year_id
    );

    return sendSuccess(res, options, 'Class options fetched successfully');
  } catch (error) {
    console.error('❌ Get class options error:', error);
    return sendError(res, error.message || 'Failed to fetch class options');
  }
};

/**
 * GET - Class by ID
 * GET /api/v1/classes/:id
 */
export const getClassById = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) return sendError(res, 'Institute ID not found', 400);

    const classData = await classService.getClassById(id, instituteId);
    if (!classData) return sendNotFound(res, 'Class not found');

    return sendSuccess(res, classData, 'Class fetched successfully');

  } catch (error) {
    console.error('❌ Get class by ID error:', error);
    return sendError(res, error.message || 'Failed to fetch class');
  }
};

/**
 * DELETE - Class
 * DELETE /api/v1/classes/:id
 */
export const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) return sendError(res, 'Institute ID not found', 400);

    const result = await classService.deleteClass(id, instituteId);
    return sendSuccess(res, null, result.message);

  } catch (error) {
    console.error('❌ Delete class error:', error);
    if (error.message === 'Class not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to delete class');
  }
};

/**
 * TOGGLE STATUS
 * PATCH /api/v1/classes/:id/toggle-status
 */
export const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const instituteId = getInstituteId(req);

    if (!instituteId) return sendError(res, 'Institute ID not found', 400);

    const updatedClass = await classService.updateCompleteClass(id, instituteId, { is_active });
    return sendSuccess(res, updatedClass, `Class ${is_active ? 'activated' : 'deactivated'} successfully`);
  } catch (error) {
    console.error('❌ Toggle status error:', error);
    return sendError(res, error.message || 'Failed to toggle status');
  }
};