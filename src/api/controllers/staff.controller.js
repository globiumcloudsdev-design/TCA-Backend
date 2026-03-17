//backend/src/api/controllers
/**
 * The Clouds Academy — Staff Controller
 */

import { AppError } from '../../utils/lib/AppError.js';
import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/helpers/response.helper.js';
import * as staffService from '../../services/staff.service.js';
import models from '../../models/postgres/index.js';

const { sequelize } = models;

// ─── Get available roles for staff (from institute's assigned role) ───────────
export const getAvailableRoles = catchAsync(async (req, res) => {
  if (!req.institute) {
    return sendSuccess(res, [], 'No institute context');
  }
  
  const roles = await staffService.getAvailableRoles(req.institute.id);
  sendSuccess(res, roles, 'Available staff roles fetched');
});

// ─── Get all staff members ───────────────────────────────────────────────────
export const getAllStaff = catchAsync(async (req, res) => {
  if (!req.institute) {
    return sendPaginated(res, [], {
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0
    }, 'No institute context');
  }
  
  const result = await staffService.getAllStaff(req.institute.id, req.query);
  sendPaginated(res, result.rows, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages
  }, 'Staff members fetched');
});

// ─── Get single staff member ─────────────────────────────────────────────────
export const getStaffById = catchAsync(async (req, res) => {
  if (!req.institute) {
    throw new AppError('Institute context required', 400);
  }
  
  const staff = await staffService.getStaffById(req.params.id, req.institute.id);
  sendSuccess(res, staff, 'Staff member fetched');
});

// ─── Create staff member ─────────────────────────────────────────────────────
export const createStaff = catchAsync(async (req, res) => {
  if (!req.institute) {
    throw new AppError('Institute context required', 400);
  }
  
  // Handle multiple files - avatar and documents
  const avatarFile = req.files?.avatar ? req.files.avatar[0] : (req.file || null);
  const documentFiles = req.files?.documents || [];
  
  const result = await staffService.createStaff(
    req.institute.id,
    req.body,
    req.user.id,
    avatarFile,
    documentFiles
  );
  
  // Return with temp password for new staff
  sendCreated(res, {
    ...result.staff.toJSON(),
    temp_password: result.password,
    qr_code: result.qr_code
  }, 'Staff member created successfully');
});

// ─── Update staff member ─────────────────────────────────────────────────────
export const updateStaff = catchAsync(async (req, res) => {
  if (!req.institute) {
    throw new AppError('Institute context required', 400);
  }
  
  const avatarFile = req.files?.avatar ? req.files.avatar[0] : (req.file || null);
  const documentFiles = req.files?.documents || [];
  
  const staff = await staffService.updateStaff(
    req.params.id,
    req.institute.id,
    req.body,
    req.user.id,
    avatarFile,
    documentFiles
  );
  
  sendSuccess(res, staff, 'Staff member updated successfully');
});

// ─── Delete staff member ─────────────────────────────────────────────────────
export const deleteStaff = catchAsync(async (req, res) => {
  if (!req.institute) {
    throw new AppError('Institute context required', 400);
  }
  
  await staffService.deleteStaff(req.params.id, req.institute.id);
  sendNoContent(res);
});

// ─── Toggle staff status ─────────────────────────────────────────────────────
export const toggleStaffStatus = catchAsync(async (req, res) => {
  if (!req.institute) {
    throw new AppError('Institute context required', 400);
  }
  
  const staff = await staffService.toggleStaffStatus(
    req.params.id,
    req.institute.id,
    req.body.is_active
  );
  sendSuccess(res, staff, 'Staff status updated');
});

// ─── Update staff permissions ─────────────────────────────────────────────────
export const updateStaffPermissions = catchAsync(async (req, res) => {
  if (!req.institute) {
    throw new AppError('Institute context required', 400);
  }
  
  const staff = await staffService.updateStaffPermissions(
    req.params.id,
    req.institute.id,
    req.body.permissions
  );
  sendSuccess(res, staff, 'Staff permissions updated');
});

// ─── Regenerate QR code ─────────────────────────────────────────────────────
export const regenerateQRCode = catchAsync(async (req, res) => {
  if (!req.institute) {
    throw new AppError('Institute context required', 400);
  }
  
  const qrCodeUrl = await staffService.regenerateQRCode(
    req.params.id,
    req.institute.id
  );
  
  sendSuccess(res, { qr_code: qrCodeUrl }, 'QR Code regenerated successfully');
});