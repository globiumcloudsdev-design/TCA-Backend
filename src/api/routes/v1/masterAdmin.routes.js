
// backend/src/routes/v1/masterAdmin.routes.js
/**
 * The Clouds Academy — Master Admin Routes
 * Updated with new subscription, invoice, storage, and people endpoints
 */

import { Op } from 'sequelize';
import { Router } from 'express';
import { protect, isMasterAdmin } from '../../middlewares/auth.middleware.js';
import catchAsync from '../../../utils/lib/catchAsync.js';
import {
  sendSuccess, sendCreated, sendNoContent, sendPaginated
} from '../../../utils/helpers/response.helper.js';
import { AppError } from '../../../utils/lib/AppError.js';
import { PERMISSION_GROUPS, ALL_PERMISSION_CODES } from '../../../config/permissions.js';
import InstituteType from '../../../models/postgres/InstituteType.model.js';
import Role from '../../../models/postgres/Role.model.js';
import SubscriptionPlan from '../../../models/postgres/SubscriptionPlan.model.js';
import upload from '../../../config/multer.js';
import {
  getInstitutes,
  getInstituteById,
  createInstitute,
  updateInstitute,
  deleteInstitute,
  toggleStatus,
  updateSubscriptionStatus,
  updateInstitutePlan,
  getInstituteInvoices,
  markInvoicePaid,
  getSubscriptionHistory,
  getAllInvoices,
  // NEW FUNCTIONS
  getInstituteStorage,
  getInstituteDashboardStats,
  getInstituteStudents,
  getInstituteTeachers,
  getInstituteParents,
  getInstituteStaff
} from '../../controllers/institute.controller.js';

const router = Router();

// ── All routes require Master Admin ─────────────────────────────────────────
router.use(protect, isMasterAdmin);

// =============================================================================
// LOOKUP TABLES (for dropdowns)
// =============================================================================

// GET /master-admin/institute-types
router.get('/institute-types', catchAsync(async (req, res) => {
  const types = await InstituteType.findAll({
    where: { is_active: true },
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
    attributes: ['id', 'name', 'slug', 'icon', 'description'],
  });
  sendSuccess(res, types, 'Institute types fetched');
}));

// GET /master-admin/platform-roles (template roles, school_id = NULL)
router.get('/platform-roles', catchAsync(async (req, res) => {
  const roles = await Role.findAll({
    where: { school_id: null, is_template: true },
    order: [['name', 'ASC']],
    attributes: ['id', 'name', 'code', 'description'],
  });
  sendSuccess(res, roles, 'Platform roles fetched');
}));

// GET /master-admin/subscription-plans
router.get('/subscription-plans', catchAsync(async (req, res) => {
  const includeUnpublished = String(req.query.include_unpublished || 'false') === 'true';
  const includeInactive = String(req.query.include_inactive || 'false') === 'true';

  const where = {};
  if (!includeInactive) where.is_active = true;
  if (!includeUnpublished) where.is_published = true;

  const plans = await SubscriptionPlan.findAll({
    where,
    order: [['display_order', 'ASC'], ['price', 'ASC']],
    attributes: ['id', 'name', 'code', 'price', 'cycle', 'trial_days', 'limits', 'features', 'is_popular', 'is_published', 'is_active'],
  });
  sendSuccess(res, plans, 'Subscription plans fetched');
}));

// =============================================================================
// INSTITUTE CRUD
// =============================================================================

router.route('/institutes')
  .get(getInstitutes)
  .post(upload.single('institute_logo'), createInstitute);

router.route('/institutes/:id')
  .get(getInstituteById)
  .put(upload.single('institute_logo'), updateInstitute)
  .delete(deleteInstitute);

router.patch('/institutes/:id/status', toggleStatus);
router.patch('/institutes/:id/subscription-status', updateSubscriptionStatus);
router.patch('/institutes/:id/plan', updateInstitutePlan);

// =============================================================================
// NEW: INSTITUTE STORAGE & STATS (REAL DATA)
// =============================================================================

// GET /master-admin/institutes/:id/storage
router.get('/institutes/:id/storage', getInstituteStorage);

// GET /master-admin/institutes/:id/dashboard-stats
router.get('/institutes/:id/dashboard-stats', getInstituteDashboardStats);

// =============================================================================
// NEW: INSTITUTE PEOPLE (REAL DATA FROM DATABASE)
// =============================================================================

// GET /master-admin/institutes/:id/students
router.get('/institutes/:id/students', getInstituteStudents);

// GET /master-admin/institutes/:id/teachers
router.get('/institutes/:id/teachers', getInstituteTeachers);

// GET /master-admin/institutes/:id/parents
router.get('/institutes/:id/parents', getInstituteParents);

// GET /master-admin/institutes/:id/staff
router.get('/institutes/:id/staff', getInstituteStaff);

// =============================================================================
// INVOICE ROUTES
// =============================================================================

// GET /master-admin/invoices (all invoices across all institutes)
router.get('/invoices', getAllInvoices);

// GET /master-admin/institutes/:id/invoices
router.get('/institutes/:id/invoices', getInstituteInvoices);

// POST /master-admin/invoices/:id/mark-paid
router.post('/invoices/:id/mark-paid', markInvoicePaid);

// GET /master-admin/institutes/:id/subscription/history
router.get('/institutes/:id/subscription/history', getSubscriptionHistory);

// =============================================================================
// BACKWARD COMPATIBILITY ALIASES (/schools routes)
// =============================================================================

router.route('/schools')
  .get(getInstitutes)
  .post(upload.single('institute_logo'), createInstitute);

router.route('/schools/:id')
  .get(getInstituteById)
  .put(upload.single('institute_logo'), updateInstitute)
  .delete(deleteInstitute);

router.patch('/schools/:id/status', toggleStatus);
router.patch('/schools/:id/subscription-status', updateSubscriptionStatus);
router.patch('/schools/:id/plan', updateInstitutePlan);

// Backward compatibility for people routes
router.get('/schools/:id/students', getInstituteStudents);
router.get('/schools/:id/teachers', getInstituteTeachers);
router.get('/schools/:id/parents', getInstituteParents);
router.get('/schools/:id/staff', getInstituteStaff);
router.get('/schools/:id/storage', getInstituteStorage);
router.get('/schools/:id/dashboard-stats', getInstituteDashboardStats);

// Backward compatibility for invoice routes
router.get('/schools/:id/invoices', getInstituteInvoices);
router.get('/schools/:id/subscription/history', getSubscriptionHistory);

// =============================================================================
// PLATFORM TEMPLATE ROLES CRUD
// =============================================================================

// GET /master-admin/roles/permissions – grouped permission catalogue for UI
router.get('/roles/permissions', catchAsync(async (req, res) => {
  sendSuccess(res, PERMISSION_GROUPS, 'Permission catalogue');
}));

// GET /master-admin/roles – list all platform template roles
router.get('/roles', catchAsync(async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const where = { school_id: null };
  if (search) where.name = { [Op.iLike]: `%${search}%` };

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows } = await Role.findAndCountAll({
    where,
    order: [['name', 'ASC']],
    limit: parseInt(limit),
    offset,
    attributes: ['id', 'name', 'code', 'description', 'permissions', 'is_active', 'is_template', 'created_at'],
  });

  sendSuccess(res, {
    rows,
    total: count,
    page: parseInt(page),
    totalPages: Math.ceil(count / parseInt(limit)),
  }, 'Roles fetched');
}));

// POST /master-admin/roles – create new platform template role
router.post('/roles', catchAsync(async (req, res) => {
  const { name, code, description, permissions = [] } = req.body;
  if (!name) throw new AppError('Role name is required', 400);

  const safeCode = String(code || name).toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

  const existing = await Role.findOne({ where: { school_id: null, code: safeCode } });
  if (existing) throw new AppError(`Role code '${safeCode}' already exists.`, 409);

  // Store permissions as { instituteAdmin: [...] } to match permission middleware
  const permsObj = Array.isArray(permissions)
    ? { instituteAdmin: permissions }
    : permissions;

  const role = await Role.create({
    school_id: null,
    name,
    code: safeCode,
    description: description || null,
    permissions: permsObj,
    is_template: true,
    is_active: true,
    created_by: req.user?.id ?? null,
  });

  sendCreated(res, role, 'Role created successfully');
}));

// PUT /master-admin/roles/:id – update platform role
router.put('/roles/:id', catchAsync(async (req, res) => {
  const role = await Role.findByPk(req.params.id);
  if (!role) throw new AppError('Role not found', 404);

  const { name, description, permissions, is_active } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (is_active !== undefined) updates.is_active = is_active;
  if (permissions !== undefined) {
    updates.permissions = Array.isArray(permissions)
      ? { instituteAdmin: permissions }
      : permissions;
  }

  await role.update(updates);
  sendSuccess(res, await role.reload(), 'Role updated');
}));

// DELETE /master-admin/roles/:id – delete platform role
router.delete('/roles/:id', catchAsync(async (req, res) => {
  const role = await Role.findByPk(req.params.id);
  if (!role) throw new AppError('Role not found', 404);

  await role.destroy();
  sendNoContent(res);
}));

export default router;