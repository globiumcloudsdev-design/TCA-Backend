// backend/src/controllers/portal/teacherSelfAttendance.controller.js

/**
 * Teacher Self-Attendance Controller
 *
 * POST /self-attendance/check-in   → checkIn
 * POST /self-attendance/check-out  → checkOut
 * GET  /self-attendance/today      → getTodayStatus
 * GET  /self-attendance/history    → getHistory
 * GET  /self-attendance/report     → getReport
 */

import * as attendanceService from '../../../services/portal/teacherSelfAttendance.service.js';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError
} from '../../../utils/helpers/response.helper.js';

const getInstituteId = (req) => req.user?.school_id || req.user?.institute_id;

// ─────────────────────────────────────────────────────────────────────────────
// CHECK IN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/teacher/self-attendance/check-in
 *
 * Body (all optional):
 * {
 *   remarks: "string",
 *   branch_id: "uuid"   // agar multi-branch school ho
 * }
 */
export const checkIn = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const record = await attendanceService.teacherCheckIn(
      req.user.id,
      instituteId,
      req.body
    );
    return sendCreated(res, record, 'Checked in successfully');
  } catch (error) {
    const status =
      error.message.toLowerCase().includes('already checked in') ? 409
      : error.message.toLowerCase().includes('approved leave') ? 403
      : 400;
    return sendError(res, error.message, status);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK OUT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/teacher/self-attendance/check-out
 *
 * Body (all optional):
 * {
 *   remarks: "string"
 * }
 */
export const checkOut = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const record = await attendanceService.teacherCheckOut(
      req.user.id,
      instituteId,
      req.body
    );
    return sendSuccess(res, record, 'Checked out successfully');
  } catch (error) {
    const status =
      error.message.toLowerCase().includes('already checked out') ? 409
      : 400;
    return sendError(res, error.message, status);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TODAY STATUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/teacher/self-attendance/today
 *
 * Response includes:
 *  - status (PRESENT | LATE | ABSENT | LEAVE | NOT_MARKED)
 *  - check_in, check_out timestamps
 *  - can_check_in, can_check_out (frontend buttons ka state)
 *  - leave info if any approved leave today
 */
export const getTodayStatus = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    const status = await attendanceService.getTodayAttendanceStatus(
      req.user.id,
      instituteId
    );
    return sendSuccess(res, status, 'Today attendance status fetched');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/teacher/self-attendance/history
 *
 * Query params:
 *  - page         (default: 1)
 *  - limit        (default: 20)
 *  - month        YYYY-MM  e.g. 2025-04
 *  - from_date    YYYY-MM-DD
 *  - to_date      YYYY-MM-DD
 *  - status       PRESENT | LATE | ABSENT | LEAVE | HOLIDAY | WEEKEND
 */
export const getHistory = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);

    const filters = {
      from_date: req.query.from_date,
      to_date:   req.query.to_date,
      month:     req.query.month,
      status:    req.query.status
    };

    const pagination = {
      page:  parseInt(req.query.page)  || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await attendanceService.getAttendanceHistory(
      req.user.id,
      instituteId,
      filters,
      pagination
    );

    return sendPaginated(res, result.data, result.pagination, 'Attendance history fetched');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/teacher/self-attendance/report
 *
 * Query params:
 *  - month        YYYY-MM  (default: current month)
 *  - from_date    YYYY-MM-DD
 *  - to_date      YYYY-MM-DD
 *
 * Response:
 *  - stats: { present, late, absent, on_leave, attendance_percentage, avg_check_in, ... }
 *  - daily: [ ...formatted rows ]
 */
export const getReport = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);

    const filters = {
      from_date: req.query.from_date,
      to_date:   req.query.to_date,
      month:     req.query.month
    };

    const report = await attendanceService.getAttendanceReport(
      req.user.id,
      instituteId,
      filters
    );

    return sendSuccess(res, report, 'Attendance report fetched');
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};