/**
 * Leave Type Validators
 * Schema validation for leave type operations
 */

import Joi from 'joi';

/**
 * Create Leave Type Schema
 */
export const createLeaveTypeSchema = Joi.object({
  leave_type_name: Joi.string()
    .trim()
    .required()
    .max(100)
    .messages({
      'string.empty': 'Leave type name is required',
      'string.max': 'Leave type name cannot exceed 100 characters',
    }),
  description: Joi.string().max(500).allow('').optional(),
  max_days_per_year: Joi.number()
    .integer()
    .min(0)
    .max(365)
    .default(0)
    .optional(),
  is_paid: Joi.boolean().default(true).optional(),
  requires_approval: Joi.boolean().default(true).optional(),
  color_code: Joi.string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .default('#3B82F6')
    .optional()
    .messages({
      'string.pattern.base': 'Color code must be a valid hex color (e.g., #3B82F6)',
    }),
  branch_id: Joi.string().uuid().optional().allow(null, ''),
}).unknown(true);

/**
 * Update Leave Type Schema
 */
export const updateLeaveTypeSchema = Joi.object({
  leave_type_name: Joi.string()
    .trim()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Leave type name cannot exceed 100 characters',
    }),
  description: Joi.string().max(500).allow('').optional(),
  max_days_per_year: Joi.number()
    .integer()
    .min(0)
    .max(365)
    .optional(),
  is_paid: Joi.boolean().optional(),
  requires_approval: Joi.boolean().optional(),
  color_code: Joi.string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional()
    .messages({
      'string.pattern.base': 'Color code must be a valid hex color (e.g., #3B82F6)',
    }),
  is_active: Joi.boolean().optional(),
  branch_id: Joi.string().uuid().optional().allow(null, ''),
}).unknown(true);

/**
 * Get Leave Types Query Schema
 */
export const getLeaveTypesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
  is_active: Joi.string().valid('true', 'false').optional(),
  search: Joi.string().max(100).optional(),
  branch_id: Joi.string().uuid().optional().allow(null, ''),
}).unknown(true);
