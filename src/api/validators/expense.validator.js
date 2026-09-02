// src/validators/expense.validator.js
import Joi from 'joi';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const createExpenseSchema = Joi.object({
  title: Joi.string().max(255).required(),
  amount: Joi.number().positive().required(),
  category: Joi.string().max(100).required(),
  vendor_id: Joi.string().optional().allow(null, ''),
  vendor_name: Joi.string().max(255).optional().allow(null, ''),
  date: Joi.date().required(),
  description: Joi.string().optional().allow('', null),
  status: Joi.string().valid('pending', 'approved', 'paid', 'rejected').default('pending'),
  receipt_url: Joi.string().max(500).optional().allow(null, ''),
  payment_reference: Joi.string().max(255).optional().allow(null, ''),
  branch_id: Joi.string().uuid().optional().allow(null, ''),
}).unknown(true).custom((value, helpers) => {
  const cleaned = { ...value };
  
  // Trim and clean vendor_id
  let vendorId = cleaned.vendor_id?.trim() || null;
  let vendorName = cleaned.vendor_name?.trim() || null;
  
  // If vendor_id is provided but is NOT a valid UUID, treat it as vendor_name
  if (vendorId && !uuidPattern.test(vendorId)) {
    // It's a vendor name, not an ID
    vendorName = vendorName || vendorId;
    vendorId = null;
  }
  
  cleaned.vendor_id = vendorId;
  cleaned.vendor_name = vendorName;
  
  // Either vendor_id or vendor_name must be provided
  if (!cleaned.vendor_id && !cleaned.vendor_name) {
    return helpers.error('any.required', { message: 'Either vendor_id (UUID) or vendor_name (string) must be provided' });
  }
  
  return cleaned;
});

export const updateExpenseSchema = Joi.object({
  title: Joi.string().max(255).optional(),
  amount: Joi.number().positive().optional(),
  category: Joi.string().max(100).optional(),
  vendor_id: Joi.string().optional().allow(null, ''),
  vendor_name: Joi.string().max(255).optional().allow(null, ''),
  date: Joi.date().optional(),
  description: Joi.string().optional().allow('', null),
  status: Joi.string().valid('pending', 'approved', 'paid', 'rejected').optional(),
  receipt_url: Joi.string().max(500).optional().allow(null, ''),
  payment_reference: Joi.string().max(255).optional().allow(null, ''),
  branch_id: Joi.string().uuid().optional().allow(null, ''),
}).unknown(true).custom((value, helpers) => {
  const cleaned = { ...value };
  
  // Trim and clean vendor_id
  let vendorId = cleaned.vendor_id?.trim() || null;
  let vendorName = cleaned.vendor_name?.trim() || null;
  
  // If vendor_id is provided but is NOT a valid UUID, treat it as vendor_name
  if (vendorId && !uuidPattern.test(vendorId)) {
    vendorName = vendorName || vendorId;
    vendorId = null;
  }
  
  cleaned.vendor_id = vendorId;
  cleaned.vendor_name = vendorName;
  
  return cleaned;
});