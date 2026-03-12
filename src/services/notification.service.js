/**
 * The Clouds Academy - Notification Service
 */

import Notification from '../models/postgres/Notification.model.js';

export const createNotification = async (data) => {
  return Notification.create(data);
};

export const getUserNotifications = async (userId, { page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;
  const { count, rows } = await Notification.findAndCountAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });
  return { notifications: rows, total: count };
};

export const markAsRead = async (notificationId, userId) => {
  await Notification.update(
    { is_read: true, read_at: new Date() },
    { where: { id: notificationId, user_id: userId } }
  );
};

export const markAllAsRead = async (userId) => {
  await Notification.update(
    { is_read: true, read_at: new Date() },
    { where: { user_id: userId, is_read: false } }
  );
};

export const getUnreadCount = async (userId) => {
  return Notification.count({ where: { user_id: userId, is_read: false } });
};

export default { createNotification, getUserNotifications, markAsRead, markAllAsRead, getUnreadCount };
