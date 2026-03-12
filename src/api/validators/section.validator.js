/**
 * The Clouds Academy - Section Validator (Joi)
 */

import Joi from 'joi';

export const createSectionSchema = Joi.object({
  academic_year_id: Joi.string().uuid().required().messages({
    'any.required': 'Academic Year ID is required',
  }),
  name: Joi.string().max(10).required().messages({
    'any.required': 'Section name is required (e.g. "A", "B", "Morning")',
  }),
  capacity: Joi.number().integer().min(1).max(200).required().messages({
    'any.required': 'Capacity is required',
    'number.min': 'Capacity must be at least 1',
  }),
  room_number: Joi.string().max(20).optional().allow(''),
  section_teacher_id: Joi.string().uuid().optional().allow(null),
});

export const updateSectionSchema = Joi.object({
  name: Joi.string().max(10).optional(),
  capacity: Joi.number().integer().min(1).max(200).optional(),
  room_number: Joi.string().max(20).optional().allow(''),
  section_teacher_id: Joi.string().uuid().optional().allow(null),
  is_active: Joi.boolean().optional(),
});
