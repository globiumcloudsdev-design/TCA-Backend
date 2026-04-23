// src/api/controllers/portal/leaveRequests.portal.controller.js
/**
 * Leave Requests Portal Controller
 * Student, Teacher, and Staff leave request endpoints for portals
 */

import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound,
  sendBadRequest,
} from '../../../utils/helpers/response.helper.js';
import * as leaveRequestsPortalService from '../../../services/portal/leaveRequests.portal.service.js';
import models from '../../../models/postgres/index.js';

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
  return req.user?.branch_id || req.body?.branch_id || null;
};

/**
 * Helper to determine user type from token
 */
const getUserType = (req) => {
  const userType = req.user?.user_type;
  if (userType === 'TEACHER') return 'TEACHER';
  if (userType === 'STUDENT') return 'STUDENT';

  if (userType === 'STAFF') return 'STAFF';
  return userType;
};

/**
 * Get my leave requests (Portal)
 * GET /api/v1/portal/student|teacher|parent/leave-requests
 */
export const getMyLeaveRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = getUserType(req);

    const filters = {
      status: req.query.status,
      child_id: req.query.child_id,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'DESC',
    };

    const result = await leaveRequestsPortalService.getMyLeaveRequests(userId, userType, filters);

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
 * Create leave request (Portal)
 * POST /api/v1/portal/student|teacher|parent/leave-requests
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

    const leaveRequest = await leaveRequestsPortalService.createLeaveRequest(
      userId,
      userType,
      instituteId,
      branchId,
      req.body
    );

    await transaction.commit();
    return sendCreated(res, leaveRequest, 'Leave request created successfully');
  } catch (error) {
    await transaction.rollback();
    return sendError(res, error.message || 'Failed to create leave request');
  }
};

/**
 * Get my leave statistics (Portal)
 * GET /api/v1/portal/student|teacher|parent/leave-requests/statistics
 */
export const getMyLeaveStatistics = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendBadRequest(res, 'Institute ID not found');
    }

    const userId = req.user.id;
    const userType = getUserType(req);
    const childId = req.query.child_id;

    const stats = await leaveRequestsPortalService.getLeaveStatistics(userId, userType, instituteId, childId);

    return sendSuccess(res, stats, 'Leave statistics fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch leave statistics');
  }
};

/**
 * Get leave balance (Portal)
 * GET /api/v1/portal/student|teacher|parent/leave-balance
 */
export const getLeaveBalance = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendBadRequest(res, 'Institute ID not found');
    }

    const userId = req.user.id;
    const userType = getUserType(req);
    const childId = req.query.child_id;

    const balance = await leaveRequestsPortalService.getLeaveBalance(userId, userType, instituteId, childId);

    return sendSuccess(res, balance, 'Leave balance fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch leave balance');
  }
};

/**
 * Cancel leave request (Portal)
 * PATCH /api/v1/portal/student|teacher|parent/leave-requests/:id/cancel
 */
export const cancelLeaveRequest = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const leaveRequest = await leaveRequestsPortalService.cancelLeaveRequest(
      req.params.id,
      req.user.id
    );

    await transaction.commit();
    return sendSuccess(res, leaveRequest, 'Leave request cancelled successfully');
  } catch (error) {
    await transaction.rollback();
    if (error.message.includes('not found')) {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to cancel leave request');
  }
};

/**
 * Get pending leave approvals (For HOD/Principal/Admin)
 * GET /api/v1/portal/teacher|parent/leave-requests/pending
 */
export const getPendingLeaveApprovals = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendBadRequest(res, 'Institute ID not found');
    }

    const filters = {
      user_type: req.query.user_type,
      branch_id: req.query.branch_id || getBranchId(req),
      page: req.query.page || 1,
      limit: req.query.limit || 10,
    };

    const result = await leaveRequestsPortalService.getPendingLeaveApprovals(instituteId, filters);

    return sendPaginated(
      res,
      result.data,
      result.pagination,
      'Pending leave approvals fetched successfully'
    );
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch pending approvals');
  }
};
