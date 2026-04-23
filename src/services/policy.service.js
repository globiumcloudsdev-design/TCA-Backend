// src/services/policy.service.js
import models from '../models/postgres/index.js';
import { Op } from 'sequelize';

const { Policy, sequelize } = models;

/**
 * Create policy
 * @param {Object} data - Policy data
 * @param {Object} options - Transaction options
 */
export const createPolicy = async (data, options = {}) => {
  const { transaction } = options;
  
  const policy = await Policy.create(data, { transaction });
  
  return await Policy.findByPk(policy.id, {
    include: [
      { model: models.User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }
    ],
    transaction
  });
};

/**
 * Get all policies with filters and pagination
 * @param {Object} filters - { institute_id, branch_id, policy_type, is_active, search }
 * @param {Object} pagination - { page, limit, sortBy, sortOrder }
 */
export const getAllPolicies = async (filters = {}, pagination = {}) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'created_at', 
    sortOrder = 'DESC' 
  } = pagination;
  const offset = (page - 1) * limit;

  const where = { institute_id: filters.institute_id };
  
  if (filters.branch_id) where.branch_id = filters.branch_id;
  if (filters.policy_type) where.policy_type = filters.policy_type;
  if (filters.is_active !== undefined) where.is_active = filters.is_active;
  
  if (filters.search) {
    where[Op.or] = [
      { policy_name: { [Op.iLike]: `%${filters.search}%` } },
      { description: { [Op.iLike]: `%${filters.search}%` } }
    ];
  }

  const { count, rows } = await Policy.findAndCountAll({
    where,
    include: [
      { model: models.User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] },
      { model: models.User, as: 'updater', attributes: ['id', 'first_name', 'last_name'] }
    ],
    order: [[sortBy, sortOrder]],
    limit,
    offset,
  });

  return {
    data: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    }
  };
};

/**
 * Get policy by ID
 * @param {string} id - Policy UUID
 * @param {string} instituteId - Institute ID for authorization
 */
export const getPolicyById = async (id, instituteId) => {
  const policy = await Policy.findOne({
    where: { id, institute_id: instituteId },
    include: [
      { model: models.User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] },
      { model: models.User, as: 'updater', attributes: ['id', 'first_name', 'last_name'] }
    ]
  });
  
  if (!policy) {
    throw new Error('Policy not found');
  }
  
  return policy;
};

/**
 * Update policy
 * @param {string} id - Policy UUID
 * @param {string} instituteId - Institute ID for authorization
 * @param {Object} updateData - Data to update
 * @param {Object} options - Transaction options
 */
export const updatePolicy = async (id, instituteId, updateData, options = {}) => {
  const { transaction } = options;
  
  const policy = await Policy.findOne({
    where: { id, institute_id: instituteId }
  });
  
  if (!policy) {
    throw new Error('Policy not found');
  }
  
  await policy.update({
    ...updateData,
    version: policy.version + 1,
    updated_by: updateData.updated_by
  }, { transaction });
  
  return await Policy.findByPk(policy.id, {
    include: [
      { model: models.User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] },
      { model: models.User, as: 'updater', attributes: ['id', 'first_name', 'last_name'] }
    ],
    transaction
  });
};

/**
 * Delete policy (hard delete)
 * @param {string} id - Policy UUID
 * @param {string} instituteId - Institute ID for authorization
 */
export const deletePolicy = async (id, instituteId, options = {}) => {
  const { transaction } = options;
  
  const policy = await Policy.findOne({
    where: { id, institute_id: instituteId }
  });
  
  if (!policy) {
    throw new Error('Policy not found');
  }
  
  await policy.destroy({ transaction });
  return { message: 'Policy deleted successfully' };
};

/**
 * Activate/Deactivate policy
 * @param {string} id - Policy UUID
 * @param {string} instituteId - Institute ID for authorization
 * @param {boolean} isActive - Active status
 */
export const togglePolicyStatus = async (id, instituteId, isActive, userId) => {
  const policy = await Policy.findOne({
    where: { id, institute_id: instituteId }
  });
  
  if (!policy) {
    throw new Error('Policy not found');
  }
  
  // If activating a policy of same type, deactivate others
  if (isActive === true) {
    await Policy.update(
      { is_active: false },
      {
        where: {
          institute_id: instituteId,
          policy_type: policy.policy_type,
          id: { [Op.ne]: id }
        }
      }
    );
  }
  
  await policy.update({
    is_active: isActive,
    updated_by: userId
  });
  
  return policy;
};

/**
 * Get active policy by type
 * @param {string} instituteId - Institute ID
 * @param {string} policyType - Policy type
 * @param {string} branchId - Optional branch ID
 */
export const getActivePolicyByType = async (instituteId, policyType, branchId = null) => {
  const where = {
    institute_id: instituteId,
    policy_type: policyType,
    is_active: true
  };
  
  if (branchId) where.branch_id = branchId;
  
  const policy = await Policy.findOne({
    where,
    order: [['version', 'DESC']]
  });
  
  return policy;
};

/**
 * Get policy options for dropdown
 * @param {string} instituteId - Institute ID
 * @param {string} policyType - Optional policy type filter
 */
export const getPolicyOptions = async (instituteId, policyType = null) => {
  const where = {
    institute_id: instituteId,
    is_active: true
  };
  
  if (policyType) where.policy_type = policyType;
  
  const policies = await Policy.findAll({
    where,
    attributes: ['id', 'policy_name', 'policy_type', 'version'],
    order: [['policy_name', 'ASC']]
  });
  
  return policies.map(policy => ({
    value: policy.id,
    label: `${policy.policy_name} (v${policy.version})`,
    type: policy.policy_type
  }));
};

/**
 * Get policies by type with config
 * @param {string} instituteId - Institute ID
 * @param {string} policyType - Policy type
 */
export const getPoliciesByType = async (instituteId, policyType) => {
  const policies = await Policy.findAll({
    where: {
      institute_id: instituteId,
      policy_type: policyType
    },
    order: [['version', 'DESC']]
  });
  
  return policies;
};