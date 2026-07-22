/**
 * The Clouds Academy - Notification Routes (Perfect Edition)
 *
 * Routes:
 * ✅ GET    /notifications
 * ✅ GET    /notifications/unread-count
 * ✅ GET    /notifications/stats
 * ✅ PATCH  /notifications/:id/read
 * ✅ PATCH  /notifications/mark-all-read
 * ✅ DELETE /notifications/:id
 * ✅ DELETE /notifications/cleanup-old
 * ✅ POST   /notifications/broadcast (Admin)
 * ✅ POST   /notifications/send (Teacher/Staff/Admin)
 */

import { Router } from 'express';
import {
  getNotificationsController,
  getUnreadCountController,
  getStatsController,
  markAsReadController,
  markAllAsReadController,
  deleteNotificationController,
  cleanupOldNotificationsController,
  sendNotificationController,
  broadcastNotificationController,
} from '../../controllers/notification.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import { schoolContext } from '../../middlewares/schoolContext.middleware.js';
import { getActiveAnnouncements } from '../../controllers/announcement.controller.js';

const router = Router();

// All routes require authentication
router.use(protect, schoolContext);

// ─────────────────────────────────────────────────────────────────
// ✅ GET Endpoints (Public - all authenticated users)
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/notifications
 * Get paginated notifications for current user
 * Query: ?page=1&limit=20&type=fee&is_read=false&sort=DESC
 */
router.get('/', getNotificationsController);

/**
 * GET /api/v1/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', getUnreadCountController);

/**
 * GET /api/v1/notifications/stats
 * Get notification statistics
 */
router.get('/stats', getStatsController);

/**
 * GET /api/v1/notifications/global
 * Get active global announcements for the current institute
 */
router.get('/global', getActiveAnnouncements);

// ─────────────────────────────────────────────────────────────────
// ✅ PATCH Endpoints (User actions)
// ─────────────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark single notification as read
 */
router.patch('/:id/read', markAsReadController);

/**
 * PATCH /api/v1/notifications/mark-all-read
 * Mark all notifications as read
 */
router.patch('/mark-all-read', markAllAsReadController);

// ─────────────────────────────────────────────────────────────────
// ✅ DELETE Endpoints (User actions)
// ─────────────────────────────────────────────────────────────────

/**
 * DELETE /api/v1/notifications/:id
 * Delete a notification
 */
router.delete('/:id', deleteNotificationController);

/**
 * DELETE /api/v1/notifications/cleanup-old
 * Delete old read notifications (cleanup)
 * Query: ?daysOld=30
 */
router.delete('/cleanup-old', cleanupOldNotificationsController);

// ─────────────────────────────────────────────────────────────────
// ✅ POST Endpoints (Admin/Staff/Teacher - send notifications)
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/notifications/send
 * Send notification to specific user
 * Body: { user_id, title, body, type, channel, data }
 * Permission: For authenticated users
 */
router.post('/send', sendNotificationController);

/**
 * POST /api/v1/notifications/broadcast
 * Broadcast notification to multiple users
 * Body: { recipient_type, title, body, type, channel, data, branch_id? }
 * Permission: For authenticated users
 */
router.post('/broadcast', broadcastNotificationController);

export default router;
