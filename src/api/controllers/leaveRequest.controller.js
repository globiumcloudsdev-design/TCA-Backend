// src/api/controllers/leaveRequest.controller.js
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound,
  sendBadRequest,
  sendUnauthorized,
} from '../../utils/helpers/response.helper.js';
import * as leaveRequestService from '../../services/leaveRequest.service.js';
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
 * Helper to determine user type from token
 */
const getUserType = (req) => {
  const userType = req.user?.user_type;
  if (['TEACHER', 'STAFF'].includes(userType)) return 'STAFF';
  if (userType === 'STUDENT') return 'STUDENT';
  return userType;
};

/**
 * Create leave request
 * POST /api/v1/leave-requests
 */
export const createLeaveRequest = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      await transaction.rollback();
      return sendBadRequest(res, 'Institute ID not found');
    }

    const branchId = getBranchId(req);
    const userId = req.user.id;
    const userType = getUserType(req);

    // Verify leave type exists for this institute
    const leaveType = await models.LeaveType.findOne({
      where: {
        id: req.body.leave_type_id,
        institute_id: instituteId,
      },
      transaction,
    });

    if (!leaveType) {
      await transaction.rollback();
      return sendNotFound(res, 'Leave type not found');
    }

    const leaveRequestData = {
      ...req.body,
      institute_id: instituteId,
      branch_id: branchId,
      user_id: userId,
      user_type: userType,
      status: 'PENDING',
    };

    const leaveRequest = await leaveRequestService.createLeaveRequest(leaveRequestData, {
      transaction,
    });
    await transaction.commit();

    return sendCreated(res, leaveRequest, 'Leave request created successfully');
  } catch (error) {
    await transaction.rollback();
    return sendError(res, error.message || 'Failed to create leave request');
  }
};

/**
 * Get my leave requests
 * GET /api/v1/leave-requests/my-requests
 */
export const getMyLeaveRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = getUserType(req);

    const filters = {
      status: req.query.status,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    };

    const result = await leaveRequestService.getMyLeaveRequests(userId, userType, filters);

    return sendPaginated(
      res,
      result.data,
      result.pagination,
      'Leave requests fetched successfully'
    );
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch leave requests');
  }
};

/**
 * Get all leave requests (admin/approver)
 * GET /api/v1/leave-requests
 */
export const getAllLeaveRequests = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendBadRequest(res, 'Institute ID not found');
    }

    const filters = {
      institute_id: instituteId,
      branch_id: req.query.branch_id,
      status: req.query.status,
      user_type: req.query.user_type,
      user_id: req.query.user_id,
      leave_type_id: req.query.leave_type_id,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    };

    const result = await leaveRequestService.getAllLeaveRequests(filters);

    return sendPaginated(
      res,
      result.data,
      result.pagination,
      'Leave requests fetched successfully'
    );
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch leave requests');
  }
};

/**
 * Get leave request by ID
 * GET /api/v1/leave-requests/:id
 */
export const getLeaveRequestById = async (req, res) => {
  try {
    const leaveRequest = await leaveRequestService.getLeaveRequestById(req.params.id);
    return sendSuccess(res, leaveRequest, 'Leave request fetched successfully');
  } catch (error) {
    return sendNotFound(res, error.message || 'Leave request not found');
  }
};

/**
 * Update leave request (if PENDING)
 * PUT /api/v1/leave-requests/:id
 */
export const updateLeaveRequest = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const leaveRequest = await leaveRequestService.updateLeaveRequest(
      req.params.id,
      req.body,
      req.user.id,
      { transaction }
    );

    await transaction.commit();
    return sendSuccess(res, leaveRequest, 'Leave request updated successfully');
  } catch (error) {
    await transaction.rollback();
    if (error.message.includes('not found')) {
      return sendNotFound(res, error.message);
    }
    if (error.message.includes('Unauthorized')) {
      return sendUnauthorized(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update leave request');
  }
};

/**
 * Approve or reject leave request
 * PATCH /api/v1/leave-requests/:id/approve-reject
 */
export const approveRejectLeaveRequest = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const leaveRequest = await leaveRequestService.approveRejectLeaveRequest(
      req.params.id,
      req.body,
      req.user.id,
      { transaction }
    );

    await transaction.commit();
    return sendSuccess(
      res,
      leaveRequest,
      `Leave request ${req.body.status.toLowerCase()} successfully`
    );
  } catch (error) {
    await transaction.rollback();
    if (error.message.includes('not found')) {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to approve/reject leave request');
  }
};

/**
 * Cancel leave request
 * PATCH /api/v1/leave-requests/:id/cancel
 */
export const cancelLeaveRequest = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const leaveRequest = await leaveRequestService.cancelLeaveRequest(
      req.params.id,
      req.user.id,
      { transaction }
    );

    await transaction.commit();
    return sendSuccess(res, leaveRequest, 'Leave request cancelled successfully');
  } catch (error) {
    await transaction.rollback();
    if (error.message.includes('not found')) {
      return sendNotFound(res, error.message);
    }
    if (error.message.includes('Unauthorized')) {
      return sendUnauthorized(res, error.message);
    }
    return sendError(res, error.message || 'Failed to cancel leave request');
  }
};

/**
 * Get leave statistics
 * GET /api/v1/leave-requests/statistics/my-stats
 */
export const getMyLeaveStatistics = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendBadRequest(res, 'Institute ID not found');
    }

    const userId = req.user.id;
    const userType = getUserType(req);

    const stats = await leaveRequestService.getLeaveStatistics(userId, userType, instituteId);

    return sendSuccess(res, stats, 'Leave statistics fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch leave statistics');
  }
};

/**
 * Admin: Mark leave for staff/student
 * POST /api/v1/leave-requests/admin/mark-leave
 */
export const adminMarkLeave = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    // Check if user is admin/manager (has permission to mark leaves)
    const adminRoles = ['ADMIN', 'INSTITUTE_ADMIN', 'MANAGER'];
    if (!adminRoles.includes(req.user?.user_type)) {
      await transaction.rollback();
      return sendUnauthorized(res, 'Only admins can mark leave for others');
    }

    const instituteId = getInstituteId(req);
    if (!instituteId) {
      await transaction.rollback();
      return sendBadRequest(res, 'Institute ID not found');
    }

    // Verify target user exists
    const targetUser = await models.User.findByPk(req.body.user_id, { transaction });
    if (!targetUser) {
      await transaction.rollback();
      return sendNotFound(res, 'User not found');
    }

    // Verify leave type exists for this institute
    const leaveType = await models.LeaveType.findOne({
      where: {
        id: req.body.leave_type_id,
        institute_id: instituteId,
      },
      transaction,
    });

    if (!leaveType) {
      await transaction.rollback();
      return sendNotFound(res, 'Leave type not found');
    }

    // Determine user type for the target user (preserve actual type)
    const targetUserType = targetUser.user_type;

    const branchId = getBranchId(req);

    const leaveRequestData = {
      user_id: req.body.user_id,
      user_type: targetUserType,
      leave_type_id: req.body.leave_type_id,
      from_date: req.body.from_date,
      to_date: req.body.to_date,
      number_of_days: req.body.number_of_days,
      reason: req.body.reason || '',
      institute_id: instituteId,
      branch_id: branchId,
      marked_by_id: req.user.id,
      status: req.body.approve_immediately !== false ? 'APPROVED' : 'PENDING',
      approved_by: req.body.approve_immediately !== false ? req.user.id : null,
      approved_at: req.body.approve_immediately !== false ? new Date() : null,
    };

    let leaveRequest = await leaveRequestService.createLeaveRequest(leaveRequestData, {
      transaction,
    });

    // If approved immediately, mark attendance
    if (req.body.approve_immediately !== false) {
      await leaveRequestService.markAttendance(
        leaveRequest,
        targetUserType,
        req.body.from_date,
        req.body.to_date,
        { transaction }
      );
    }

    await transaction.commit();

    return sendCreated(res, leaveRequest, 'Leave marked successfully');
  } catch (error) {
    await transaction.rollback();
    return sendError(res, error.message || 'Failed to mark leave');
  }
};
