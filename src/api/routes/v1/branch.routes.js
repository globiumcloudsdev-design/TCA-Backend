// backend/src/api/routes/branch.routes.js (FIXED)

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as branchController from '../../controllers/branch.controller.js';
import { validate } from '../../middlewares/validation.middleware.js'; // ✅ Using your validation middleware
import { protect } from '../../middlewares/auth.middleware.js'; // ✅ Using your protect middleware
import Joi from 'joi';

const router = Router();

// All branch routes require authentication
router.use(protect);

// Joi validation schemas
const createBranchSchema = Joi.object({
  name: Joi.string().min(2).max(200).required().messages({
    'string.empty': 'Branch name is required',
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name must be less than 200 characters'
  }),
  code: Joi.string().max(50).optional().allow('', null),
  phone: Joi.string().optional().allow('', null),
  email: Joi.string().email().optional().allow('', null).messages({
    'string.email': 'Invalid email format'
  }),
  address: Joi.string().optional().allow('', null),
  city: Joi.string().optional().allow('', null),
  head_name: Joi.string().optional().allow('', null),
  head_user_id: Joi.string().uuid().optional().allow('', null).messages({
    'string.guid': 'Invalid user ID format'
  }),
  is_main: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).optional().allow(null),
    longitude: Joi.number().min(-180).max(180).optional().allow(null),
    address: Joi.string().optional().allow('', null),
    place_id: Joi.string().optional().allow('', null)
  }).optional(),
  settings: Joi.object({
    has_hostel: Joi.boolean().optional(),
    has_transport: Joi.boolean().optional(),
    has_library: Joi.boolean().optional(),
    has_lab: Joi.boolean().optional(),
    has_playground: Joi.boolean().optional(),
    has_cafeteria: Joi.boolean().optional(),
    has_mosque: Joi.boolean().optional(),
    has_parking: Joi.boolean().optional(),
    working_hours: Joi.object({
      monday: Joi.object({ open: Joi.string().allow(null), close: Joi.string().allow(null) }),
      tuesday: Joi.object({ open: Joi.string().allow(null), close: Joi.string().allow(null) }),
      wednesday: Joi.object({ open: Joi.string().allow(null), close: Joi.string().allow(null) }),
      thursday: Joi.object({ open: Joi.string().allow(null), close: Joi.string().allow(null) }),
      friday: Joi.object({ open: Joi.string().allow(null), close: Joi.string().allow(null) }),
      saturday: Joi.object({ open: Joi.string().allow(null), close: Joi.string().allow(null) }),
      sunday: Joi.object({ open: Joi.string().allow(null), close: Joi.string().allow(null) })
    }).optional()
  }).optional(),
  head: Joi.object({
    first_name: Joi.string().required(),
    last_name: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().optional().allow('', null),
    password: Joi.string().min(6).optional().allow('', null),
    permissions: Joi.array().items(Joi.string()).optional()
  }).optional()
});

const updateBranchSchema = Joi.object({
  name: Joi.string().min(2).max(200).optional(),
  code: Joi.string().max(50).optional().allow('', null),
  phone: Joi.string().optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
  address: Joi.string().optional().allow('', null),
  city: Joi.string().optional().allow('', null),
  head_name: Joi.string().optional().allow('', null),
  head_user_id: Joi.string().uuid().optional().allow('', null),
  is_main: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).optional().allow(null),
    longitude: Joi.number().min(-180).max(180).optional().allow(null),
    address: Joi.string().optional().allow('', null),
    place_id: Joi.string().optional().allow('', null)
  }).optional(),
    // 🔥 ADD THIS - head field for update
  head: Joi.object({
    first_name: Joi.string().min(2).optional(),
    last_name: Joi.string().min(2).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional().allow('', null),
    password: Joi.string().min(6).optional().allow('', null),
    permissions: Joi.array().items(Joi.string()).optional()
  }).optional(),
  settings: Joi.object().optional()
});

const toggleStatusSchema = Joi.object({
  is_active: Joi.boolean().required()
});

const branchIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid branch ID format'
  })
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().trim().optional().allow(''),
  status: Joi.string().valid('active', 'inactive').optional(),
  city: Joi.string().trim().optional().allow('')
});

/**
 * GET /api/branches
 * Get all branches with filters
 */
router.get(
  '/',
  validate(querySchema, 'query'), // ✅ Using your validate middleware
  branchController.getAllBranches
);

/**
 * GET /api/branches/options
 * Get branch options for dropdowns
 */
router.get(
  '/options',
  branchController.getBranchOptions
);

/**
 * GET /api/branches/stats
 * Get branch statistics
 */
router.get(
  '/stats',
  branchController.getBranchStats
);

/**
 * GET /api/branches/:id
 * Get single branch
 */
router.get(
  '/:id',
  validate(branchIdSchema, 'params'), // ✅ Using your validate middleware
  branchController.getBranchById
);

/**
 * POST /api/branches
 * Create new branch
 */
router.post(
  '/',
  validate(createBranchSchema, 'body'), // ✅ Using your validate middleware
  branchController.createBranch
);

/**
 * PUT /api/branches/:id
 * Update branch
 */
router.put(
  '/:id',
  validate(branchIdSchema, 'params'), // ✅ Validate ID first
  validate(updateBranchSchema, 'body'), // ✅ Then validate body
  branchController.updateBranch
);

/**
 * PATCH /api/branches/:id/toggle-status
 * Toggle branch status
 */
router.patch(
  '/:id/toggle-status',
  validate(branchIdSchema, 'params'), // ✅ Validate ID
  validate(toggleStatusSchema, 'body'), // ✅ Validate status
  branchController.toggleBranchStatus
);

/**
 * POST /api/branches/:id/settings
 * Update branch settings only
 */
router.post(
  '/:id/settings',
  validate(branchIdSchema, 'params'), // ✅ Validate ID
  validate(Joi.object().required(), 'body'), // ✅ Settings must be an object
  branchController.updateBranchSettings
);

/**
 * DELETE /api/branches/:id
 * Delete branch
 */
router.delete(
  '/:id',
  validate(branchIdSchema, 'params'), // ✅ Validate ID
  branchController.deleteBranch
);

export default router;