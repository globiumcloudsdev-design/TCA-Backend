/**
 * The Clouds Academy - Notification Controller (Perfect Edition)
 *
 * Endpoints:
 * ✅ GET    /notifications
 * ✅ GET    /notifications/unread-count
 * ✅ GET    /notifications/stats
 * ✅ PATCH  /notifications/:id/read
 * ✅ PATCH  /notifications/mark-all-read
 * ✅ DELETE /notifications/:id
 * ✅ DELETE /notifications/cleanup-old
 * ✅ POST   /notifications/broadcast (Admin only)
 * ✅ POST   /notifications/send (Admin only)
 */

import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendPaginated, sendCreated } from '../../utils/helpers/response.helper.js';
import {
  createNotification,
  broadcastNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteOldReadNotifications,
  getUnreadCount,
  getNotificationStats,
} from '../../services/notification.service.js';

// ─────────────────────────────────────────────────────────────────
// ✅ GET NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────

export const getNotificationsController = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, type, is_read, sort = 'DESC' } = req.query;
  const userId = req.user.id;

  const { notifications, pagination } = await getUserNotifications(userId, {
    page: parseInt(page),
    limit: parseInt(limit),
    type,
    is_read,
    sort,
  });

  sendPaginated(res, notifications, pagination, 'Notifications retrieved');
});

// ─────────────────────────────────────────────────────────────────
// ✅ GET UNREAD COUNT
// ─────────────────────────────────────────────────────────────────

export const getUnreadCountController = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const count = await getUnreadCount(userId);
  sendSuccess(res, { count }, 'Unread count retrieved');
});

// ─────────────────────────────────────────────────────────────────
// ✅ GET NOTIFICATION STATS
// ─────────────────────────────────────────────────────────────────

export const getStatsController = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const stats = await getNotificationStats(userId);
  sendSuccess(res, stats, 'Notification stats retrieved');
});

// ─────────────────────────────────────────────────────────────────
// ✅ MARK AS READ
// ─────────────────────────────────────────────────────────────────

export const markAsReadController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const notification = await markAsRead(id, userId);
  sendSuccess(res, notification, 'Notification marked as read');
});

// ─────────────────────────────────────────────────────────────────
// ✅ MARK ALL AS READ
// ─────────────────────────────────────────────────────────────────

export const markAllAsReadController = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await markAllAsRead(userId);
  sendSuccess(res, result, 'All notifications marked as read');
});

// ─────────────────────────────────────────────────────────────────
// ✅ DELETE NOTIFICATION
// ─────────────────────────────────────────────────────────────────

export const deleteNotificationController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await deleteNotification(id, userId);
  sendSuccess(res, result, 'Notification deleted');
});

// ─────────────────────────────────────────────────────────────────
// ✅ DELETE OLD READ NOTIFICATIONS (Cleanup)
// ─────────────────────────────────────────────────────────────────

export const cleanupOldNotificationsController = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { daysOld = 30 } = req.query;

  const result = await deleteOldReadNotifications(userId, parseInt(daysOld));
  sendSuccess(res, result, `Notifications older than ${daysOld} days deleted`);
});

// ─────────────────────────────────────────────────────────────────
// ✅ SEND SINGLE NOTIFICATION (Admin/Teacher/Staff to specific user)
// ─────────────────────────────────────────────────────────────────

/**
 * POST /notifications/send
 * Body: { user_id, title, body, type, channel, data }
 */
export const sendNotificationController = catchAsync(async (req, res) => {
  const { user_id, title, body, type = 'general', channel = 'in_app', data } = req.body;

  // Validation
  if (!user_id || !title || !body) {
    return res.status(400).json({
      success: false,
      message: 'user_id, title, and body are required',
    });
  }

  const notification = await createNotification(
    {
      institute_id: req.school.id,
      branch_id: req.user.branch_id || null,
      user_id,
      title,
      body,
      type,
      channel,
      data: data || {},
    },
    true // emitRealtime
  );

  sendCreated(res, notification, 'Notification sent successfully');
});

// ─────────────────────────────────────────────────────────────────
// ✅ BROADCAST NOTIFICATION (Admin only)
// ─────────────────────────────────────────────────────────────────

/**
 * POST /notifications/broadcast
 * Body: {
 *   recipient_type: 'ALL_PARENTS' | 'ALL_STUDENTS' | 'ALL_TEACHERS' | 'ALL_STAFF' | etc.
 *   title, body, type, channel, data, branch_id?
 * }
 */
export const broadcastNotificationController = catchAsync(async (req, res) => {
  const {
    recipient_type = 'ALL_PARENTS',
    title,
    body,
    type = 'general',
    channel = 'in_app',
    data,
    branch_id,
  } = req.body;

  // Validation
  if (!title || !body) {
    return res.status(400).json({
      success: false,
      message: 'title and body are required',
    });
  }

  const result = await broadcastNotification({
    institute_id: req.school.id,
    branch_id: branch_id || null,
    recipient_type,
    title,
    body,
    type,
    channel,
    data: data || {},
    emitRealtime: true,
  });

  sendCreated(res, result, `Broadcast notification sent to ${result.count} users`);
});

export default {
  getNotificationsController,
  getUnreadCountController,
  getStatsController,
  markAsReadController,
  markAllAsReadController,
  deleteNotificationController,
  cleanupOldNotificationsController,
  sendNotificationController,
  broadcastNotificationController,
};
