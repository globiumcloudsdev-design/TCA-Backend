/**
 * The Clouds Academy - Event Controller
 * Handles all HTTP requests for Event CRUD + notifications
 */

import * as eventService from '../../services/event.service.js';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound,
} from '../../utils/helpers/response.helper.js';
import { getInstituteId, getBranchId } from '../../utils/helpers/request.helper.js';
import logger from '../../config/logger.js';

// ─────────────────────────────────────────────────────────────────
// ✅ CREATE EVENT
// ─────────────────────────────────────────────────────────────────

export const createEvent = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const branchId = getBranchId(req);

    const eventData = {
      ...req.body,
      institute_id: instituteId,
      branch_id: branchId,
    };

    const event = await eventService.createEvent(eventData, req.user.id);

    return sendCreated(res, event, 'Event created successfully');
  } catch (error) {
    logger.error(`❌ Create event error: ${error.message}`);
    return sendError(res, error.message || 'Failed to create event', 400);
  }
};

// ─────────────────────────────────────────────────────────────────
// ✅ GET ALL EVENTS
// ─────────────────────────────────────────────────────────────────

export const getAllEvents = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const filters = {
      institute_id: instituteId,
      branch_id: req.query.branch_id,
      event_type: req.query.event_type,
      status: req.query.status,
      audience_type: req.query.audience_type,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      search: req.query.search,
    };

    // Remove undefined filters
    Object.keys(filters).forEach((key) => {
      if (filters[key] === undefined || filters[key] === '') delete filters[key];
    });

    const pagination = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
    };

    const result = await eventService.getAllEvents(filters, pagination);

    return sendPaginated(res, result.data, result.pagination, 'Events fetched successfully');
  } catch (error) {
    logger.error(`❌ Get all events error: ${error.message}`);
    return sendError(res, error.message || 'Failed to fetch events', 500);
  }
};

// ─────────────────────────────────────────────────────────────────
// ✅ GET EVENT BY ID
// ─────────────────────────────────────────────────────────────────

export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    const branchId = getBranchId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const event = await eventService.getEventById(id, instituteId, branchId);

    return sendSuccess(res, event, 'Event fetched successfully');
  } catch (error) {
    logger.error(`❌ Get event by ID error: ${error.message}`);

    if (error.message === 'Event not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to fetch event', 500);
  }
};

// ─────────────────────────────────────────────────────────────────
// ✅ UPDATE EVENT
// ─────────────────────────────────────────────────────────────────

export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const event = await eventService.updateEvent(id, instituteId, req.body);

    return sendSuccess(res, event, 'Event updated successfully');
  } catch (error) {
    logger.error(`❌ Update event error: ${error.message}`);

    if (error.message === 'Event not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update event', 400);
  }
};

// ─────────────────────────────────────────────────────────────────
// ✅ DELETE EVENT
// ─────────────────────────────────────────────────────────────────

export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    const branchId = getBranchId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const result = await eventService.deleteEvent(id, instituteId, branchId);

    return sendSuccess(res, result, result.message);
  } catch (error) {
    logger.error(`❌ Delete event error: ${error.message}`);

    if (error.message === 'Event not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to delete event', 500);
  }
};

// ─────────────────────────────────────────────────────────────────
// ✅ TOGGLE EVENT STATUS
// ─────────────────────────────────────────────────────────────────

export const toggleEventStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    if (!status) {
      return sendError(res, 'Status is required in request body', 400);
    }

    const event = await eventService.toggleEventStatus(id, instituteId, status);

    return sendSuccess(res, event, `Event status changed to ${status}`);
  } catch (error) {
    logger.error(`❌ Toggle event status error: ${error.message}`);

    if (error.message === 'Event not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update event status', 400);
  }
};

// ─────────────────────────────────────────────────────────────────
// ✅ GET UPCOMING EVENTS
// ─────────────────────────────────────────────────────────────────

export const getUpcomingEvents = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const branch_id = req.query.branch_id;
    const limit = parseInt(req.query.limit, 10) || 10;

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const events = await eventService.getUpcomingEvents(instituteId, branch_id, limit);

    return sendSuccess(res, events, 'Upcoming events fetched successfully');
  } catch (error) {
    logger.error(`❌ Get upcoming events error: ${error.message}`);
    return sendError(res, error.message || 'Failed to fetch upcoming events', 500);
  }
};

// ─────────────────────────────────────────────────────────────────
// ✅ GET MY EVENTS (for portal users)
// ─────────────────────────────────────────────────────────────────

export const getMyEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const instituteId = getInstituteId(req);
    const userType = req.user.user_type;

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const events = await eventService.getEventsForUser(userId, instituteId, userType);

    return sendSuccess(res, events, 'My events fetched successfully');
  } catch (error) {
    logger.error(`❌ Get my events error: ${error.message}`);
    return sendError(res, error.message || 'Failed to fetch my events', 500);
  }
};

// ═════════════════════════════════════════════════════════════════
// 📋 EVENT ATTENDANCE CONTROLLERS
// ═════════════════════════════════════════════════════════════════

/**
 * Mark student attendance for an event
 * POST /api/v1/events/:id/attendance/student
 */
export const markStudentEventAttendance = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { student_id, status, remarks } = req.body;
    const markedBy = req.user.id;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    if (!student_id || !status) {
      return sendError(res, 'student_id and status are required', 400);
    }

    const attendance = await eventService.markStudentEventAttendance(
      eventId, student_id, status, markedBy, remarks
    );

    return sendSuccess(res, attendance, 'Student event attendance marked successfully');
  } catch (error) {
    logger.error(`❌ Mark student event attendance error: ${error.message}`);
    return sendError(res, error.message || 'Failed to mark student attendance', 400);
  }
};

/**
 * Mark staff attendance for an event
 * POST /api/v1/events/:id/attendance/staff
 */
export const markStaffEventAttendance = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { staff_id, status, remarks } = req.body;
    const markedBy = req.user.id;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    if (!staff_id || !status) {
      return sendError(res, 'staff_id and status are required', 400);
    }

    const attendance = await eventService.markStaffEventAttendance(
      eventId, staff_id, status, markedBy, remarks
    );

    return sendSuccess(res, attendance, 'Staff event attendance marked successfully');
  } catch (error) {
    logger.error(`❌ Mark staff event attendance error: ${error.message}`);
    return sendError(res, error.message || 'Failed to mark staff attendance', 400);
  }
};

/**
 * Bulk mark student attendance for an event
 * POST /api/v1/events/:id/attendance/students/bulk
 */
export const bulkMarkStudentEventAttendance = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { student_ids, status } = req.body;
    const markedBy = req.user.id;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    if (!Array.isArray(student_ids) || student_ids.length === 0 || !status) {
      return sendError(res, 'student_ids array and status are required', 400);
    }

    const results = await eventService.bulkMarkStudentEventAttendance(
      eventId, student_ids, status, markedBy
    );

    return sendSuccess(res, results, `Student attendance processed: ${results.success.length} success, ${results.failed.length} failed`);
  } catch (error) {
    logger.error(`❌ Bulk mark student attendance error: ${error.message}`);
    return sendError(res, error.message || 'Failed to bulk mark student attendance', 400);
  }
};

/**
 * Bulk mark staff attendance for an event
 * POST /api/v1/events/:id/attendance/staff/bulk
 */
export const bulkMarkStaffEventAttendance = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { staff_ids, status } = req.body;
    const markedBy = req.user.id;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    if (!Array.isArray(staff_ids) || staff_ids.length === 0 || !status) {
      return sendError(res, 'staff_ids array and status are required', 400);
    }

    const results = await eventService.bulkMarkStaffEventAttendance(
      eventId, staff_ids, status, markedBy
    );

    return sendSuccess(res, results, `Staff attendance processed: ${results.success.length} success, ${results.failed.length} failed`);
  } catch (error) {
    logger.error(`❌ Bulk mark staff attendance error: ${error.message}`);
    return sendError(res, error.message || 'Failed to bulk mark staff attendance', 400);
  }
};

/**
 * Get event attendance summary
 * GET /api/v1/events/:id/attendance
 */
export const getEventAttendanceSummary = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const summary = await eventService.getEventAttendanceSummary(eventId, instituteId);

    return sendSuccess(res, summary, 'Event attendance summary fetched successfully');
  } catch (error) {
    logger.error(`❌ Get event attendance summary error: ${error.message}`);

    if (error.message === 'Event not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to fetch attendance summary', 500);
  }
};

