//src/api/controllers/policy.controller.js
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound,
  sendBadRequest
} from '../../utils/helpers/response.helper.js';
import * as policyService from '../../services/policy.service.js';
import models from '../../models/postgres/index.js';

const { sequelize } = models;

/**
 * Helper to get institute ID from request
 */
const getInstituteId = (req) => {
  return req.user?.institute_id || req.user?.school_id || req.user?.schoolId;
};

/**
 * Helper to get branch ID from request
 */
const getBranchId = (req) => {
  return req.user?.branch_id || req.body?.branch_id || req.query?.branch_id;
};

/**
 * Create policy
 * POST /api/v1/policies
 */
export const createPolicy = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      await transaction.rollback();
      return sendBadRequest(res, 'Institute ID not found');
    }

    const branchId = getBranchId(req);

    const policyData = {
      ...req.body,
      institute_id: instituteId,
      branch_id: branchId,
      created_by: req.user.id,
      updated_by: req.user.id
    };

    const policy = await policyService.createPolicy(policyData, { transaction });
    await transaction.commit();
    return sendCreated(res, policy, 'Policy created successfully');
  } catch (error) {
    await transaction.rollback();
    return sendError(res, error.message || 'Failed to create policy');
  }
};

/**
 * Get all policies with pagination
 * GET /api/v1/policies
 */
export const getAllPolicies = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendBadRequest(res, 'Institute ID not found');
    }

    const filters = {
      institute_id: instituteId,
      branch_id: req.query.branch_id,
      policy_type: req.query.policy_type,
      is_active: req.query.is_active,
      search: req.query.search
    };

    const pagination = {
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'DESC'
    };

    const result = await policyService.getAllPolicies(filters, pagination);
    return sendPaginated(res, result.data, result.pagination, 'Policies fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch policies');
  }
};

/**
 * Get policy by ID
 * GET /api/v1/policies/:id
 */
export const getPolicyById = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendBadRequest(res, 'Institute ID not found');
    }

    const policy = await policyService.getPolicyById(id, instituteId);
    return sendSuccess(res, policy, 'Policy fetched successfully');
  } catch (error) {
    if (error.message === 'Policy not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to fetch policy');
  }
};

/**
 * Update policy
 * PUT /api/v1/policies/:id
 */
export const updatePolicy = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      await transaction.rollback();
      return sendBadRequest(res, 'Institute ID not found');
    }

    const updateData = {
      ...req.body,
      updated_by: req.user.id
    };

    const policy = await policyService.updatePolicy(id, instituteId, updateData, { transaction });
    await transaction.commit();
    return sendSuccess(res, policy, 'Policy updated successfully');
  } catch (error) {
    await transaction.rollback();
    if (error.message === 'Policy not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update policy');
  }
};

/**
 * Delete policy
 * DELETE /api/v1/policies/:id
 */
export const deletePolicy = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      await transaction.rollback();
      return sendBadRequest(res, 'Institute ID not found');
    }

    const result = await policyService.deletePolicy(id, instituteId, { transaction });
    await transaction.commit();
    return sendSuccess(res, null, result.message);
  } catch (error) {
    await transaction.rollback();
    if (error.message === 'Policy not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to delete policy');
  }
};

/**
 * Toggle policy status (activate/deactivate)
 * PATCH /api/v1/policies/:id/toggle-status
 */
export const togglePolicyStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      await transaction.rollback();
      return sendBadRequest(res, 'Institute ID not found');
    }

    if (is_active === undefined) {
      await transaction.rollback();
      return sendBadRequest(res, 'is_active field is required');
    }

    const policy = await policyService.togglePolicyStatus(id, instituteId, is_active, req.user.id);
    await transaction.commit();
    return sendSuccess(res, policy, `Policy ${is_active ? 'activated' : 'deactivated'} successfully`);
  } catch (error) {
    await transaction.rollback();
    if (error.message === 'Policy not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to toggle policy status');
  }
};

/**
 * Get active policy by type
 * GET /api/v1/policies/active/:type
 */
export const getActivePolicyByType = async (req, res) => {
  try {
    const { type } = req.params;
    const instituteId = getInstituteId(req);
    const branchId = getBranchId(req);

    if (!instituteId) {
      return sendBadRequest(res, 'Institute ID not found');
    }

    const policy = await policyService.getActivePolicyByType(instituteId, type, branchId);
    if (!policy) {
      return sendNotFound(res, `No active policy found for type: ${type}`);
    }
    return sendSuccess(res, policy, 'Active policy fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch active policy');
  }
};

/**
 * Get policy options for dropdown
 * GET /api/v1/policies/options
 */
export const getPolicyOptions = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const { policy_type } = req.query;

    if (!instituteId) {
      return sendBadRequest(res, 'Institute ID not found');
    }

    const options = await policyService.getPolicyOptions(instituteId, policy_type);
    return sendSuccess(res, options, 'Policy options fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch policy options');
  }
};

/**
 * Get policies by type
 * GET /api/v1/policies/type/:type
 */
export const getPoliciesByType = async (req, res) => {
  try {
    const { type } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendBadRequest(res, 'Institute ID not found');
    }

    const policies = await policyService.getPoliciesByType(instituteId, type);
    return sendSuccess(res, policies, 'Policies fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch policies by type');
  }
};