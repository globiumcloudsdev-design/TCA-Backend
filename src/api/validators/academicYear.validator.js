/**
 * The Clouds Academy - AcademicYear Validator
 * 
 * File: /src/validators/academicYear.validator.js
 */

import Joi from 'joi';

export const createAcademicYearSchema = Joi.object({
  name: Joi.string().max(20).required().messages({
    'string.max': 'Name must be at most 20 characters',
    'any.required': 'Academic year name is required'
  }),
  
  start_date: Joi.date().iso().required().messages({
    'any.required': 'Start date is required'
  }),
  
  end_date: Joi.date().iso().greater(Joi.ref('start_date')).required().messages({
    'date.greater': 'End date must be after start date',
    'any.required': 'End date is required'
  }),
  
  is_current: Joi.boolean().default(false),
  is_active: Joi.boolean().default(true),
  description: Joi.string().max(500).optional().allow('', null),
  institute_id: Joi.string().optional(), // Controller uses auth user's institute_id, body value is ignored
});

export const updateAcademicYearSchema = Joi.object({
  name: Joi.string().max(20).optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
  is_current: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  description: Joi.string().max(500).optional().allow('', null),
  institute_id: Joi.string().optional(),
}).min(1);