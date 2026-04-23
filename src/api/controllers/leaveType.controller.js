/**
 * Leave Type Controller
 * Handles CRUD operations for leave types
 */

import logger from '../../config/logger.js';
import models from '../../models/postgres/index.js';
import { Op } from 'sequelize';

const { LeaveType, Institute, Branch, sequelize } = models;

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
 * Get all leave types with filtering
 */
export const getLeaveTypes = async (req, res) => {
  try {
    const { page = 1, limit = 10, is_active = true, search } = req.query;
    const institute_id = getInstituteId(req);
    const branch_id = getBranchId(req);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (!institute_id) {
      return res.status(400).json({
        success: false,
        message: 'Institute ID not found in request',
      });
    }

    const where = { institute_id };

    // If branch_id is provided, filter by specific branch
    // Otherwise get both branch-specific and institute-wide leave types
    if (branch_id) {
      where[Op.or] = [
        { branch_id: branch_id },
        { branch_id: null },
      ];
    } else {
      // Get all institute-wide leave types (branch_id is null)
      where.branch_id = null;
    }

    // Filter by active status
    if (is_active !== undefined) {
      where.is_active = is_active === 'true' || is_active === true;
    }

    // Search by leave type name
    if (search) {
      where.leave_type_name = { [Op.iLike]: `%${search}%` };
    }

    // Get leave types with pagination
    const { count, rows } = await LeaveType.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['display_order', 'ASC'], ['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching leave types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave types',
      error: error.message,
    });
  }
};

/**
 * Create new leave type
 */
export const createLeaveType = async (req, res) => {
  try {
    const {
      leave_type_name,
      description,
      max_days_per_year,
      is_paid,
      requires_approval,
      color_code,
    } = req.body;

    const institute_id = getInstituteId(req);
    const branch_id = getBranchId(req);

    if (!institute_id) {
      return res.status(400).json({
        success: false,
        message: 'Institute ID not found in request',
      });
    }

    // Check if leave type already exists for this institute/branch combination
    const where = {
      institute_id,
      leave_type_name: leave_type_name.trim(),
    };

    if (branch_id) {
      where.branch_id = branch_id;
    } else {
      where.branch_id = null;
    }

    const existingLeaveType = await LeaveType.findOne({ where });

    if (existingLeaveType) {
      return res.status(409).json({
        success: false,
        message: 'Leave type with this name already exists for this branch/institute',
      });
    }

    // Create new leave type
    const leaveType = await LeaveType.create({
      institute_id,
      branch_id: branch_id || null,
      leave_type_name: leave_type_name.trim(),
      description,
      max_days_per_year: max_days_per_year || 0,
      is_paid: is_paid !== false,
      requires_approval: requires_approval !== false,
      color_code: color_code || '#3B82F6',
      is_active: true,
    });

    logger.info(
      `Leave type created: ${leaveType.id} in institute ${institute_id}${branch_id ? ` branch ${branch_id}` : ''}`
    );

    res.status(201).json({
      success: true,
      message: 'Leave type created successfully',
      data: leaveType,
    });
  } catch (error) {
    logger.error('Error creating leave type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create leave type',
      error: error.message,
    });
  }
};

/**
 * Update leave type
 */
export const updateLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const institute_id = getInstituteId(req);
    const {
      leave_type_name,
      description,
      max_days_per_year,
      is_paid,
      requires_approval,
      color_code,
      is_active,
    } = req.body;

    if (!institute_id) {
      return res.status(400).json({
        success: false,
        message: 'Institute ID not found in request',
      });
    }

    // Check if leave type exists
    const leaveType = await LeaveType.findOne({
      where: { id, institute_id },
    });

    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found',
      });
    }

    // Check if new name conflicts with existing type
    if (leave_type_name && leave_type_name !== leaveType.leave_type_name) {
      const existingLeaveType = await LeaveType.findOne({
        where: {
          institute_id,
          leave_type_name: leave_type_name.trim(),
          branch_id: leaveType.branch_id,
          id: { [Op.ne]: id },
        },
      });

      if (existingLeaveType) {
        return res.status(409).json({
          success: false,
          message: 'Leave type with this name already exists for this branch',
        });
      }
    }

    // Update leave type
    await leaveType.update({
      leave_type_name: leave_type_name || leaveType.leave_type_name,
      description: description !== undefined ? description : leaveType.description,
      max_days_per_year:
        max_days_per_year !== undefined ? max_days_per_year : leaveType.max_days_per_year,
      is_paid: is_paid !== undefined ? is_paid : leaveType.is_paid,
      requires_approval:
        requires_approval !== undefined ? requires_approval : leaveType.requires_approval,
      color_code: color_code || leaveType.color_code,
      is_active: is_active !== undefined ? is_active : leaveType.is_active,
    });

    logger.info(`Leave type updated: ${id}`);

    res.json({
      success: true,
      message: 'Leave type updated successfully',
      data: leaveType,
    });
  } catch (error) {
    logger.error('Error updating leave type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update leave type',
      error: error.message,
    });
  }
};

/**
 * Delete leave type (soft delete)
 */
export const deleteLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const institute_id = getInstituteId(req);

    if (!institute_id) {
      return res.status(400).json({
        success: false,
        message: 'Institute ID not found in request',
      });
    }

    // Check if leave type exists
    const leaveType = await LeaveType.findOne({
      where: { id, institute_id },
    });

    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found',
      });
    }

    // Soft delete
    await leaveType.destroy();

    logger.info(`Leave type deleted: ${id}`);

    res.json({
      success: true,
      message: 'Leave type deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting leave type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete leave type',
      error: error.message,
    });
  }
};

/**
 * Get leave type by ID
 */
export const getLeaveTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const institute_id = getInstituteId(req);

    if (!institute_id) {
      return res.status(400).json({
        success: false,
        message: 'Institute ID not found in request',
      });
    }

    const leaveType = await LeaveType.findOne({
      where: { id, institute_id },
    });

    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found',
      });
    }

    res.json({
      success: true,
      data: leaveType,
    });
  } catch (error) {
    logger.error('Error fetching leave type by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave type',
      error: error.message,
    });
  }
};
