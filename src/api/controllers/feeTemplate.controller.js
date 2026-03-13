// backend/src/controllers/feeTemplate.controller.js (FIXED)

import * as feeTemplateService from '../../services/feeTemplate.service.js';
import models from '../../models/postgres/index.js';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound
} from '../../utils/helpers/response.helper.js';

const { sequelize } = models;

const getInstituteId = (req) => {
  return req.institute?.id || req.user?.institute_id || req.user?.school_id;
};

const normalizeUuid = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  if (!normalized || normalized.toLowerCase() === 'all') return undefined;
  return normalized;
};

const normalizeUuidArray = (values = []) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeUuid(value))
    .filter(Boolean);
};

const normalizeTemplatePayload = (payload = {}) => {
  const normalized = {
    ...payload,
    branch_id: normalizeUuid(payload.branch_id),
    academic_year_id: normalizeUuid(payload.academic_year_id)
  };

  if (normalized.applicable_to) {
    normalized.applicable_to = {
      ...normalized.applicable_to,
      class_ids: normalizeUuidArray(normalized.applicable_to.class_ids),
      section_ids: normalizeUuidArray(normalized.applicable_to.section_ids),
      student_ids: normalizeUuidArray(normalized.applicable_to.student_ids),
      branch_ids: normalizeUuidArray(normalized.applicable_to.branch_ids)
    };
  }

  return normalized;
};

export const getAllFeeTemplates = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    const branchFilter = req.query.branch_id && req.query.branch_id !== 'all'
      ? req.query.branch_id
      : req.branch_id;
    const academicYearFilter = req.query.academic_year_id && req.query.academic_year_id !== 'all'
      ? req.query.academic_year_id
      : undefined;

    const filters = {
      institute_id: instituteId,
      branch_id: branchFilter,
      academic_year_id: academicYearFilter,
      search: req.query.search,
      status: req.query.status,
      is_default: req.query.is_default
    };

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    const result = await feeTemplateService.getAllFeeTemplates(filters, pagination);

    return sendPaginated(res, result.data, result.pagination, 'Fee templates fetch ho gaye');
  } catch (error) {
    console.error('❌ Fee templates fetch error:', error);
    return sendError(res, error.message || 'Fee templates fetch nahi ho sakin', 500);
  }
};

export const getFeeTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    const feeTemplate = await feeTemplateService.getFeeTemplateById(id, instituteId);

    if (!feeTemplate) {
      return sendNotFound(res, 'Fee template nahi mila');
    }

    return sendSuccess(res, feeTemplate, 'Fee template mil gaya');
  } catch (error) {
    console.error('❌ Fee template fetch error:', error);
    return sendError(res, error.message || 'Fee template fetch nahi ho saka', 500);
  }
};

export const createFeeTemplate = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    const templateData = {
      ...normalizeTemplatePayload(req.body),
      institute_id: instituteId,
      created_by: req.user.id,
      updated_by: req.user.id
    };

    const feeTemplate = await feeTemplateService.createFeeTemplate(templateData, { transaction });
    await transaction.commit();

    return sendCreated(res, feeTemplate, 'Fee template create ho gaya');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Fee template create error:', error);
    return sendError(res, error.message || 'Fee template create nahi ho saka', 400);
  }
};

export const updateFeeTemplate = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    const updateData = {
      ...normalizeTemplatePayload(req.body),
      updated_by: req.user.id
    };

    const updatedTemplate = await feeTemplateService.updateFeeTemplate(
      id,
      instituteId,
      updateData,
      { transaction }
    );

    await transaction.commit();

    return sendSuccess(res, updatedTemplate, 'Fee template update ho gaya');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Fee template update error:', error);

    if (error.message === 'Fee template nahi mila') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Fee template update nahi ho saka', 400);
  }
};

export const deleteFeeTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    const result = await feeTemplateService.deleteFeeTemplate(id, instituteId);

    return sendSuccess(res, null, result.message);
  } catch (error) {
    console.error('❌ Fee template delete error:', error);
    if (error.message === 'Fee template nahi mila') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Fee template delete nahi ho saka', 500);
  }
};

export const toggleFeeTemplateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    if (is_active === undefined) {
      return sendError(res, 'is_active field zaroori hai', 400);
    }

    const feeTemplate = await feeTemplateService.toggleFeeTemplateStatus(id, instituteId, is_active);

    return sendSuccess(res, feeTemplate, `Fee template ${is_active ? 'activate' : 'deactivate'} ho gaya`);
  } catch (error) {
    console.error('❌ Toggle status error:', error);
    if (error.message === 'Fee template nahi mila') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Status change nahi ho saka', 500);
  }
};

export const assignFeeTemplate = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    const assignedTemplate = await feeTemplateService.assignFeeTemplate(
      id,
      instituteId,
      req.body,
      { transaction }
    );

    await transaction.commit();

    return sendSuccess(res, assignedTemplate, 'Fee template assign ho gaya');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Assign error:', error);
    if (error.message === 'Fee template nahi mila') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Fee template assign nahi ho saka', 400);
  }
};