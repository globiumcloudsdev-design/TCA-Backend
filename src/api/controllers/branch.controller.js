// backend/src/api/controllers/branch.controller.js

/**
 * The Clouds Academy - Branch Controller
 */

import * as branchService from '../../services/branch.service.js';
import catchAsync from '../../utils/lib/catchAsync.js';
import { 
  sendSuccess, 
  sendCreated, 
  sendNoContent, 
  sendPaginated,
  sendError 
} from '../../utils/helpers/response.helper.js';

/**
 * Get all branches
 * GET /api/v1/branches
 */
export const getAllBranches = catchAsync(async (req, res) => {
  // Get institute ID from multiple possible sources
  const instituteId = req.institute?.id || req.user?.institute_id || req.user?.school_id;
  
  const filters = {
    institute_id: instituteId,
    search: req.query.search,
    status: req.query.status || (req.query.is_active === 'true' || req.query.is_active === true ? 'active' : (req.query.is_active === 'false' || req.query.is_active === false ? 'inactive' : undefined)),
    city: req.query.city,
    is_main: req.query.is_main
  };

  const pagination = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10
  };

  const result = await branchService.getAllBranches(filters, pagination);

  return sendPaginated(
    res, 
    result.data, 
    result.pagination, 
    'Branches fetched successfully'
  );
});

/**
 * Get branch options for dropdown
 * GET /api/v1/branches/options
 */
export const getBranchOptions = catchAsync(async (req, res) => {
  const instituteId = req.institute?.id || req.user?.institute_id || req.user?.school_id;
  
  const options = await branchService.getBranchOptions(instituteId);
  
  return sendSuccess(res, options, 'Branch options fetched successfully');
});

/**
 * Get branch by ID
 * GET /api/v1/branches/:id
 */
export const getBranchById = catchAsync(async (req, res) => {
  const instituteId = req.institute?.id || req.user?.institute_id || req.user?.school_id;
  
  const branch = await branchService.getBranchById(req.params.id, instituteId);

  if (!branch) {
    return sendError(res, 'Branch not found', 404);
  }

  return sendSuccess(res, branch, 'Branch fetched successfully');
});

/**
 * Create new branch
 * POST /api/v1/branches
 */
export const createBranch = catchAsync(async (req, res) => {
  const instituteId = req.institute?.id || req.user?.institute_id || req.user?.school_id;
  
  const branchData = {
    ...req.body,
    institute_id: instituteId,
    created_by: req.user?.id,
    updated_by: req.user?.id
  };

  const branch = await branchService.createBranch(branchData);

  return sendCreated(res, branch, 'Branch created successfully');
});

/**
 * Update branch
 * PUT /api/v1/branches/:id
 */
export const updateBranch = catchAsync(async (req, res) => {
  const instituteId = req.institute?.id || req.user?.institute_id || req.user?.school_id;
  
  console.log('📥 Update branch request body:', JSON.stringify(req.body, null, 2));
  
  const updateData = {
    ...req.body,
    updated_by: req.user?.id
  };

  try {
    const branch = await branchService.updateBranch(
      req.params.id,
      instituteId,
      updateData
    );

    if (!branch) {
      return sendError(res, 'Branch not found', 404);
    }

    return sendSuccess(res, branch, 'Branch updated successfully');
  } catch (error) {
    console.error('❌ Update branch error:', error);
    // Send proper error message
    return sendError(res, error.message || 'Failed to update branch', 400);
  }
});

/**
 * Toggle branch status
 * PATCH /api/v1/branches/:id/status
 */
export const toggleBranchStatus = catchAsync(async (req, res) => {
  const instituteId = req.institute?.id || req.user?.institute_id || req.user?.school_id;
  
  const branch = await branchService.toggleBranchStatus(
    req.params.id,
    instituteId,
    req.body.is_active
  );

  if (!branch) {
    return sendError(res, 'Branch not found', 404);
  }

  return sendSuccess(
    res, 
    branch, 
    `Branch ${req.body.is_active ? 'activated' : 'deactivated'} successfully`
  );
});

/**
 * Update branch settings
 * POST /api/v1/branches/:id/settings
 */
export const updateBranchSettings = catchAsync(async (req, res) => {
  const instituteId = req.institute?.id || req.user?.institute_id || req.user?.school_id;
  
  const branch = await branchService.updateBranchSettings(
    req.params.id,
    instituteId,
    req.body
  );

  if (!branch) {
    return sendError(res, 'Branch not found', 404);
  }

  return sendSuccess(res, branch, 'Branch settings updated successfully');
});

/**
 * Delete branch
 * DELETE /api/v1/branches/:id
 */
export const deleteBranch = catchAsync(async (req, res) => {
  const instituteId = req.institute?.id || req.user?.institute_id || req.user?.school_id;
  
  const result = await branchService.deleteBranch(
    req.params.id,
    instituteId,
    req.user?.id
  );

  if (!result) {
    return sendError(res, 'Branch not found', 404);
  }

  return sendNoContent(res);
});

/**
 * Get branch statistics
 * GET /api/v1/branches/stats
 */
export const getBranchStats = catchAsync(async (req, res) => {
  const instituteId = req.institute?.id || req.user?.institute_id || req.user?.school_id;
  
  const stats = await branchService.getBranchStats(instituteId);
  
  return sendSuccess(res, stats, 'Branch statistics fetched successfully');
});