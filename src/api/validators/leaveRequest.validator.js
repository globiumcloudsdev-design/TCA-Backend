// src/api/validators/leaveRequest.validator.js
import Joi from 'joi';

export const createLeaveRequestSchema = Joi.object({
  leave_type_id: Joi.string().uuid().required(),
  child_id: Joi.string().uuid().optional().allow(null),
  branch_id: Joi.string().uuid().optional().allow(null),
  from_date: Joi.date().iso().required(),
  to_date: Joi.date().iso().min(Joi.ref('from_date')).required(),
  number_of_days: Joi.number().positive().required(),
  reason: Joi.string().max(1000).optional().allow(''),
  supporting_document: Joi.string().optional().allow(null),
});

export const adminMarkLeaveSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  leave_type_id: Joi.string().uuid().required(),
  from_date: Joi.date().iso().required(),
  to_date: Joi.date().iso().min(Joi.ref('from_date')).required(),
  number_of_days: Joi.number().positive().required(),
  reason: Joi.string().max(1000).optional().allow(''),
  approve_immediately: Joi.boolean().optional().default(false),
});

export const updateLeaveRequestSchema = Joi.object({
  reason: Joi.string().max(1000).optional().allow(''),
  supporting_document: Joi.string().optional().allow(null),
});

export const approveRejectLeaveSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED').required(),
  approval_remarks: Joi.string().max(500).optional().allow(''),
});

export const getMyLeaveRequestsQuerySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(10),
  status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED').optional(),
  child_id: Joi.string().uuid().optional(),
  from_date: Joi.date().iso().optional(),
  to_date: Joi.date().iso().optional(),
  sortBy: Joi.string().valid('created_at', 'from_date', 'status').default('created_at'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
});

export const getLeaveRequestsQuerySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(10),
  status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED').optional(),
  user_type: Joi.string().valid('STAFF', 'STUDENT', 'TEACHER').optional(),
  user_id: Joi.string().uuid().optional(),
  leave_type_id: Joi.string().uuid().optional(),
  branch_id: Joi.string().uuid().optional(),
  from_date: Joi.date().iso().optional(),
  to_date: Joi.date().iso().optional(),
  sortBy: Joi.string().valid('created_at', 'from_date', 'status', 'user_id').default('created_at'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  search: Joi.string().optional(),
});

export const cancelLeaveRequestSchema = Joi.object({
  reason: Joi.string().max(500).optional().allow(''),
});
