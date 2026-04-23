// src/validators/vendor.validator.js
import Joi from 'joi';

export const createVendorSchema = Joi.object({
  name: Joi.string().max(255).required(),
  type: Joi.string().max(100).required(),
  phone: Joi.string().max(50).required(),
  email: Joi.string().email().max(255).optional().allow('', null),
  address: Joi.string().optional().allow('', null),
  password: Joi.string().min(4).max(255).required(),
  assigned_student_ids: Joi.array().items(Joi.string()).default([]),
  cnic: Joi.string().max(20).optional().allow('', null),
  bank_account: Joi.object({
    bank_name: Joi.string().optional(),
    account_title: Joi.string().optional(),
    account_number: Joi.string().optional(),
    iban: Joi.string().optional(),
  }).optional().allow(null),
  status: Joi.string().valid('active', 'inactive').default('active'),
  is_active: Joi.boolean().default(true),
  notes: Joi.string().optional().allow('', null),
  avatar_url: Joi.string().optional().allow('', null),
  avatar_public_id: Joi.string().optional().allow('', null),
  qr_code_url: Joi.string().optional().allow('', null),
  qr_code_public_id: Joi.string().optional().allow('', null),
  email_verified: Joi.boolean().default(false),
});

export const updateVendorSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  type: Joi.string().max(100).optional(),
  phone: Joi.string().max(50).optional(),
  email: Joi.string().email().max(255).optional().allow('', null),
  address: Joi.string().optional().allow('', null),
  password: Joi.string().min(4).max(255).optional(),
  assigned_student_ids: Joi.array().items(Joi.string()).optional(),
  cnic: Joi.string().max(20).optional().allow('', null),
  bank_account: Joi.object({
    bank_name: Joi.string().optional(),
    account_title: Joi.string().optional(),
    account_number: Joi.string().optional(),
    iban: Joi.string().optional(),
  }).optional().allow(null),
  status: Joi.string().valid('active', 'inactive').optional(),
  is_active: Joi.boolean().optional(),
  notes: Joi.string().optional().allow('', null),
  avatar_url: Joi.string().optional().allow('', null),
  avatar_public_id: Joi.string().optional().allow('', null),
  qr_code_url: Joi.string().optional().allow('', null),
  qr_code_public_id: Joi.string().optional().allow('', null),
  email_verified: Joi.boolean().optional(),
});

export const assignStudentsSchema = Joi.object({
  student_ids: Joi.array().items(Joi.string()).required(),
});