// src/validators/expenseCategory.validator.js
import Joi from 'joi';

export const createExpenseCategorySchema = Joi.object({
  name: Joi.string().max(100).required(),
  code: Joi.string().max(50).optional().allow('', null),
  parent_category: Joi.string().max(100).optional().allow('', null),
  budget_limit: Joi.number().positive().optional().allow(null),
  is_active: Joi.boolean().default(true),
  branch_id: Joi.string().uuid().optional().allow(null, ''),
}).unknown(true);

export const updateExpenseCategorySchema = Joi.object({
  name: Joi.string().max(100).optional(),
  code: Joi.string().max(50).optional().allow('', null),
  parent_category: Joi.string().max(100).optional().allow('', null),
  budget_limit: Joi.number().positive().optional().allow(null),
  is_active: Joi.boolean().optional(),
  branch_id: Joi.string().uuid().optional().allow(null, ''),
}).unknown(true);