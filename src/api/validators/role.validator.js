/**
 * The Clouds Academy - Role Validators
 */

import Joi from 'joi';

export const createRoleSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(50).uppercase().required(),
  description: Joi.string().max(500),
  permissionIds: Joi.array().items(Joi.string().uuid()).default([]),
});

export const updateRoleSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  description: Joi.string().max(500),
  permissionIds: Joi.array().items(Joi.string().uuid()),
});

export const assignRoleSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  roleId: Joi.string().uuid().required(),
});

export default { createRoleSchema, updateRoleSchema, assignRoleSchema };
