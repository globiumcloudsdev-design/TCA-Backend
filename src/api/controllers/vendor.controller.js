import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound,
} from '../../utils/helpers/response.helper.js';
import * as vendorService from '../../services/vendor.service.js';
import models from '../../models/postgres/index.js';
import { getInstituteId, getBranchId } from '../../utils/helpers/request.helper.js';

const { sequelize } = models;

/**
 * Create vendor
 */
export const createVendor = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const branchId = getBranchId(req);
    
    const vendorData = {
      ...req.body,
      institute_id: instituteId,
      branch_id: req.isBranchRestricted ? req.allowedBranchId : (branchId || req.body.branch_id || null),
      created_by: req.user.id,
    };
    
    const vendor = await vendorService.createVendor(vendorData, { transaction });
    await transaction.commit();
    return sendCreated(res, vendor, 'Vendor created successfully');
  } catch (error) {
    await transaction.rollback();
    return sendError(res, error.message || 'Failed to create vendor');
  }
};

/**
 * Get all vendors
 */
export const getAllVendors = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const branchId = getBranchId(req);
    
    const filters = {
      institute_id: instituteId,
      branch_id: branchId,
      type: req.query.type,
      status: req.query.status,
      search: req.query.search,
    };
    
    const pagination = {
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      sortBy: req.query.sortBy || 'name',
      sortOrder: req.query.sortOrder || 'ASC',
    };
    
    const result = await vendorService.getAllVendors(filters, pagination);
    return sendPaginated(res, result.data, result.pagination, 'Vendors fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch vendors');
  }
};

/**
 * Get vendor by ID
 */
export const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const branchId = getBranchId(req);
    const vendor = await vendorService.getVendorById(id, instituteId, branchId);
    if (!vendor) {
      return sendNotFound(res, 'Vendor not found');
    }
    return sendSuccess(res, vendor, 'Vendor fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch vendor');
  }
};

/**
 * Get vendor options for dropdown (creatable select)
 */
export const getVendorOptions = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const branchId = getBranchId(req);
    const type = req.query.type;
    
    const options = await vendorService.getVendorOptions(instituteId, branchId, type);
    return sendSuccess(res, options, 'Vendor options fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch vendor options');
  }
};

/**
 * Get vendor types
 */
export const getVendorTypes = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const types = await vendorService.getVendorTypes(instituteId);
    return sendSuccess(res, types, 'Vendor types fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch vendor types');
  }
};

/**
 * Update vendor
 */
export const updateVendor = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const branchId = getBranchId(req);
    const vendor = await vendorService.updateVendor(id, instituteId, req.body, { 
      transaction, 
      branch_id: req.isBranchRestricted ? req.allowedBranchId : branchId 
    });
    await transaction.commit();
    return sendSuccess(res, vendor, 'Vendor updated successfully');
  } catch (error) {
    await transaction.rollback();
    if (error.message === 'Vendor not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update vendor');
  }
};

/**
 * Delete vendor
 */
export const deleteVendor = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const branchId = getBranchId(req);
    const result = await vendorService.deleteVendor(id, instituteId, { 
      transaction, 
      branch_id: req.isBranchRestricted ? req.allowedBranchId : branchId 
    });
    await transaction.commit();
    return sendSuccess(res, null, result.message);
  } catch (error) {
    await transaction.rollback();
    if (error.message === 'Vendor not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to delete vendor');
  }
};

/**
 * Assign students to vendor
 */
export const assignStudentsToVendor = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { student_ids } = req.body;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const branchId = getBranchId(req);
    const vendor = await vendorService.assignStudentsToVendor(id, instituteId, student_ids || [], { 
      transaction, 
      branch_id: req.isBranchRestricted ? req.allowedBranchId : branchId 
    });
    await transaction.commit();
    return sendSuccess(res, vendor, 'Students assigned successfully');
  } catch (error) {
    await transaction.rollback();
    if (error.message === 'Vendor not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to assign students');
  }
};