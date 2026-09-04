// src/services/vendor.service.js
import models from '../models/postgres/index.js';
import { Op } from 'sequelize';
import { hashPassword } from '../utils/helpers/password.helper.js';

const { Vendor, sequelize } = models;

/**
 * Create vendor
 */
export const createVendor = async (data, options = {}) => {
  const { transaction } = options;
  
  // Hash password if provided
  if (data.password) {
    data.password_hash = await hashPassword(data.password);
    delete data.password; // Remove plain password
  }
  
  const vendor = await Vendor.create(data, { transaction });
  return vendor;
};

/**
 * Get all vendors
 */
export const getAllVendors = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 10, sortBy = 'name', sortOrder = 'ASC' } = pagination;
  const offset = (page - 1) * limit;
  
  const where = { institute_id: filters.institute_id };
  
  if (filters.branch_id) where.branch_id = filters.branch_id;
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  
  if (filters.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${filters.search}%` } },
      { phone: { [Op.iLike]: `%${filters.search}%` } },
      { email: { [Op.iLike]: `%${filters.search}%` } },
    ];
  }
  
  const { count, rows } = await Vendor.findAndCountAll({
    where,
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
 * Get vendor by ID
 */
export const getVendorById = async (id, instituteId, branchId = null) => {
  const where = { id, institute_id: instituteId };
  if (branchId) where.branch_id = branchId;
  const vendor = await Vendor.findOne({
    where
  });
  return vendor;
};

/**
 * Get vendors for dropdown (creatable select)
 */
export const getVendorOptions = async (instituteId, branchId = null, type = null) => {
  const where = { 
    institute_id: instituteId,
    status: 'active'
  };
  
  if (branchId) where.branch_id = branchId;
  if (type) where.type = type;
  
  const vendors = await Vendor.findAll({
    where,
    attributes: ['id', 'name', 'type', 'phone', 'assigned_student_ids'],
    order: [['name', 'ASC']],
  });
  
  // Format for CreatableSelectField: { value: id, label: name, type: type }
  const options = vendors.map(vendor => ({
    value: vendor.id,
    label: vendor.name,
    type: vendor.type,
    phone: vendor.phone,
    assigned_student_count: vendor.assigned_student_ids?.length || 0
  }));
  
  return options;
};

/**
 * Update vendor
 */
export const updateVendor = async (id, instituteId, updateData, options = {}) => {
  const { transaction, branch_id } = options;
  const where = { id, institute_id: instituteId };
  if (branch_id) where.branch_id = branch_id;
  
  const vendor = await Vendor.findOne({
    where,
    transaction
  });
  
  if (!vendor) {
    throw new Error('Vendor not found');
  }
  
  // Hash password if provided
  if (updateData.password) {
    updateData.password_hash = await hashPassword(updateData.password);
    delete updateData.password; // Remove plain password
  }
  
  await vendor.update(updateData, { transaction });
  return vendor;
};

/**
 * Delete vendor
 */
export const deleteVendor = async (id, instituteId, options = {}) => {
  const { transaction, branch_id } = options;
  const where = { id, institute_id: instituteId };
  if (branch_id) where.branch_id = branch_id;
  
  const vendor = await Vendor.findOne({
    where,
    transaction
  });
  
  if (!vendor) {
    throw new Error('Vendor not found');
  }
  
  await vendor.destroy({ transaction });
  return { message: 'Vendor deleted successfully' };
};

/**
 * Assign students to vendor
 */
export const assignStudentsToVendor = async (id, instituteId, studentIds, options = {}) => {
  const { transaction, branch_id } = options;
  const where = { id, institute_id: instituteId };
  if (branch_id) where.branch_id = branch_id;
  
  const vendor = await Vendor.findOne({
    where,
    transaction
  });
  
  if (!vendor) {
    throw new Error('Vendor not found');
  }
  
  await vendor.update({ assigned_student_ids: studentIds }, { transaction });
  return vendor;
};

/**
 * Get vendor types (for dropdown, including custom types from data)
 */
export const getVendorTypes = async (instituteId) => {
  const types = await Vendor.findAll({
    where: { institute_id: instituteId },
    attributes: ['type'],
    group: ['type'],
  });
  
  const defaultTypes = [
    { value: 'books', label: 'Books and Stationery Vendors' },
    { value: 'uniform', label: 'Uniform Vendors' },
    { value: 'transport', label: 'Transport Vendors' },
    { value: 'canteen', label: 'Canteen Vendors' },
    { value: 'it', label: 'IT Vendors' },
    { value: 'maintenance', label: 'Maintenance Vendors' },
    { value: 'cleaning', label: 'Cleaning Vendors' },
    { value: 'security', label: 'Security Vendors' },
  ];
  
  const customTypes = types.map(t => ({
    value: t.type,
    label: t.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }));
  
  // Merge and deduplicate
  const allTypes = [...defaultTypes, ...customTypes];
  const unique = new Map();
  allTypes.forEach(t => {
    if (!unique.has(t.value)) unique.set(t.value, t);
  });
  
  return Array.from(unique.values());
};