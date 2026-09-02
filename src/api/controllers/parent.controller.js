import * as parentService from '../../services/parent.service.js';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound
} from '../../utils/helpers/response.helper.js';
import { getInstituteId, getBranchId } from '../../utils/helpers/request.helper.js';

const formatServiceError = (error) => {
  if (!error) return 'Unknown error';

  if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
    const details = Array.isArray(error.errors)
      ? error.errors.map((e) => `${e.path || 'field'}: ${e.message}`).join(', ')
      : '';
    return details || error.message || 'Validation error';
  }

  return error.message || 'Unexpected error';
};

export const findStudentsByParentInfo = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendError(res, 'Institute ID not found', 400);

    const body = req.body || {};
    const hasCriteria = !!(
      String(body.first_name || '').trim() ||
      String(body.last_name || '').trim() ||
      String(body.phone || '').trim() ||
      String(body.cnic || '').trim() ||
      String(body.email || '').trim()
    );

    if (!hasCriteria) {
      return sendError(res, 'Please provide at least one field (name, phone, cnic, or email) to find students.', 400);
    }

    const data = await parentService.findStudentsByParentInfo(instituteId, body);
    return sendSuccess(res, data, 'Students fetched successfully');
  } catch (error) {
    return sendError(res, formatServiceError(error) || 'Failed to find students', 500);
  }
};

export const createParent = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendError(res, 'Institute ID not found', 400);

    const branchId = getBranchId(req);

    const payload = { ...req.body };
    if (typeof payload.student_ids === 'string') {
      try {
        payload.student_ids = JSON.parse(payload.student_ids);
      } catch {
        payload.student_ids = [];
      }
    }

    if (!payload.first_name || !payload.last_name || !payload.phone) {
      return sendError(res, 'first_name, last_name and phone are required.', 400);
    }

    const result = await parentService.createParent(instituteId, payload, req.user.id, branchId);
    return sendCreated(res, result, 'Parent account created successfully');
  } catch (error) {
    return sendError(res, formatServiceError(error) || 'Failed to create parent', 400);
  }
};

export const getAllParents = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendError(res, 'Institute ID not found', 400);

    const branchId = getBranchId(req);

    const filters = {
      search: req.query.search,
      status: req.query.status,
      branch_id: branchId
    };
    const pagination = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 10
    };

    const result = await parentService.getAllParents(instituteId, filters, pagination, branchId);
    return sendPaginated(res, result.data, result.pagination, 'Parents fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch parents', 500);
  }
};

export const getParentById = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendError(res, 'Institute ID not found', 400);

    const branchId = getBranchId(req);

    const parent = await parentService.getParentById(req.params.id, instituteId, branchId);
    return sendSuccess(res, parent, 'Parent fetched successfully');
  } catch (error) {
    if (error.message === 'Parent not found') return sendNotFound(res, error.message);
    return sendError(res, error.message || 'Failed to fetch parent', 500);
  }
};

export const updateParent = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendError(res, 'Institute ID not found', 400);

    const branchId = getBranchId(req);

    const payload = { ...req.body };
    if (typeof payload.student_ids === 'string') {
      try {
        payload.student_ids = JSON.parse(payload.student_ids);
      } catch {
        payload.student_ids = [];
      }
    }

    const parent = await parentService.updateParent(req.params.id, instituteId, payload, branchId);
    return sendSuccess(res, parent, 'Parent updated successfully');
  } catch (error) {
    if (error.message === 'Parent not found') return sendNotFound(res, error.message);
    return sendError(res, formatServiceError(error) || 'Failed to update parent', 400);
  }
};

export const deleteParent = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendError(res, 'Institute ID not found', 400);

    const branchId = getBranchId(req);

    await parentService.deleteParent(req.params.id, instituteId, branchId);
    return sendSuccess(res, null, 'Parent deleted successfully');
  } catch (error) {
    if (error.message === 'Parent not found') return sendNotFound(res, error.message);
    return sendError(res, error.message || 'Failed to delete parent', 400);
  }
};

/**
 * Search parents controller
 */
export const searchParents = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendError(res, 'Institute ID not found', 400);

    const branchId = getBranchId(req);

    const query = {
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
      is_active: req.query.is_active,
      branch_id: branchId
    };

    const result = await parentService.searchParents(instituteId, query, branchId);
    return sendPaginated(res, result.data, result.pagination, 'Parents searched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to search parents', 500);
  }
};

export default {
  findStudentsByParentInfo,
  createParent,
  getAllParents,
  getParentById,
  updateParent,
  deleteParent,
  searchParents
};
