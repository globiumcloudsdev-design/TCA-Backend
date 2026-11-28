// backend/src/services/portal/teacherSelfAttendance.service.js

/**
 * Teacher Self-Attendance Service (uses StaffAttendance model)
 *
 * Teachers, accountants, clerks — sab ke liye ek hi StaffAttendance table.
 * Teacher portal mein sirf apna (self) attendance manage hota hai.
 *
 * Rules:
 *  - Ek date = ek row per staff_id  (findOne by staff_id + date)
 *  - Check-out usi row mein update hota hai
 *  - check_in / check_out full DATE timestamps hain
 *  - Status uppercase: PRESENT | LATE | ABSENT | LEAVE | HOLIDAY | WEEKEND
 *  - marked_by = teacher khud (self check-in)
 */

import { Op } from "sequelize";
import {
  format,
  startOfMonth,
  endOfMonth,
  differenceInMinutes,
} from "date-fns";
import models from "../../models/postgres/index.js";
import { createNotification, broadcastNotification } from "../notification.service.js";
import logger from "../../config/logger.js";
import { todayPkt, toPktDateString, toPktTimeString, pktParts } from "../../utils/helpers/date.helper.js";
import { AppError } from "../../utils/lib/AppError.js";
import { evaluateGeofence, readCampusLocation } from "../../utils/helpers/geofence.js";

const { StaffAttendance, LeaveRequest, User, Branch, StaffAttendanceGeoLog } = models;

// ─────────────────────────────────────────────────────────────────────────────
// GEOFENCE (mobile only): check-in / check-out need the device location
// ─────────────────────────────────────────────────────────────────────────────

/** Teacher's campus = their branch (name + branch.location). null when they have no branch. */
export const getTeacherCampus = async (teacherId, instituteId) => {
  const teacher = await User.findOne({ where: { id: teacherId, school_id: instituteId }, attributes: ['id', 'branch_id'] });
  if (!teacher?.branch_id) return null;
  const branch = await Branch.findOne({ where: { id: teacher.branch_id, institute_id: instituteId }, attributes: ['id', 'name', 'location'] });
  if (!branch) return null;
  return { branch_id: branch.id, name: branch.name, location: branch.location };
};

/** Best-effort attempt log: DB row when the table exists, always the server log. Never throws. */
const logGeoAttempt = async ({ teacherId, instituteId, campus, action, decision, attendanceId = null, client = null }) => {
  const entry = {
    institute_id: instituteId,
    branch_id: campus?.branch_id || null,
    staff_id: teacherId,
    staff_attendance_id: attendanceId,
    action: action === 'check-out' ? 'check_out' : 'check_in',
    outcome: decision.ok ? 'accepted' : 'rejected',
    reason: decision.ok ? 'OK' : decision.code,
    latitude: decision.reading?.latitude ?? null,
    longitude: decision.reading?.longitude ?? null,
    accuracy_m: decision.reading?.accuracy_m ?? null,
    distance_m: decision.distance_m ?? null,
    radius_m: decision.radius_m ?? null,
    is_mocked: decision.reading?.is_mocked ?? null,
    message: decision.ok ? null : decision.message,
    client: client ? String(client).slice(0, 255) : null,
  };
  if (!decision.ok) logger.warn(`GEOFENCE rejected ${entry.action} staff=${teacherId} reason=${entry.reason} distance=${entry.distance_m} radius=${entry.radius_m} mocked=${entry.is_mocked}`);
  try {
    await StaffAttendanceGeoLog.create(entry);
  } catch (err) {
    logger.warn(`GEOFENCE log table unavailable (run the migration): ${err.message}`);
  }
};

/**
 * Enforce the geofence. Throws AppError(400|403|409) with a human message when rejected;
 * returns the accepted decision (distance, radius, reading) plus the campus.
 */
const enforceGeofence = async (teacherId, instituteId, data, action, client) => {
  const campus = await getTeacherCampus(teacherId, instituteId);
  const decision = evaluateGeofence({ body: data, campus, action });
  if (!decision.ok) {
    await logGeoAttempt({ teacherId, instituteId, campus, action, decision, client });
    throw new AppError(decision.message, decision.status);
  }
  return { campus, decision };
};

/** After the attendance row is saved: log the accepted attempt and attach the geo info to the response */
const withGeo = async (row, geo, teacherId, instituteId, action, client) => {
  await logGeoAttempt({ teacherId, instituteId, campus: geo.campus, action, decision: geo.decision, attendanceId: row.id, client });
  return {
    ...row,
    geo: {
      campus: geo.campus.name,
      distance_m: geo.decision.distance_m,
      radius_m: geo.decision.radius_m,
      accuracy_m: geo.decision.reading.accuracy_m,
    },
  };
};

/** GET /self-attendance/campus */
export const getCampusInfo = async (teacherId, instituteId) => {
  const campus = await getTeacherCampus(teacherId, instituteId);
  if (!campus) return { branch_name: null, latitude: null, longitude: null, radius_m: readCampusLocation(null).radius_m, has_location: false };
  const site = readCampusLocation(campus.location);
  return { branch_name: campus.name, latitude: site.latitude, longitude: site.longitude, radius_m: site.radius_m, has_location: site.has_location };
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default shift start: 08:30
 * Can be made per-school configurable later.
 */
const DEFAULT_SHIFT_START = { hour: 8, minute: 30 };

/**
 * Shift end is SERVER-controlled (B16): never trust client-sent shift_end_* values,
 * otherwise a teacher could claim arbitrary overtime.
 */
const DEFAULT_SHIFT_END = { hour: 17, minute: 0 };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' for today */
// All attendance dates/times are Pakistan time (server runs in UTC) — B32
const todayDateStr = () => todayPkt();

/** The instant of hh:mm Pakistan time on the same PKT calendar day as `ref` */
const pktClock = (ref, { hour, minute }) =>
  new Date(`${toPktDateString(ref)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:00`);

/**
 * How many minutes late is this timestamp vs shift start?
 * Returns 0 if on time or early.
 */
const calcLateMinutes = (checkInDate, shiftStart = DEFAULT_SHIFT_START) => {
  if (!checkInDate) return 0;
  const dt = new Date(checkInDate);
  const shiftDt = pktClock(dt, shiftStart);
  const diff = differenceInMinutes(dt, shiftDt);
  return diff > 0 ? diff : 0;
};

/**
 * Resolve status from check_in timestamp.
 * LATE if check_in is after shift start, else PRESENT.
 */
const resolveStatus = (
  checkInDate,
  isOnLeave = false,
  shiftStart = DEFAULT_SHIFT_START,
) => {
  if (isOnLeave) return "LEAVE";
  if (!checkInDate) return "ABSENT";
  return calcLateMinutes(checkInDate, shiftStart) > 0 ? "LATE" : "PRESENT";
};

/**
 * Format a StaffAttendance row for API response
 */
const formatRow = (record) => {
  const durationMinutes =
    record.check_in && record.check_out
      ? differenceInMinutes(
          new Date(record.check_out),
          new Date(record.check_in),
        )
      : null;

  return {
    id: record.id,
    date: record.date,
    status: record.status,
    check_in: record.check_in || null,
    check_out: record.check_out || null,
    duration_minutes:
      durationMinutes && durationMinutes > 0 ? durationMinutes : null,
    duration_display:
      durationMinutes && durationMinutes > 0
        ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
        : null,
    late_minutes: record.late_minutes || 0,
    early_exit_minutes: record.early_exit_minutes || 0,
    overtime_minutes: record.overtime_minutes || 0,
    leave_type_id: record.leave_type_id || null,
    leave_request_id: record.leave_request_id || null,
    remarks: record.remarks || null,
    marked_by: record.marked_by,
    marked_at: record.marked_at,
    updated_at: record.updated_at,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK IN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Teacher Check In
 *
 * - Agar aaj ka row exist karta hai aur check_in already hai → error
 * - Agar row exist hai par check_in null → update (admin ne absent pre-mark kiya tha)
 * - Agar row nahi hai → create
 */
export const teacherCheckIn = async (teacherId, instituteId, data = {}, client = null) => {
  const date = todayDateStr();
  const now = new Date();

  // Geofence first: location is REQUIRED (latitude, longitude, accuracy_m, is_mocked)
  const geo = await enforceGeofence(teacherId, instituteId, data, 'check-in', client);

  // Check approved leave for today
  const leaveToday = await getApprovedLeaveForDate(
    teacherId,
    instituteId,
    date,
  );
  if (leaveToday) {
    throw new Error("You have an approved leave for today. Cannot check in.");
  }

  // Find existing row for today
  const existing = await StaffAttendance.findOne({
    where: { staff_id: teacherId, institute_id: instituteId, date },
  });

  if (existing) {
    if (existing.check_in) {
      throw new Error("Already checked in for today");
    }

    // Row exists but no check_in — update it
    const lateMinutes = calcLateMinutes(now);
    existing.check_in = now;
    existing.status = resolveStatus(now);
    existing.late_minutes = lateMinutes;
    existing.marked_by = teacherId;
    existing.marked_at = now;
    existing.updated_by = teacherId;
    existing.updated_at = now;
    if (data.remarks) existing.remarks = data.remarks;
    await existing.save();

    return withGeo(formatRow(existing), geo, teacherId, instituteId, 'check-in', client);
  }

  // Create new row
  const lateMinutes = calcLateMinutes(now);
  const record = await StaffAttendance.create({
    institute_id: instituteId,
    branch_id: geo.campus.branch_id, // from the teacher's own campus; never from the client
    staff_id: teacherId,
    date,
    status: resolveStatus(now),
    check_in: now,
    check_out: null,
    late_minutes: lateMinutes,
    early_exit_minutes: 0,
    overtime_minutes: 0,
    leave_type_id: null,
    leave_request_id: null,
    remarks: data.remarks || null,
    marked_by: teacherId,
    marked_at: now,
    updated_by: null,
    updated_at: now,
  });

  // Send notification to admin
  try {
    const teacher = await User.findByPk(teacherId, {
      attributes: ['id', 'first_name', 'last_name']
    });
    if (teacher) {
      const teacherName = `${teacher.first_name} ${teacher.last_name}`;
      await broadcastNotification({
        institute_id: instituteId,
        branch_id: geo.campus.branch_id,
        recipient_type: 'ALL_ADMINS',
        title: `✅ Check-In: ${teacherName}`,
        body: `${teacherName} checked in at ${toPktTimeString(now)} - ${lateMinutes > 0 ? '⏰ Late' : '✓ On Time'}`,
        type: 'alert',
        channel: 'in_app',
        data: {
          teacherId,
          teacherName,
          checkIn: now,
          lateMinutes,
          date
        }
      }, true);
    }
  } catch (notifError) {
    logger.error(`Notification error in teacherCheckIn: ${notifError.message}`);
  }

  return withGeo(formatRow(record), geo, teacherId, instituteId, 'check-in', client);
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK OUT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Teacher Check Out
 *
 * Same row update — check_out + overtime/early_exit calculation.
 */
export const teacherCheckOut = async (teacherId, instituteId, data = {}, client = null) => {
  const date = todayDateStr();
  const now = new Date();

  // Geofence first: location is REQUIRED for check-out too
  const geo = await enforceGeofence(teacherId, instituteId, data, 'check-out', client);

  const existing = await StaffAttendance.findOne({
    where: { staff_id: teacherId, institute_id: instituteId, date },
  });

  if (!existing) {
    throw new Error("No check-in found for today. Please check in first.");
  }

  if (!existing.check_in) {
    throw new Error("No check-in time recorded. Please check in first.");
  }

  if (existing.check_out) {
    throw new Error("Already checked out for today");
  }

  // Calculate overtime / early exit vs default shift end (17:00)
  const shiftEndDt = pktClock(now, DEFAULT_SHIFT_END);

  const diffFromShiftEnd = differenceInMinutes(now, shiftEndDt);
  const overtimeMinutes = diffFromShiftEnd > 0 ? diffFromShiftEnd : 0;
  const earlyExitMinutes =
    diffFromShiftEnd < 0 ? Math.abs(diffFromShiftEnd) : 0;

  existing.check_out = now;
  existing.overtime_minutes = overtimeMinutes;
  existing.early_exit_minutes = earlyExitMinutes;
  existing.updated_by = teacherId;
  existing.updated_at = now;
  if (data.remarks) existing.remarks = data.remarks;

  await existing.save();

  // Send notification to admin
  try {
    const teacher = await User.findByPk(teacherId, {
      attributes: ['id', 'first_name', 'last_name']
    });
    if (teacher) {
      const teacherName = `${teacher.first_name} ${teacher.last_name}`;
      let statusEmoji = '✓';
      if (overtimeMinutes > 0) statusEmoji = '⏱️';
      else if (earlyExitMinutes > 0) statusEmoji = '⚠️';

      await broadcastNotification({
        institute_id: instituteId,
        recipient_type: 'ALL_ADMINS',
        title: `${statusEmoji} Check-Out: ${teacherName}`,
        body: `${teacherName} checked out at ${toPktTimeString(now)} - Overtime: ${overtimeMinutes}m, Early Exit: ${earlyExitMinutes}m`,
        type: 'alert',
        channel: 'in_app',
        data: {
          teacherId,
          teacherName,
          checkOut: now,
          overtimeMinutes,
          earlyExitMinutes,
          date
        }
      }, true);
    }
  } catch (notifError) {
    logger.error(`Notification error in teacherCheckOut: ${notifError.message}`);
  }

  return withGeo(formatRow(existing), geo, teacherId, instituteId, 'check-out', client);
};

// ─────────────────────────────────────────────────────────────────────────────
// TODAY STATUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get teacher's attendance status for today.
 * Frontend check-in/check-out buttons ka state yahan se decide hota hai.
 */
export const getTodayAttendanceStatus = async (teacherId, instituteId) => {
  const date = todayDateStr();

  const [record, leaveToday] = await Promise.all([
    StaffAttendance.findOne({
      where: { staff_id: teacherId, institute_id: instituteId, date },
    }),
    getApprovedLeaveForDate(teacherId, instituteId, date),
  ]);

  const isOnLeave = !!leaveToday;

  const leaveInfo = leaveToday
    ? {
        id: leaveToday.id,
        type:
          leaveToday.leave_type ??
          leaveToday.leaveType ??
          leaveToday.type ??
          null,
        reason: leaveToday.reason ?? leaveToday.description ?? null,
        status: leaveToday.status ?? null,
        start_date: leaveToday.start_date ?? leaveToday.from_date ?? null,
        end_date: leaveToday.end_date ?? leaveToday.to_date ?? null,
      }
    : null;

  // On approved leave, no attendance row
  if (isOnLeave && !record) {
    return {
      date,
      status: "LEAVE",
      check_in: null,
      check_out: null,
      duration_minutes: null,
      late_minutes: 0,
      is_checked_in: false,
      is_checked_out: false,
      can_check_in: false, // leave pe hai, check-in nahi
      can_check_out: false,
      leave: leaveInfo,
    };
  }

  // No record at all
  if (!record) {
    return {
      date,
      status: "NOT_MARKED",
      check_in: null,
      check_out: null,
      duration_minutes: null,
      late_minutes: 0,
      is_checked_in: false,
      is_checked_out: false,
      can_check_in: true,
      can_check_out: false,
      leave: leaveInfo,
    };
  }

  const durationMinutes =
    record.check_in && record.check_out
      ? differenceInMinutes(
          new Date(record.check_out),
          new Date(record.check_in),
        )
      : null;

  return {
    date,
    status: record.status,
    check_in: record.check_in || null,
    check_out: record.check_out || null,
    duration_minutes:
      durationMinutes && durationMinutes > 0 ? durationMinutes : null,
    duration_display:
      durationMinutes && durationMinutes > 0
        ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
        : null,
    late_minutes: record.late_minutes || 0,
    early_exit_minutes: record.early_exit_minutes || 0,
    overtime_minutes: record.overtime_minutes || 0,
    is_checked_in: !!record.check_in,
    is_checked_out: !!record.check_out,
    can_check_in: !record.check_in && !isOnLeave,
    can_check_out: !!record.check_in && !record.check_out,
    remarks: record.remarks || null,
    leave: leaveInfo,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attendance history with filters + pagination.
 *
 * Filters: from_date, to_date, month (YYYY-MM), status
 */
export const getAttendanceHistory = async (
  teacherId,
  instituteId,
  filters = {},
  pagination = {},
) => {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const where = buildDateWhere(
    { staff_id: teacherId, institute_id: instituteId },
    filters,
  );

  if (filters.status) {
    where.status = String(filters.status).toUpperCase();
  }

  const { count, rows } = await StaffAttendance.findAndCountAll({
    where,
    order: [["date", "DESC"]],
    limit,
    offset,
    include: buildIncludes(),
  });

  return {
    data: rows.map((row) => enrichWithLeave(formatRow(row), row)),
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORT / STATS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Monthly attendance summary report.
 *
 * Returns: stats + daily breakdown
 */
export const getAttendanceReport = async (
  teacherId,
  instituteId,
  filters = {},
) => {
  const { fromDate, toDate } = resolveDateRange(filters);

  const records = await StaffAttendance.findAll({
    where: {
      staff_id: teacherId,
      institute_id: instituteId,
      date: { [Op.between]: [fromDate, toDate] },
    },
    order: [["date", "ASC"]],
    include: buildIncludes(),
  });

  // Aggregate
  const stats = {
    total_days: records.length,
    present: 0,
    late: 0,
    absent: 0,
    on_leave: 0,
    holiday: 0,
    weekend: 0,
    total_working_minutes: 0,
    total_late_minutes: 0,
    total_overtime_minutes: 0,
    avg_check_in: null,
    avg_check_out: null,
    attendance_percentage: 0,
  };

  let totalCheckInMs = 0;
  let totalCheckOutMs = 0;
  let checkInCount = 0;
  let checkOutCount = 0;

  records.forEach((r) => {
    switch (r.status) {
      case "PRESENT":
        stats.present++;
        break;
      case "LATE":
        stats.late++;
        break;
      case "ABSENT":
        stats.absent++;
        break;
      case "LEAVE":
        stats.on_leave++;
        break;
      case "HOLIDAY":
        stats.holiday++;
        break;
      case "WEEKEND":
        stats.weekend++;
        break;
    }

    if (r.check_in && r.check_out) {
      const dur = differenceInMinutes(
        new Date(r.check_out),
        new Date(r.check_in),
      );
      if (dur > 0) stats.total_working_minutes += dur;
    }

    stats.total_late_minutes += r.late_minutes || 0;
    stats.total_overtime_minutes += r.overtime_minutes || 0;

    if (r.check_in) {
      totalCheckInMs += new Date(r.check_in).getTime();
      checkInCount++;
    }
    if (r.check_out) {
      totalCheckOutMs += new Date(r.check_out).getTime();
      checkOutCount++;
    }
  });

  // Average check-in / check-out times
  if (checkInCount > 0) {
    stats.avg_check_in = toPktTimeString(new Date(totalCheckInMs / checkInCount)).slice(0, 5);
  }
  if (checkOutCount > 0) {
    stats.avg_check_out = toPktTimeString(new Date(totalCheckOutMs / checkOutCount)).slice(0, 5);
  }

  // Attendance % = (present + late) / working days (excluding holiday + weekend)
  const scheduledDays = stats.total_days - stats.holiday - stats.weekend;
  const workedDays = stats.present + stats.late;
  stats.attendance_percentage =
    scheduledDays > 0 ? Math.round((workedDays / scheduledDays) * 100) : 0;

  stats.avg_working_hours =
    checkInCount > 0
      ? `${Math.floor(stats.total_working_minutes / checkInCount / 60)}h ${Math.round((stats.total_working_minutes / checkInCount) % 60)}m`
      : "0h 0m";

  return {
    from_date: fromDate,
    to_date: toDate,
    stats,
    daily: records.map((row) => enrichWithLeave(formatRow(row), row)),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get approved LeaveRequest for a specific date
 */
const getApprovedLeaveForDate = async (teacherId, instituteId, date) => {
  if (!LeaveRequest) return null;
  try {
    return await LeaveRequest.findOne({
      where: {
        user_id: teacherId,
        school_id: instituteId, // LeaveRequest uses school_id per existing code
        status: "approved",
        start_date: { [Op.lte]: date },
        end_date: { [Op.gte]: date },
      },
    });
  } catch {
    return null; // table not ready yet
  }
};

/**
 * Build date range WHERE clause
 */
const buildDateWhere = (base, filters) => {
  const where = { ...base };
  const { fromDate, toDate } = resolveDateRange(filters);
  where.date = { [Op.between]: [fromDate, toDate] };
  return where;
};

/**
 * Resolve from/to date from filters.
 * Priority: from_date+to_date > month > current month
 */
const resolveDateRange = (filters = {}) => {
  if (filters.from_date && filters.to_date) {
    return { fromDate: filters.from_date, toDate: filters.to_date };
  }
  if (filters.month) {
    const base = new Date(`${filters.month}-01`);
    return {
      fromDate: format(startOfMonth(base), "yyyy-MM-dd"),
      toDate: format(endOfMonth(base), "yyyy-MM-dd"),
    };
  }
  const { year: py, month: pm } = pktParts();
  const base = new Date(py, pm - 1, 1);
  return {
    fromDate: format(startOfMonth(base), "yyyy-MM-dd"),
    toDate: format(endOfMonth(base), "yyyy-MM-dd"),
  };
};

/**
 * Sequelize includes for leave associations.
 * NOTE: No attributes filter — column names differ per project schema.
 *       enrichWithLeave picks safely from whatever comes back.
 */
const buildIncludes = () => {
  const includes = [];
  if (models.LeaveRequest) {
    includes.push({
      model: models.LeaveRequest,
      as: "leaveRequest",
      required: false,
      // No attributes array — avoids "column does not exist" errors
    });
  }
  return includes;
};

/**
 * Attach leaveRequest info to formatted row.
 * Handles different possible column names (leave_type / type / leaveType).
 */
const enrichWithLeave = (formatted, record) => {
  if (!record.leaveRequest) return formatted;

  const lr = record.leaveRequest;

  // Safely resolve leave type — pick whichever column exists
  const leaveType =
    lr.leave_type ?? // snake_case
    lr.leaveType ?? // camelCase
    lr.type ?? // short form
    lr.leave_type_id ?? // FK id fallback
    null;

  formatted.leave = {
    id: lr.id || null,
    type: leaveType,
    reason: lr.reason || lr.description || null,
    status: lr.status || null,
    start_date: lr.start_date || lr.from_date || null,
    end_date: lr.end_date || lr.to_date || null,
  };

  return formatted;
};

export default {
  teacherCheckIn,
  teacherCheckOut,
  getTodayAttendanceStatus,
  getAttendanceHistory,
  getAttendanceReport,
};
