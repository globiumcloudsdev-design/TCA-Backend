/**
 * The Clouds Academy - AcademicYear Controller
 * 
 * File: /src/controllers/academicYear.controller.js
 */

import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound,
  sendConflict,
} from '../../utils/helpers/response.helper.js';
import * as academicYearService from '../../services/academicYear.service.js';
import models from '../../models/postgres/index.js';

const { sequelize } = models;

import { getInstituteId, getBranchId } from '../../utils/helpers/request.helper.js';

/**
 * Create academic year
 */
export const createAcademicYear = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    const branchId = getBranchId(req);

    const academicYearData = {
      ...req.body,
      institute_id: instituteId,
      branch_id: branchId || req.body.branch_id || null,
    };

    const academicYear = await academicYearService.createAcademicYear(academicYearData, { transaction });
    await transaction.commit();
    return sendCreated(res, academicYear, 'Academic year created successfully');
  } catch (error) {
    await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendConflict(res, 'Academic year with this name already exists');
    }
    return sendError(res, error.message || 'Failed to create academic year');
  }
};

/**
 * Get all academic years
 */
export const getAllAcademicYears = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const branchId = getBranchId(req);

    const filters = {
      institute_id: instituteId,
      branch_id: branchId,
      is_current: req.query.is_current,
      is_active: req.query.is_active,
    };

    const pagination = {
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      sortBy: req.query.sortBy || 'start_date',
      sortOrder: req.query.sortOrder || 'DESC',
    };

    const result = await academicYearService.getAllAcademicYears(filters, pagination);
    return sendPaginated(res, result.data, result.pagination, 'Academic years fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch academic years');
  }
};

/**
 * Get academic year by ID
 */
export const getAcademicYearById = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const academicYear = await academicYearService.getAcademicYearById(id, instituteId);
    if (!academicYear) {
      return sendNotFound(res, 'Academic year not found');
    }
    return sendSuccess(res, academicYear, 'Academic year fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch academic year');
  }
};

/**
 * Update academic year
 */
export const updateAcademicYear = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    const academicYear = await academicYearService.updateAcademicYear(id, instituteId, req.body, { transaction });
    await transaction.commit();
    return sendSuccess(res, academicYear, 'Academic year updated successfully');
  } catch (error) {
    await transaction.rollback();
    if (error.message === 'Academic year not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update academic year');
  }
};

/**
 * Delete academic year
 */
export const deleteAcademicYear = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    const result = await academicYearService.deleteAcademicYear(id, instituteId, { transaction });
    await transaction.commit();
    return sendSuccess(res, null, result.message);
  } catch (error) {
    await transaction.rollback();
    if (error.message === 'Academic year not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to delete academic year', 400);
  }
};

/**
 * Set current academic year
 */
export const setCurrentAcademicYear = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }

    const academicYear = await academicYearService.setCurrentAcademicYear(id, instituteId, { transaction });
    await transaction.commit();
    return sendSuccess(res, academicYear, 'Academic year set as current successfully');
  } catch (error) {
    await transaction.rollback();
    if (error.message === 'Academic year not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to set current academic year');
  }
};

/**
 * Get current academic year
 */
export const getCurrentAcademicYear = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const academicYear = await academicYearService.getCurrentAcademicYear(instituteId);
    if (!academicYear) {
      return sendNotFound(res, 'No current academic year found');
    }
    return sendSuccess(res, academicYear, 'Current academic year fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch current academic year');
  }
};




/**
 * GET ACADEMIC YEAR OPTIONS FOR DROPDOWN
 * Yeh endpoint frontend dropdown ke liye hai
 */
export const getAcademicYearOptions = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const branchId = getBranchId(req);
    const onlyActive = req.query.onlyActive !== 'false'; // Default true
    
    const result = await academicYearService.getAcademicYearOptions(instituteId, onlyActive, branchId);
    
    return sendSuccess(res, result.data, 'Academic year options fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch academic year options');
  }
};