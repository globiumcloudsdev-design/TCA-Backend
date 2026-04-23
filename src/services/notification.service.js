/**
 * The Clouds Academy - Notification Service (Perfect Edition)
 *
 * Supports:
 * ✅ Single user notifications
 * ✅ Broadcast to multiple users (All Parents, All Teachers, All Students, All Staff, etc.)
 * ✅ Branch-scoped & School-scoped notifications
 * ✅ Multiple channels (in_app, email, sms, push)
 * ✅ Real-time Socket.io integration
 * ✅ Flexible data storage (JSONB)
 */

import Notification from '../models/postgres/Notification.model.js';
import sequelize from '../config/database.js';
import { getIO, emitToUser, emitToSchool } from '../sockets/index.js';
import logger from '../config/logger.js';

// ─────────────────────────────────────────────────────────────────
// ✅ SINGLE USER NOTIFICATION
// ─────────────────────────────────────────────────────────────────

/**
 * Send notification to a specific user
 * @param {Object} data - { institute_id, branch_id?, user_id, title, body, type, channel, data }
 * @param {Boolean} emitRealtime - Should emit socket event
 */
export const createNotification = async (data, emitRealtime = true) => {
  const notification = await Notification.create(data);

  // Emit real-time event
  if (emitRealtime && data.user_id) {
    emitToUser(data.user_id, 'notification', {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      data: notification.data,
      timestamp: notification.created_at,
    });
  }

  logger.info(`📬 Notification sent to user ${data.user_id}`);
  return notification;
};

// ─────────────────────────────────────────────────────────────────
// ✅ BROADCAST NOTIFICATIONS (PERFECT VERSION)
// ─────────────────────────────────────────────────────────────────

/**
 * Broadcast notification to multiple users based on filters
 *
 * @param {Object} options
 *   @param {String} institute_id - Required
 *   @param {String} branch_id - Optional filter
 *   @param {String} recipient_type - ALL_PARENTS | ALL_STUDENTS | ALL_TEACHERS | ALL_STAFF | PARENTS | STUDENTS | TEACHERS | STAFF
 *   @param {String} title
 *   @param {String} body
 *   @param {String} type - 'fee' | 'attendance' | 'exam' | 'general' | 'alert' | 'system'
 *   @param {String} channel - 'in_app' | 'email' | 'sms' | 'push' (default: 'in_app')
 *   @param {Object} data - Extra data (JSONB)
 *   @param {Boolean} emitRealtime - Should emit socket events
 *
 * @returns {Object} { notificationIds, count, recipientType }
 */
export const broadcastNotification = async ({
  institute_id,
  branch_id,
  recipient_type = 'ALL_PARENTS', // ALL_PARENTS, ALL_STUDENTS, ALL_TEACHERS, ALL_STAFF, etc.
  title,
  body,
  type = 'general',
  channel = 'in_app',
  data = {},
  emitRealtime = true,
}) => {
  try {
    let userIds = [];

    // Map recipient type to database user_type enum values
    const typeMap = {
      ALL_PARENTS: 'PARENT',
      PARENTS: 'PARENT',
      ALL_STUDENTS: 'STUDENT',
      STUDENTS: 'STUDENT',
      ALL_TEACHERS: 'TEACHER',
      TEACHERS: 'TEACHER',
      ALL_STAFF: 'STAFF',
      STAFF: 'STAFF',
      ALL_ADMINS: 'INSTITUTE_ADMIN',
      ADMINS: 'INSTITUTE_ADMIN',
      All_BRANCH_ADMINS: 'BRANCH_ADMIN',
      BRANCH_ADMINS: 'BRANCH_ADMIN',
    };

    const userType = typeMap[recipient_type] || 'PARENT';

    // Find all users matching criteria
    const query = {
      user_type: userType,
      school_id: institute_id,
    };

    // Add branch filter if specified
    if (branch_id) {
      query.branch_id = branch_id;
    }

    const { User } = sequelize.models;
    const users = await User.findAll({
      where: query,
      attributes: ['id'],
      raw: true,
    });

    userIds = users.map((u) => u.id);

    // Bulk create notifications
    const notifications = await Notification.bulkCreate(
      userIds.map((user_id) => ({
        institute_id,
        branch_id: branch_id || null,
        user_id,
        title,
        body,
        type,
        channel,
        data,
      }))
    );

    // Emit real-time events to each user
    if (emitRealtime) {
      notifications.forEach((notif) => {
        emitToUser(notif.user_id, 'notification', {
          id: notif.id,
          title: notif.title,
          body: notif.body,
          type: notif.type,
          data: notif.data,
          timestamp: notif.created_at,
        });
      });

      // Also emit to school room for admin monitoring
      emitToSchool(institute_id, 'notification:broadcast', {
        title,
        type,
        recipientType: userType,
        count: userIds.length,
        timestamp: new Date(),
      });
    }

    logger.info(
      `📢 Broadcast notification sent to ${userIds.length} ${userType}s in institute ${institute_id}`
    );

    return {
      notificationIds: notifications.map((n) => n.id),
      count: notifications.length,
      recipientType: userType,
      channel,
      type,
    };
  } catch (error) {
    logger.error(`❌ Broadcast notification failed: ${error.message}`);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────
// ✅ GET NOTIFICATIONS (with filtering)
// ─────────────────────────────────────────────────────────────────

/**
 * Get paginated notifications for a user with optional filters
 */
export const getUserNotifications = async (
  userId,
  { page = 1, limit = 20, type, is_read, sort = 'DESC' } = {}
) => {
  const offset = (page - 1) * limit;
  const where = { user_id: userId };

  // Filter by type if provided
  if (type) {
    where.type = type;
  }

  // Filter by read status if provided
  if (is_read !== undefined) {
    where.is_read = is_read === 'true' || is_read === true;
  }

  const { count, rows } = await Notification.findAndCountAll({
    where,
    order: [['created_at', sort]],
    limit,
    offset,
  });

  return {
    notifications: rows,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit),
    },
  };
};

// ─────────────────────────────────────────────────────────────────
// ✅ MARK NOTIFICATIONS AS READ
// ─────────────────────────────────────────────────────────────────

/**
 * Mark single notification as read
 */
export const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.update(
    { is_read: true, read_at: new Date() },
    { where: { id: notificationId, user_id: userId }, returning: true }
  );

  if (notification[0] === 0) {
    throw new Error('Notification not found or access denied');
  }

  return notification[1][0];
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId) => {
  const result = await Notification.update(
    { is_read: true, read_at: new Date() },
    { where: { user_id: userId, is_read: false } }
  );

  return { updated: result[0] };
};

// ─────────────────────────────────────────────────────────────────
// ✅ DELETE NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId, userId) => {
  const result = await Notification.destroy({
    where: { id: notificationId, user_id: userId },
  });

  if (result === 0) {
    throw new Error('Notification not found or access denied');
  }

  return { deleted: true };
};

/**
 * Delete all old read notifications for a user (cleanup)
 */
export const deleteOldReadNotifications = async (userId, daysOld = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await Notification.destroy({
    where: {
      user_id: userId,
      is_read: true,
      read_at: { [sequelize.Sequelize.Op.lt]: cutoffDate },
    },
  });

  return { deleted: result };
};

// ─────────────────────────────────────────────────────────────────
// ✅ GET UNREAD COUNT
// ─────────────────────────────────────────────────────────────────

export const getUnreadCount = async (userId) => {
  return Notification.count({ where: { user_id: userId, is_read: false } });
};

/**
 * Get notification stats for a user
 */
export const getNotificationStats = async (userId) => {
  const unreadCount = await Notification.count({
    where: { user_id: userId, is_read: false },
  });

  const totalCount = await Notification.count({
    where: { user_id: userId },
  });

  // Count by type
  const byType = await Notification.findAll({
    where: { user_id: userId },
    attributes: ['type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['type'],
    raw: true,
  });

  return {
    unreadCount,
    totalCount,
    byType: byType.reduce((acc, t) => ({ ...acc, [t.type]: t.count }), {}),
  };
};

/**
 * Get all notifications (for admin/global view)
 */
export const getAll = async (
  { page = 1, limit = 20, type, is_read, sort = 'DESC' } = {}
) => {
  const offset = (page - 1) * limit;
  const where = {};

  // Filter by type if provided
  if (type) {
    where.type = type;
  }

  // Filter by read status if provided
  if (is_read !== undefined) {
    where.is_read = is_read === 'true' || is_read === true;
  }

  const { count, rows } = await Notification.findAndCountAll({
    where,
    order: [['created_at', sort]],
    limit,
    offset,
  });

  return {
    rows,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit),
    },
  };
};

export default {
  createNotification,
  broadcastNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteOldReadNotifications,
  getUnreadCount,
  getNotificationStats,
  getAll,
};
