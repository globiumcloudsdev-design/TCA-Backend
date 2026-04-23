// src/services/leaveRequest.service.js
import models from '../models/postgres/index.js';
import { Op } from 'sequelize';
import { createNotification, broadcastNotification } from './notification.service.js';
import logger from '../config/logger.js';

const { LeaveRequest, LeaveType, User, StaffAttendance, StudentAttendance, sequelize } = models;

/**
 * Helper: Send leave request notification to HOD/Admin
 */
const notifyLeaveRequest = async (leaveRequest, eventType = 'created') => {
  try {
    const requester = await User.findByPk(leaveRequest.user_id, {
      attributes: ['id', 'first_name', 'last_name', 'school_id']
    });

    if (!requester) return;

    const requesterName = `${requester.first_name} ${requester.last_name}`;
    const daysCount = leaveRequest.days_count || 1;

    let targetUserId = leaveRequest.reporting_officer_id || leaveRequest.approved_by;

    if (eventType === 'created') {
      // If no reporting officer or approved_by, we should still notify the school admin
      if (!targetUserId) {
        // Find an admin for this school to notify if no specific person is assigned
        const admin = await User.findOne({
          where: { school_id: requester.school_id, user_type: 'INSTITUTE_ADMIN' },
          attributes: ['id']
        });
        targetUserId = admin?.id;
      }

      if (!targetUserId) {
        logger.warn(`No target user found for leave request notification (request: ${leaveRequest.id})`);
        return;
      }

      // Notify HOD/Admin about new leave request
      await createNotification({
        institute_id: requester.school_id,
        user_id: targetUserId,
        title: `📋 New Leave Request from ${requesterName}`,
        body: `${requesterName} requested ${daysCount} day(s) leave from ${new Date(leaveRequest.from_date).toLocaleDateString()}`,
        type: 'alert',
        channel: 'in_app',
        data: {
          requestId: leaveRequest.id,
          requesterName,
          fromDate: leaveRequest.from_date,
          toDate: leaveRequest.to_date,
          reason: leaveRequest.reason,
          daysCount
        }
      }, true);
    } else if (eventType === 'approved') {
      // Notify requester when leave is approved
      await createNotification({
        institute_id: requester.school_id,
        user_id: leaveRequest.user_id,
        title: `✅ Leave Request Approved`,
        body: `Your leave request for ${daysCount} day(s) has been approved`,
        type: 'general',
        channel: 'in_app',
        data: {
          requestId: leaveRequest.id,
          fromDate: leaveRequest.from_date,
          toDate: leaveRequest.to_date
        }
      }, true);
    } else if (eventType === 'rejected') {
      // Notify requester when leave is rejected
      await createNotification({
        institute_id: requester.school_id,
        user_id: leaveRequest.user_id,
        title: `❌ Leave Request Rejected`,
        body: `Your leave request has been rejected. Reason: ${leaveRequest.approval_remarks || 'Not specified'}`,
        type: 'alert',
        channel: 'in_app',
        data: {
          requestId: leaveRequest.id,
          fromDate: leaveRequest.from_date,
          remarks: leaveRequest.approval_remarks
        }
      }, true);
    } else if (eventType === 'cancelled') {
      // Notify HOD/Admin when requester cancels
      if (!targetUserId) {
        const admin = await User.findOne({
          where: { school_id: requester.school_id, user_type: 'INSTITUTE_ADMIN' },
          attributes: ['id']
        });
        targetUserId = admin?.id;
      }

      if (targetUserId) {
        await createNotification({
          institute_id: requester.school_id,
          user_id: targetUserId,
          title: `📋 Leave Request Cancelled`,
          body: `${requesterName}'s leave request for ${daysCount} day(s) has been cancelled`,
          type: 'general',
          channel: 'in_app',
          data: {
            requestId: leaveRequest.id,
            requesterName,
            fromDate: leaveRequest.from_date
          }
        }, true);
      }
    } else if (eventType === 'updated') {
      // Notify HOD/Admin when requester updates pending request
      if (!targetUserId) {
        const admin = await User.findOne({
          where: { school_id: requester.school_id, user_type: 'INSTITUTE_ADMIN' },
          attributes: ['id']
        });
        targetUserId = admin?.id;
      }

      if (targetUserId) {
        await createNotification({
          institute_id: requester.school_id,
          user_id: targetUserId,
          title: `📋 Leave Request Updated`,
          body: `${requesterName} updated their leave request for ${daysCount} day(s) from ${new Date(leaveRequest.from_date).toLocaleDateString()}`,
          type: 'general',
          channel: 'in_app',
          data: {
            requestId: leaveRequest.id,
            requesterName,
            fromDate: leaveRequest.from_date,
            toDate: leaveRequest.to_date,
            reason: leaveRequest.reason,
            daysCount
          }
        }, true);
      }
    }
  } catch (error) {
    logger.error(`Failed to send leave request notification: ${error.message}`);
  }
};

/**
 * Create leave request
 * @param {Object} data - Leave request data
 * @param {Object} options - Transaction options
 */
export const createLeaveRequest = async (data, options = {}) => {
  const { transaction } = options;

  const leaveRequest = await LeaveRequest.create(data, { transaction });

  // Send notification
  try {
    await notifyLeaveRequest(leaveRequest, 'created');
  } catch (notifError) {
    logger.error(`Notification error in createLeaveRequest: ${notifError.message}`);
  }

  return await LeaveRequest.findByPk(leaveRequest.id, {
    include: [
      { model: models.LeaveType, as: 'leaveType' },
      { model: models.User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email'] },
      { model: models.User, as: 'approver', attributes: ['id', 'first_name', 'last_name'] },
    ],
    transaction,
  });
};

/**
 * Get my leave requests (for staff/student)
 * @param {string} userId - User ID
 * @param {string} userType - STAFF or STUDENT
 * @param {Object} filters - { status, from_date, to_date, page, limit, sortBy, sortOrder }
 */
export const getMyLeaveRequests = async (userId, userType, filters = {}) => {
  const {
    status,
    from_date,
    to_date,
    page = 1,
    limit = 10,
    sortBy = 'created_at',
    sortOrder = 'DESC',
  } = filters;

  const offset = (page - 1) * limit;
  const where = { user_id: userId, user_type: userType };

  if (status) where.status = status;

  if (from_date || to_date) {
    where.from_date = {};
    if (from_date) where.from_date[Op.gte] = new Date(from_date);
    if (to_date) where.from_date[Op.lte] = new Date(to_date);
  }

  const { count, rows } = await LeaveRequest.findAndCountAll({
    where,
    include: [
      { model: models.LeaveType, as: 'leaveType' },
      { model: models.User, as: 'approver', attributes: ['id', 'first_name', 'last_name'] },
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
      totalPages: Math.ceil(count / limit),
    },
  };
};

/**
 * Get all leave requests (admin/approver)
 * @param {Object} filters - Various filters
 */
export const getAllLeaveRequests = async (filters = {}) => {
  const {
    institute_id,
    branch_id,
    status,
    user_type,
    user_id,
    leave_type_id,
    from_date,
    to_date,
    search,
    page = 1,
    limit = 10,
    sortBy = 'created_at',
    sortOrder = 'DESC',
  } = filters;

  const offset = (page - 1) * limit;
  const where = {};

  if (institute_id) where.institute_id = institute_id;
  if (branch_id) where.branch_id = branch_id;
  if (status) where.status = status;
  if (user_type) where.user_type = user_type;
  if (user_id) where.user_id = user_id;
  if (leave_type_id) where.leave_type_id = leave_type_id;

  if (from_date || to_date) {
    where.from_date = {};
    if (from_date) where.from_date[Op.gte] = new Date(from_date);
    if (to_date) where.from_date[Op.lte] = new Date(to_date);
  }

  if (search) {
    where[Op.or] = [
      { reason: { [Op.iLike]: `%${search}%` } },
      { approval_remarks: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { count, rows } = await LeaveRequest.findAndCountAll({
    where,
    include: [
      { model: models.LeaveType, as: 'leaveType' },
      { model: models.User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email'] },
      { model: models.User, as: 'approver', attributes: ['id', 'first_name', 'last_name'] },
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
      totalPages: Math.ceil(count / limit),
    },
  };
};

/**
 * Get leave request by ID
 */
export const getLeaveRequestById = async (id) => {
  const leaveRequest = await LeaveRequest.findByPk(id, {
    include: [
      { model: models.LeaveType, as: 'leaveType' },
      { model: models.User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email'] },
      { model: models.User, as: 'approver', attributes: ['id', 'first_name', 'last_name'] },
    ],
  });

  if (!leaveRequest) {
    throw new Error('Leave request not found');
  }

  return leaveRequest;
};

/**
 * Update leave request (only if PENDING)
 */
export const updateLeaveRequest = async (id, updateData, userId, options = {}) => {
  const { transaction } = options;

  const leaveRequest = await LeaveRequest.findByPk(id, { transaction });

  if (!leaveRequest) {
    throw new Error('Leave request not found');
  }

  if (leaveRequest.user_id !== userId) {
    throw new Error('Unauthorized: Can only update your own leave requests');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new Error('Cannot update leave request that is not pending');
  }

  await leaveRequest.update(updateData, { transaction });

  // Send notification
  try {
    await notifyLeaveRequest(leaveRequest, 'updated');
  } catch (notifError) {
    logger.error(`Notification error in updateLeaveRequest: ${notifError.message}`);
  }

  return await LeaveRequest.findByPk(id, {
    include: [
      { model: models.LeaveType, as: 'leaveType' },
      { model: models.User, as: 'approver', attributes: ['id', 'first_name', 'last_name'] },
    ],
    transaction,
  });
};

/**
 * Approve or reject leave request
 */
export const approveRejectLeaveRequest = async (id, approvalData, approverId, options = {}) => {
  const { transaction } = options;
  const { status, approval_remarks } = approvalData;

  const leaveRequest = await LeaveRequest.findByPk(id, { transaction });

  if (!leaveRequest) {
    throw new Error('Leave request not found');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new Error('Only pending leave requests can be approved or rejected');
  }

  await leaveRequest.update(
    {
      status,
      approved_by: approverId,
      approval_remarks,
      approved_at: new Date(),
    },
    { transaction }
  );

  // If approved, mark attendance
  if (status === 'APPROVED') {
    const { user_id, user_type, leave_type_id, from_date, to_date } = leaveRequest;

    // Generate dates between from_date and to_date
    const dates = generateDateRange(new Date(from_date), new Date(to_date));

    if (user_type === 'STAFF' || user_type === 'TEACHER') {
      // Mark staff attendance
      for (const date of dates) {
        await StaffAttendance.findOrCreate({
          where: {
            staff_id: user_id,
            date: date.toISOString().split('T')[0],
          },
          defaults: {
            institute_id: leaveRequest.institute_id,
            branch_id: leaveRequest.branch_id,
            status: 'LEAVE',
            leave_type_id,
            leave_request_id: id,
            marked_by: approverId,
            marked_at: new Date(),
          },
          transaction,
        });
      }
    } else if (user_type === 'STUDENT') {
      // Mark student attendance
      for (const date of dates) {
        await StudentAttendance.findOrCreate({
          where: {
            student_id: user_id,
            date: date.toISOString().split('T')[0],
          },
          defaults: {
            school_id: leaveRequest.institute_id,
            branch_id: leaveRequest.branch_id,
            status: 'leave',
            leave_type_id,
            leave_request_id: id,
            marked_by: approverId,
          },
          transaction,
        });
      }
    }
  }

  // Send notification
  try {
    if (status === 'APPROVED') {
      await notifyLeaveRequest(leaveRequest, 'approved');
    } else if (status === 'REJECTED') {
      await notifyLeaveRequest(leaveRequest, 'rejected');
    }
  } catch (notifError) {
    logger.error(`Notification error in approveRejectLeaveRequest: ${notifError.message}`);
  }

  return await LeaveRequest.findByPk(id, {
    include: [
      { model: models.LeaveType, as: 'leaveType' },
      { model: models.User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email'] },
      { model: models.User, as: 'approver', attributes: ['id', 'first_name', 'last_name'] },
    ],
    transaction,
  });
};

/**
 * Cancel leave request (only if PENDING)
 */
export const cancelLeaveRequest = async (id, userId, options = {}) => {
  const { transaction } = options;

  const leaveRequest = await LeaveRequest.findByPk(id, { transaction });

  if (!leaveRequest) {
    throw new Error('Leave request not found');
  }

  if (leaveRequest.user_id !== userId) {
    throw new Error('Unauthorized: Can only cancel your own leave requests');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new Error('Cannot cancel leave request that is not pending');
  }

  await leaveRequest.update({ status: 'CANCELLED' }, { transaction });

  // Send notification
  try {
    await notifyLeaveRequest(leaveRequest, 'cancelled');
  } catch (notifError) {
    logger.error(`Notification error in cancelLeaveRequest: ${notifError.message}`);
  }

  return await LeaveRequest.findByPk(id, {
    include: [
      { model: models.LeaveType, as: 'leaveType' },
      { model: models.User, as: 'approver', attributes: ['id', 'first_name', 'last_name'] },
    ],
    transaction,
  });
};

/**
 * Helper function to generate date range
 */
const generateDateRange = (startDate, endDate) => {
  const dates = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

/**
 * Get leave statistics
 */
export const getLeaveStatistics = async (userId, userType, instituteId) => {
  const approved = await LeaveRequest.count({
    where: {
      user_id: userId,
      user_type: userType,
      institute_id: instituteId,
      status: 'APPROVED',
    },
  });

  const pending = await LeaveRequest.count({
    where: {
      user_id: userId,
      user_type: userType,
      institute_id: instituteId,
      status: 'PENDING',
    },
  });

  const rejected = await LeaveRequest.count({
    where: {
      user_id: userId,
      user_type: userType,
      institute_id: instituteId,
      status: 'REJECTED',
    },
  });

  return {
    approved,
    pending,
    rejected,
    total: approved + pending + rejected,
  };
};
