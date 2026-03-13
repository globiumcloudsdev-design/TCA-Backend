// backend/src/services/feeTemplate.service.js (COMPLETE FIXED)

import models from '../models/postgres/index.js';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

const { FeeTemplate, AcademicYear } = models;

let feeTemplatesHasBranchIdColumn;

const hasFeeTemplateBranchColumn = async () => {
  if (typeof feeTemplatesHasBranchIdColumn === 'boolean') {
    return feeTemplatesHasBranchIdColumn;
  }

  try {
    const table = await models.sequelize.getQueryInterface().describeTable('fee_templates');
    feeTemplatesHasBranchIdColumn = Object.prototype.hasOwnProperty.call(table, 'branch_id');
  } catch (error) {
    // If table inspection fails, keep legacy behavior so we don't hide real DB issues.
    feeTemplatesHasBranchIdColumn = true;
  }

  return feeTemplatesHasBranchIdColumn;
};

const getFeeTemplateAttributes = (includeBranchId) =>
  Object.keys(FeeTemplate.rawAttributes).filter((key) => includeBranchId || key !== 'branch_id');

/**
 * Calculate component amount with discount
 */
const calculateComponentAmount = (component, baseTotal = 0) => {
  let grossAmount = 0;
  let discountAmount = 0;
  let netAmount = 0;

  // Calculate gross amount
  if (component.type === 'fee') {
    if (component.amount_type === 'fixed') {
      grossAmount = Number(component.amount_value) || 0;
    } else if (component.amount_type === 'percentage') {
      grossAmount = (baseTotal * (Number(component.amount_value) || 0)) / 100;
    }
  }

  // Apply component-specific discount
  if (component.discount_type) {
    if (component.discount_type === 'fixed') {
      discountAmount = Number(component.discount_value) || 0;
    } else if (component.discount_type === 'percentage') {
      discountAmount = (grossAmount * (Number(component.discount_value) || 0)) / 100;
    }
  }

  netAmount = grossAmount - discountAmount;

  return {
    grossAmount,
    discountAmount,
    netAmount
  };
};

/**
 * Calculate totals from components
 */
const calculateTotals = (components) => {
  console.log('🧮 Calculating fee template totals');
  
  let baseTotal = 0;
  let totalDiscount = 0;
  const processedComponents = [];
  
  // First pass: calculate fixed amounts and base total
  components.forEach(comp => {
    if (comp.type === 'fee' && comp.amount_type === 'fixed') {
      baseTotal += Number(comp.amount_value) || 0;
    }
  });
  
  // Second pass: calculate all components with discounts
  components.forEach(comp => {
    const result = calculateComponentAmount(comp, baseTotal);
    
    processedComponents.push({
      ...comp,
      calculated_amount: result.netAmount,
      discount_amount: result.discountAmount,
      gross_amount: result.grossAmount
    });
    
    if (comp.type === 'fee') {
      totalDiscount += result.discountAmount;
    }
  });
  
  const finalTotal = baseTotal - totalDiscount;
  
  // Calculate discount summary
  const discountSummary = {
    total_fixed_discount: components
      .filter(c => c.discount_type === 'fixed')
      .reduce((sum, c) => sum + (Number(c.discount_value) || 0), 0),
    total_percentage_discount: components
      .filter(c => c.discount_type === 'percentage')
      .reduce((sum, c) => sum + (Number(c.discount_value) || 0), 0),
    final_discount: totalDiscount
  };

  return {
    components: processedComponents,
    base_total: baseTotal,
    total_discount: totalDiscount,
    final_total: finalTotal,
    discount_summary: discountSummary
  };
};

/**
 * Create fee template
 */
export const createFeeTemplate = async (data, options = {}) => {
  const { transaction } = options;
  const supportsBranchId = await hasFeeTemplateBranchColumn();

  console.log('📝 Fee template create ho raha hai:', data.name);

  // Generate code if not provided
  if (!data.code) {
    const count = await FeeTemplate.count({
      where: { institute_id: data.institute_id }
    });
    data.code = `FT-${String(count + 1).padStart(4, '0')}`;
  }

  // Calculate totals from components
  const calculations = calculateTotals(data.components || []);

  const createPayload = {
    id: uuidv4(),
    ...data,
    components: calculations.components,
    calculated_totals: {
      base_total: calculations.base_total,
      total_discount: calculations.total_discount,
      final_total: calculations.final_total,
      component_count: data.components?.length || 0,
      discount_components: data.components?.filter(c => c.discount_type).length || 0
    },
    discount_summary: calculations.discount_summary,
    total_amount: calculations.final_total,
    created_at: new Date(),
    updated_at: new Date()
  };

  if (!supportsBranchId) {
    delete createPayload.branch_id;
  }

  const feeTemplate = await FeeTemplate.create(createPayload, { transaction });

  console.log('✅ Fee template create ho gaya:', feeTemplate.id);
  return feeTemplate;
};

/**
 * Update fee template
 */
export const updateFeeTemplate = async (id, instituteId, updateData, options = {}) => {
  const { transaction } = options;
  const supportsBranchId = await hasFeeTemplateBranchColumn();

  console.log('📝 Fee template update ho raha hai:', id);

  const feeTemplate = await FeeTemplate.findOne({
    where: { id, institute_id: instituteId }
  });

  if (!feeTemplate) {
    throw new Error('Fee template nahi mila');
  }

  // Basic fields update
  const basicFields = ['name', 'code', 'description', 'fee_basis', 'due_day', 
    'late_fine_type', 'late_fine_amount', 'late_fine_after_days', 'is_active', 'is_default'];

  if (supportsBranchId) {
    basicFields.push('branch_id');
  }
  
  basicFields.forEach(field => {
    if (updateData[field] !== undefined) {
      feeTemplate[field] = updateData[field];
    }
  });

  // Update applicable_to if provided
  if (updateData.applicable_to) {
    feeTemplate.applicable_to = {
      ...feeTemplate.applicable_to,
      ...updateData.applicable_to
    };
    feeTemplate.changed('applicable_to', true);
  }

  // Update components and recalculate totals
  if (updateData.components) {
    const calculations = calculateTotals(updateData.components);
    
    feeTemplate.components = calculations.components;
    feeTemplate.calculated_totals = {
      base_total: calculations.base_total,
      total_discount: calculations.total_discount,
      final_total: calculations.final_total,
      component_count: updateData.components.length,
      discount_components: updateData.components.filter(c => c.discount_type).length
    };
    feeTemplate.discount_summary = calculations.discount_summary;
    feeTemplate.total_amount = calculations.final_total;
    
    feeTemplate.changed('components', true);
    feeTemplate.changed('calculated_totals', true);
    feeTemplate.changed('discount_summary', true);
  }

  feeTemplate.updated_at = new Date();
  await feeTemplate.save({ transaction });

  console.log('✅ Fee template update ho gaya');
  return feeTemplate;
};

/**
 * Get all fee templates
 */
export const getAllFeeTemplates = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;
  const supportsBranchId = await hasFeeTemplateBranchColumn();

  const where = { institute_id: filters.institute_id };

  if (supportsBranchId && filters.branch_id) where.branch_id = filters.branch_id;
  if (filters.academic_year_id) where.academic_year_id = filters.academic_year_id;

  if (filters.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${filters.search}%` } },
      { code: { [Op.iLike]: `%${filters.search}%` } }
    ];
  }

  if (filters.status === 'active') where.is_active = true;
  else if (filters.status === 'inactive') where.is_active = false;

  if (filters.is_default !== undefined) where.is_default = filters.is_default === 'true';

  const { count, rows } = await FeeTemplate.findAndCountAll({
    attributes: getFeeTemplateAttributes(supportsBranchId),
    where,
    include: [
      { model: AcademicYear, as: 'academicYear', attributes: ['id', 'name'] }
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
    distinct: true
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
 * Get fee template by ID
 */
export const getFeeTemplateById = async (id, instituteId) => {
  const supportsBranchId = await hasFeeTemplateBranchColumn();

  const feeTemplate = await FeeTemplate.findOne({
    attributes: getFeeTemplateAttributes(supportsBranchId),
    where: { id, institute_id: instituteId },
    include: [
      { model: AcademicYear, as: 'academicYear', attributes: ['id', 'name'] }
    ]
  });

  return feeTemplate;
};

/**
 * Delete fee template
 */
export const deleteFeeTemplate = async (id, instituteId) => {
  const feeTemplate = await FeeTemplate.findOne({
    where: { id, institute_id: instituteId }
  });

  if (!feeTemplate) throw new Error('Fee template nahi mila');

  await feeTemplate.destroy();
  return { message: 'Fee template delete ho gaya' };
};

/**
 * Toggle fee template status
 */
export const toggleFeeTemplateStatus = async (id, instituteId, isActive) => {
  const feeTemplate = await FeeTemplate.findOne({
    where: { id, institute_id: instituteId }
  });

  if (!feeTemplate) throw new Error('Fee template nahi mila');

  feeTemplate.is_active = isActive;
  feeTemplate.updated_at = new Date();
  await feeTemplate.save();

  return feeTemplate;
};

/**
 * Assign fee template to classes/sections/students
 */
export const assignFeeTemplate = async (id, instituteId, assignData, options = {}) => {
  const { transaction } = options;

  const feeTemplate = await FeeTemplate.findOne({
    where: { id, institute_id: instituteId }
  });

  if (!feeTemplate) throw new Error('Fee template nahi mila');

  const { class_ids = [], section_ids = [], student_ids = [], all_classes = false } = assignData;

  feeTemplate.applicable_to = {
    all_classes,
    class_ids: class_ids || [],
    section_ids: section_ids || [],
    student_ids: student_ids || [],
    all_branches: assignData.all_branches || false,
    branch_ids: assignData.branch_ids || []
  };
  
  feeTemplate.changed('applicable_to', true);
  feeTemplate.updated_at = new Date();
  await feeTemplate.save({ transaction });

  return feeTemplate;
};

export default {
  createFeeTemplate,
  updateFeeTemplate,
  getAllFeeTemplates,
  getFeeTemplateById,
  deleteFeeTemplate,
  toggleFeeTemplateStatus,
  assignFeeTemplate
};