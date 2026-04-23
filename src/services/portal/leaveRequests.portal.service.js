// src/services/portal/leaveRequests.portal.service.js
/**
 * Leave Request Portal Services
 * Integration for Student, Teacher, and Staff leave requests
 */

import models from '../../models/postgres/index.js';
import * as leaveRequestService from '../leaveRequest.service.js';

/**
 * Get my leave requests (Portal wrapper)
 */
export const getMyLeaveRequests = async (userId, userType, filters = {}) => {
  let queryUserId = userId;
  let queryUserType = userType;
  
  if (userType === 'PARENT') {
    if (!filters.child_id) return { data: [], pagination: { total: 0, pages: 0, current_page: 1, limit: 10 } };
    
    // Assume parent only queries for their own selected child here
    queryUserId = filters.child_id;
    queryUserType = 'STUDENT';
  }
  
  return await leaveRequestService.getMyLeaveRequests(queryUserId, queryUserType, filters);
};

/**
 * Create leave request (Portal wrapper)
 */
export const createLeaveRequest = async (userId, userType, instituteId, branchId, leaveData) => {
  let targetUserId = userId;
  let targetUserType = userType;

  if (userType === 'PARENT') {
    if (!leaveData.child_id) {
      throw new Error('child_id is required when a parent applies for leave');
    }
    // Verify parent owns this child
    const parent = await models.User.findByPk(userId);
    const childrenIds = 
      parent?.details?.parentDetails?.student_ids ||
      parent?.student_ids || 
      parent?.details?.student_ids || 
      parent?.details?.children_ids || 
      [];
      
    if (!childrenIds.includes(leaveData.child_id)) {
      throw new Error('Not authorized to apply leave for this child');
    }
    targetUserId = leaveData.child_id;
    targetUserType = 'STUDENT';
  }

  const leaveRequestData = {
    ...leaveData,
    institute_id: instituteId,
    branch_id: branchId,
    user_id: targetUserId,
    user_type: targetUserType,
    status: 'PENDING',
  };

  return await leaveRequestService.createLeaveRequest(leaveRequestData);
};

/**
 * Get leave statistics (Portal wrapper)
 */
export const getLeaveStatistics = async (userId, userType, instituteId, childId) => {
  let targetUserId = userId;
  let targetUserType = userType;
  if (userType === 'PARENT') {
    if (!childId) return { total_requests: 0, pending: 0, approved: 0, rejected: 0 };
    targetUserId = childId;
    targetUserType = 'STUDENT';
  }
  return await leaveRequestService.getLeaveStatistics(targetUserId, targetUserType, instituteId);
};

/**
 * Cancel leave request (Portal wrapper)
 */
export const cancelLeaveRequest = async (leaveRequestId, userId) => {
  return await leaveRequestService.cancelLeaveRequest(leaveRequestId, userId);
};

/**
 * Get pending approvals (for HOD/Principal role)
 */
export const getPendingLeaveApprovals = async (instituteId, filters = {}) => {
  const {
    user_type,
    branch_id,
    page = 1,
    limit = 10,
  } = filters;

  const where = {
    institute_id: instituteId,
    status: 'PENDING',
  };

  if (user_type) where.user_type = user_type;
  if (branch_id) where.branch_id = branch_id;

  const offset = (page - 1) * limit;

  const { count, rows } = await models.LeaveRequest.findAndCountAll({
    where,
    include: [
      { model: models.LeaveType, as: 'leaveType' },
      { model: models.User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email'] },
    ],
    order: [['created_at', 'ASC']],
    limit,
    offset,
  });

  return {
    data: rows,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
};

/**
 * Get leave balance (remaining leaves for a user)
 */
export const getLeaveBalance = async (userId, userType, instituteId, childId) => {
  let targetUserId = userId;
  let targetUserType = userType;
  if (userType === 'PARENT') {
    if (!childId) return {};
    targetUserId = childId;
    targetUserType = 'STUDENT';
  }

  const leaveTypes = await models.LeaveType.findAll({
    where: { institute_id: instituteId, is_active: true },
  });

  const balanceData = {};

  for (const leaveType of leaveTypes) {
    const approved = await models.LeaveRequest.findAll({
      where: {
        user_id: targetUserId,
        user_type: targetUserType,
        leave_type_id: leaveType.id,
        status: 'APPROVED',
      },
    });

    const totalDays = approved.reduce((sum, req) => sum + req.number_of_days, 0);

    balanceData[leaveType.id] = {
      leave_type_name: leaveType.leave_type_name,
      max_days_per_year: leaveType.max_days_per_year,
      used_days: totalDays,
      remaining_days: leaveType.max_days_per_year === 0 ? 'Unlimited' : leaveType.max_days_per_year - totalDays,
      can_take_more: leaveType.max_days_per_year === 0 || (leaveType.max_days_per_year - totalDays) > 0,
    };
  }

  return balanceData;
};
