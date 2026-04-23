// src/validators/policy.validator.js
import Joi from 'joi';

const policyTypes = [
  'id_card',
  'payroll'
];

export const createPolicySchema = Joi.object({
  institute_id: Joi.string().uuid().optional(),
  policy_type: Joi.string().valid(...policyTypes).required(),
  policy_name: Joi.string().max(255).required(),
  description: Joi.string().optional().allow(''),
  config: Joi.object().required(),
  branch_id: Joi.string().uuid().optional().allow(null),
  is_active: Joi.boolean().default(true)
});

export const updatePolicySchema = Joi.object({
  policy_name: Joi.string().max(255).optional(),
  description: Joi.string().optional().allow(''),
  config: Joi.object().optional(),
  branch_id: Joi.string().uuid().optional().allow(null),
  is_active: Joi.boolean().optional()
});

export const togglePolicyStatusSchema = Joi.object({
  is_active: Joi.boolean().required()
});

export const getPoliciesQuerySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(10),
  policy_type: Joi.string().valid(...policyTypes).optional(),
  is_active: Joi.boolean().optional(),
  search: Joi.string().optional(),
  sortBy: Joi.string().valid('policy_name', 'policy_type', 'version', 'created_at', 'updated_at').default('created_at'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  branch_id: Joi.string().uuid().optional()
});