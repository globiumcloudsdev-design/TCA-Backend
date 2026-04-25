import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import { auditLog } from '../../middlewares/audit.middleware.js';
import * as eventController from '../../controllers/event.controller.js';

const router = Router();

// All routes require authentication
router.use(protect, auditLog);

/**
 * CREATE - Event
 * POST /api/v1/events
 */
router.post(
  '/',
  // hasPermission('events.create'),
  eventController.createEvent
);

/**
 * GET - All events (with filters & pagination)
 * GET /api/v1/events
 * Query: ?institute_id=&branch_id=&event_type=&status=&from_date=&to_date=&search=&page=&limit=
 */
router.get(
  '/',
  // hasPermission('events.read'),
  eventController.getAllEvents
);

/**
 * GET - Upcoming events
 * GET /api/v1/events/upcoming
 */
router.get(
  '/upcoming',
  // hasPermission('events.read'),
  eventController.getUpcomingEvents
);

/**
 * GET - My events (for portal users)
 * GET /api/v1/events/my
 */
router.get(
  '/my',
  eventController.getMyEvents
);

/**
 * GET - Event by ID
 * GET /api/v1/events/:id
 */
router.get(
  '/:id',
  // hasPermission('events.read'),
  eventController.getEventById
);

/**
 * UPDATE - Event
 * PUT /api/v1/events/:id
 */
router.put(
  '/:id',
  // hasPermission('events.update'),
  eventController.updateEvent
);

/**
 * DELETE - Event
 * DELETE /api/v1/events/:id
 */
router.delete(
  '/:id',
  // hasPermission('events.delete'),
  eventController.deleteEvent
);

/**
 * PATCH - Toggle Event Status
 * PATCH /api/v1/events/:id/status
 */
router.patch(
  '/:id/status',
  // hasPermission('events.update'),
  eventController.toggleEventStatus
);

// ═════════════════════════════════════════════════════════════════
// 📋 EVENT ATTENDANCE ROUTES
// ═════════════════════════════════════════════════════════════════

/**
 * GET - Event attendance summary
 * GET /api/v1/events/:id/attendance
 */
router.get(
  '/:id/attendance',
  // hasPermission('events.read'),
  eventController.getEventAttendanceSummary
);

/**
 * POST - Mark student attendance for event
 * POST /api/v1/events/:id/attendance/student
 */
router.post(
  '/:id/attendance/student',
  // hasPermission('events.update'),
  eventController.markStudentEventAttendance
);

/**
 * POST - Mark staff attendance for event
 * POST /api/v1/events/:id/attendance/staff
 */
router.post(
  '/:id/attendance/staff',
  // hasPermission('events.update'),
  eventController.markStaffEventAttendance
);

/**
 * POST - Bulk mark student attendance for event
 * POST /api/v1/events/:id/attendance/students/bulk
 */
router.post(
  '/:id/attendance/students/bulk',
  // hasPermission('events.update'),
  eventController.bulkMarkStudentEventAttendance
);

/**
 * POST - Bulk mark staff attendance for event
 * POST /api/v1/events/:id/attendance/staff/bulk
 */
router.post(
  '/:id/attendance/staff/bulk',
  // hasPermission('events.update'),
  eventController.bulkMarkStaffEventAttendance
);

export default router;

