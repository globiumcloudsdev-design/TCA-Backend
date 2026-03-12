/**
 * The Clouds Academy - Class Validator
 * 
 * File: /src/validators/class.validator.js
 */

import Joi from 'joi';

// ==================== ID PARAM VALIDATORS ====================

export const classIdParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid class ID format',
    'any.required': 'Class ID is required'
  })
});

export const sectionIdParamSchema = Joi.object({
  sectionId: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid section ID format',
    'any.required': 'Section ID is required'
  })
});

export const courseIdParamSchema = Joi.object({
  courseId: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid course ID format',
    'any.required': 'Course ID is required'
  })
});

export const materialIdParamSchema = Joi.object({
  materialId: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid material ID format',
    'any.required': 'Material ID is required'
  })
});

// ==================== MATERIAL SCHEMA ====================

const materialSchema = Joi.object({
  name: Joi.string().max(200).required().messages({
    'string.max': 'Material name must be at most 200 characters',
    'any.required': 'Material name is required'
  }),
  description: Joi.string().max(500).optional().allow(''),
  is_active: Joi.boolean().default(true)
});

export const createMaterialSchema = Joi.object({
  name: Joi.string().max(200).required(),
  description: Joi.string().max(500).optional().allow(''),
  is_active: Joi.boolean().default(true)
});

export const updateMaterialSchema = Joi.object({
  name: Joi.string().max(200).optional(),
  description: Joi.string().max(500).optional().allow(''),
  is_active: Joi.boolean().optional()
}).min(1);

// ==================== COURSE SCHEMA ====================

const courseSchema = Joi.object({
  name: Joi.string().max(100).required().messages({
    'string.max': 'Course name must be at most 100 characters',
    'any.required': 'Course name is required'
  }),
  course_code: Joi.string().max(20).optional().allow(''),
  description: Joi.string().max(500).optional().allow(''),
  is_active: Joi.boolean().default(true),
  materials: Joi.array().items(materialSchema).default([])
});

export const createCourseSchema = Joi.object({
  name: Joi.string().max(100).required(),
  course_code: Joi.string().max(20).optional().allow(''),
  description: Joi.string().max(500).optional().allow(''),
  is_active: Joi.boolean().default(true)
});

export const updateCourseSchema = Joi.object({
  name: Joi.string().max(100).optional(),
  course_code: Joi.string().max(20).optional().allow(''),
  description: Joi.string().max(500).optional().allow(''),
  is_active: Joi.boolean().optional()
}).min(1);

// ==================== SECTION SCHEMA ====================

const sectionSchema = Joi.object({
  name: Joi.string().max(50).required().messages({
    'string.max': 'Section name must be at most 50 characters',
    'any.required': 'Section name is required'
  }),
  room_no: Joi.string().max(20).optional().allow(''),
  capacity: Joi.number().integer().min(1).optional(),
  is_active: Joi.boolean().default(true)
});

export const createSectionSchema = Joi.object({
  name: Joi.string().max(50).required(),
  room_no: Joi.string().max(20).optional().allow(''),
  capacity: Joi.number().integer().min(1).optional(),
  is_active: Joi.boolean().default(true)
});

export const updateSectionSchema = Joi.object({
  name: Joi.string().max(50).optional(),
  room_no: Joi.string().max(20).optional().allow(''),
  capacity: Joi.number().integer().min(1).optional(),
  is_active: Joi.boolean().optional()
}).min(1);

// ==================== CLASS SCHEMAS ====================

export const createCompleteClassSchema = Joi.object({
  // Basic Class Info
  name: Joi.string().max(100).required().messages({
    'string.max': 'Class name must be at most 100 characters',
    'any.required': 'Class name is required'
  }),
  description: Joi.string().max(500).optional().allow(''),
  grade_level: Joi.number().integer().min(1).max(12).optional(),
  
  // Academic Year
  academic_year_id: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid academic year ID',
    'any.required': 'Academic year is required'
  }),
  
  // Status
  is_active: Joi.boolean().default(true),
  
  // Fee Structure
  fee_structure: Joi.object({
    tuition_fee: Joi.number().min(0).optional(),
    admission_fee: Joi.number().min(0).optional(),
    exam_fee: Joi.number().min(0).optional(),
    sports_fee: Joi.number().min(0).optional()
  }).default({}),
  
  // Branch
  branch_id: Joi.string().uuid().optional().allow(null),
  
  // Nested Data
  sections: Joi.array().items(sectionSchema).default([]),
  courses: Joi.array().items(courseSchema).default([])
});

export const updateClassSchema = Joi.object({
  name: Joi.string().max(100).optional(),
  description: Joi.string().max(500).optional().allow(''),
  grade_level: Joi.number().integer().min(1).max(12).optional(),
  is_active: Joi.boolean().optional(),
  fee_structure: Joi.object({
    tuition_fee: Joi.number().min(0).optional(),
    admission_fee: Joi.number().min(0).optional(),
    exam_fee: Joi.number().min(0).optional(),
    sports_fee: Joi.number().min(0).optional()
  }).optional(),
  branch_id: Joi.string().uuid().optional().allow(null)
}).min(1);

// ==================== QUERY FILTERS SCHEMA ====================

export const classQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('name', 'grade_level', 'created_at', 'updated_at').default('created_at'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  academic_year_id: Joi.string().uuid().optional(),
  branch_id: Joi.string().uuid().optional(),
  is_active: Joi.boolean().optional(),
  search: Joi.string().max(100).optional()
});

export default {
  createCompleteClassSchema,
  updateClassSchema,
  createSectionSchema,
  updateSectionSchema,
  createCourseSchema,
  updateCourseSchema,
  createMaterialSchema,
  updateMaterialSchema,
  classIdParamSchema,
  sectionIdParamSchema,
  courseIdParamSchema,
  materialIdParamSchema,
  classQuerySchema
};