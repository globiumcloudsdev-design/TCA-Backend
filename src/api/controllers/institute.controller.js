
/**
 * The Clouds Academy — Institute Controller (Master Admin)
 * Updated with invoice summary and subscription tracking
 */

import { Op } from 'sequelize';
import sequelize from '../../config/database.js';
import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/helpers/response.helper.js';
import * as instituteService from '../../services/institute.service.js';
import { getInvoiceSummary } from '../../utils/subscriptionUtils.js';
import { logAuditAction } from '../../utils/helpers/auditLogger.js';

// GET /master-admin/institutes
export const getInstitutes = catchAsync(async (req, res) => {
  const result = await instituteService.getAllInstitutes(req.query, req.user);
  
  // Add invoice summary for each institute (optional, can be heavy for large lists)
  if (req.query.include_invoice_summary === 'true') {
    for (const institute of result.rows) {
      institute.dataValues.invoice_summary = await getInvoiceSummary(institute.id);
    }
  }
  
  res.json({ 
    success: true, 
    message: 'Institutes fetched', 
    data: result 
  });
});

// GET /master-admin/institutes/:id
export const getInstituteById = catchAsync(async (req, res) => {
  const inst = await instituteService.getInstituteById(req.params.id);
  
  // Get invoice summary for single institute
  const invoiceSummary = await getInvoiceSummary(req.params.id);
  
  // Get subscription status details
  const subscriptionDetails = await instituteService.getSubscriptionDetails(req.params.id);
  
  sendSuccess(res, {
    ...inst.toJSON(),
    invoice_summary: invoiceSummary,
    subscription_details: subscriptionDetails
  }, 'Institute fetched');
});

// POST /master-admin/institutes
export const createInstitute = catchAsync(async (req, res) => {
  const inst = await instituteService.createInstitute(
    req.body, 
    req.user.id, 
    req.file ?? null
  );
  
  await logAuditAction({
    req,
    action: 'CREATE_INSTITUTE',
    entity: 'Institute',
    entity_id: inst.id,
    new_values: inst.toJSON ? inst.toJSON() : inst,
    institute_id: inst.id
  });

  sendCreated(res, {
    ...inst.toJSON(),
    message: inst.subscription_status === 'trial' 
      ? 'Institute created with trial period' 
      : 'Institute created with active subscription'
  }, 'Institute created successfully');
});

// PUT /master-admin/institutes/:id
export const updateInstitute = catchAsync(async (req, res) => {
  const oldInst = await instituteService.getInstituteById(req.params.id);
  const old_values = oldInst.toJSON ? oldInst.toJSON() : oldInst;

  const inst = await instituteService.updateInstitute(
    req.params.id, 
    req.body, 
    req.file ?? null,
    req.user.id
  );

  await logAuditAction({
    req,
    action: 'UPDATE_INSTITUTE',
    entity: 'Institute',
    entity_id: inst.id || req.params.id,
    old_values,
    new_values: inst.toJSON ? inst.toJSON() : inst,
    institute_id: inst.id || req.params.id
  });

  sendSuccess(res, inst, 'Institute updated successfully');
});

// DELETE /master-admin/institutes/:id
export const deleteInstitute = catchAsync(async (req, res) => {
  const oldInst = await instituteService.getInstituteById(req.params.id);
  const old_values = oldInst.toJSON ? oldInst.toJSON() : oldInst;

  await instituteService.deleteInstitute(req.params.id);

  await logAuditAction({
    req,
    action: 'DELETE_INSTITUTE',
    entity: 'Institute',
    entity_id: req.params.id,
    old_values,
    institute_id: req.params.id
  });

  sendNoContent(res);
});

// PATCH /master-admin/institutes/:id/status
export const toggleStatus = catchAsync(async (req, res) => {
  const oldInst = await instituteService.getInstituteById(req.params.id);
  
  const inst = await instituteService.toggleInstituteStatus(
    req.params.id, 
    req.body.is_active,
    req.user.id
  );

  await logAuditAction({
    req,
    action: 'UPDATE_INSTITUTE_STATUS',
    entity: 'Institute',
    entity_id: req.params.id,
    old_values: { is_active: oldInst.is_active },
    new_values: { is_active: req.body.is_active },
    institute_id: req.params.id
  });

  sendSuccess(res, inst, 'Status updated');
});

/**
 * PATCH /master-admin/institutes/:id/restore
 * Restore a soft-deleted institute
 */
// PATCH /master-admin/institutes/:id/restore
export const restoreInstitute = catchAsync(async (req, res) => {
  const { id } = req.params;
  const restoredInstitute = await instituteService.restoreInstitute(id);
  
  await logAuditAction({
    req,
    action: 'RESTORE_INSTITUTE',
    entity: 'Institute',
    entity_id: id,
    institute_id: id
  });

  sendSuccess(res, restoredInstitute, 'Institute restored successfully');
});

// PATCH /master-admin/institutes/:id/subscription-status
export const updateSubscriptionStatus = catchAsync(async (req, res) => {
  const oldInst = await instituteService.getInstituteById(req.params.id);

  const inst = await instituteService.updateSubscriptionStatus(
    req.params.id, 
    req.body.subscription_status,
    req.user.id
  );

  await logAuditAction({
    req,
    action: 'UPDATE_SUBSCRIPTION_STATUS',
    entity: 'Institute',
    entity_id: req.params.id,
    old_values: { subscription_status: oldInst.subscription_status },
    new_values: { subscription_status: req.body.subscription_status },
    institute_id: req.params.id
  });

  sendSuccess(res, inst, 'Subscription status updated');
});

// NEW: PATCH /master-admin/institutes/:id/plan
export const updateInstitutePlan = catchAsync(async (req, res) => {
  const { planId, effectiveDate } = req.body;
  const inst = await instituteService.updateInstitutePlan(
    req.params.id, 
    planId, 
    effectiveDate ? new Date(effectiveDate) : new Date()
  );

  await logAuditAction({
    req,
    action: 'UPDATE_INSTITUTE_PLAN',
    entity: 'Institute',
    entity_id: req.params.id,
    new_values: { plan_id: planId, effective_date: effectiveDate },
    institute_id: req.params.id
  });

  sendSuccess(res, inst, 'Subscription plan updated successfully. New invoice generated.');
});

// NEW: POST /master-admin/institutes/:id/invoices/manual
export const createManualInvoice = catchAsync(async (req, res) => {
  const invoice = await instituteService.createManualInvoice(
    req.params.id,
    req.body,
    req.user.id
  );

  await logAuditAction({
    req,
    action: 'CREATE_MANUAL_INVOICE',
    entity: 'Invoice',
    entity_id: invoice.id,
    new_values: req.body,
    institute_id: req.params.id
  });

  sendSuccess(res, invoice, 'Manual invoice created successfully');
});

// NEW: GET /master-admin/institutes/:id/invoices
export const getInstituteInvoices = catchAsync(async (req, res) => {
  const invoices = await instituteService.getInstituteInvoices(
    req.params.id, 
    req.query
  );
  sendSuccess(res, invoices, 'Invoices fetched successfully');
});

// NEW: POST /master-admin/invoices/:id/mark-paid
export const markInvoicePaid = catchAsync(async (req, res) => {
  const { payment_method, payment_reference, notes } = req.body;
  const invoice = await instituteService.markInvoicePaid(
    req.params.id,
    {
      payment_method,
      payment_reference,
      notes,
      paid_by: req.user.id
    }
  );

  await logAuditAction({
    req,
    action: 'MARK_INVOICE_PAID',
    entity: 'Invoice',
    entity_id: req.params.id,
    new_values: { payment_method, payment_reference, notes },
    institute_id: invoice.institute_id
  });

  sendSuccess(res, invoice, 'Invoice marked as paid');
});

// NEW: DELETE /master-admin/invoices/:id
export const deleteInvoice = catchAsync(async (req, res) => {
  await instituteService.deleteInvoice(req.params.id);

  await logAuditAction({
    req,
    action: 'DELETE_INVOICE',
    entity: 'Invoice',
    entity_id: req.params.id
  });

  sendNoContent(res);
});

// NEW: POST /master-admin/invoices/bulk-delete
export const bulkDeleteInvoices = catchAsync(async (req, res) => {
  await instituteService.bulkDeleteInvoices(req.body.ids);

  await logAuditAction({
    req,
    action: 'BULK_DELETE_INVOICES',
    entity: 'Invoice',
    new_values: { ids: req.body.ids }
  });

  sendNoContent(res);
});

// NEW: GET /master-admin/institutes/:id/subscription/history
export const getSubscriptionHistory = catchAsync(async (req, res) => {
  const history = await instituteService.getSubscriptionHistory(req.params.id);
  sendSuccess(res, history, 'Subscription history fetched');
});

// NEW: GET /master-admin/invoices  — all invoices across all institutes
export const getAllInvoices = catchAsync(async (req, res) => {
  const result = await instituteService.getAllInvoices(req.query, req.user);
  sendSuccess(res, result, 'All invoices fetched successfully');
});


// backend/src/controllers/institute.controller.js
// Add these new functions

/**
 * Get institute storage usage from Cloudinary
 */
export const getInstituteStorage = catchAsync(async (req, res) => {
  const { id } = req.params;
  
  const storage = await instituteService.getInstituteStorageUsage(id);
  
  sendSuccess(res, storage, 'Storage usage fetched');
});

/**
 * Get institute dashboard stats with real counts
 */
export const getInstituteDashboardStats = catchAsync(async (req, res) => {
  const { id } = req.params;
  
  const stats = await instituteService.getInstituteDashboardStats(id);
  
  sendSuccess(res, stats, 'Dashboard stats fetched');
});

/**
 * Get real institute students
 */
export const getInstituteStudents = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10, search, status } = req.query;
  
  const result = await instituteService.getInstituteStudents(id, {
    page: parseInt(page),
    limit: parseInt(limit),
    search,
    status
  });
  
  sendPaginated(res, result.data, result.pagination, 'Students fetched');
});

/**
 * Get real institute teachers
 */
export const getInstituteTeachers = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10, search, status } = req.query;
  
  const result = await instituteService.getInstituteTeachers(id, {
    page: parseInt(page),
    limit: parseInt(limit),
    search,
    status
  });
  
  sendPaginated(res, result.data, result.pagination, 'Teachers fetched');
});

/**
 * Get real institute parents
 */
export const getInstituteParents = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10, search, status } = req.query;
  
  const result = await instituteService.getInstituteParents(id, {
    page: parseInt(page),
    limit: parseInt(limit),
    search,
    status
  });
  
  sendPaginated(res, result.data, result.pagination, 'Parents fetched');
});

/**
 * Get real institute staff
 */
export const getInstituteStaff = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10, search, status } = req.query;
  
  const result = await instituteService.getInstituteStaff(id, {
    page: parseInt(page),
    limit: parseInt(limit),
    search,
    status
  });
  
  sendPaginated(res, result.data, result.pagination, 'Staff fetched');
});

/**
 * Get all users of an institute (for Ghost Mode)
 * Includes Students, Teachers, Parents, Admin, etc.
 */
export const getInstituteAllUsers = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;
  const { User } = sequelize.models;
  
  const where = { school_id: id };
  if (search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${search}%` } },
      { last_name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { registration_no: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const users = await User.findAll({
    where,
    order: [['first_name', 'ASC']],
    attributes: ['id', 'first_name', 'last_name', 'email', 'registration_no', 'user_type', 'is_active', 'avatar_url']
  });

  sendSuccess(res, users, 'All institute users fetched');
});

/**
 * Get master admin reports
 */
export const getMasterAdminReports = catchAsync(async (req, res) => {
  const reports = await instituteService.getMasterAdminReports(req.query);
  sendSuccess(res, reports, 'Reports generated successfully');
});