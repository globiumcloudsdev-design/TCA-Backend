// backend/src/services/staffAttendance.service.js
import { Op } from 'sequelize';
import models from '../models/postgres/index.js';
import { parseCSVBuffer } from '../utils/csvParser.js';
import { createNotification, broadcastNotification } from './notification.service.js';
import logger from '../config/logger.js';

const { StaffAttendance, User, Branch, LeaveType, sequelize } = models;

/**
 * Helper: Send staff attendance notification to admin
 */
const sendStaffAttendanceNotification = async (staffId, attendanceData, instituteId, staffName, status) => {
  try {
    // Notify institute admin
    await broadcastNotification({
      institute_id: instituteId,
      recipient_type: 'ALL_ADMINS',
      title: `Staff Attendance: ${staffName}`,
      body: `${staffName} marked ${status} on ${attendanceData.date}`,
      type: 'attendance',
      channel: 'in_app',
      data: {
        staffId,
        staffName,
        status,
        date: attendanceData.date,
        checkIn: attendanceData.check_in || null,
        checkOut: attendanceData.check_out || null
      }
    }, true);
  } catch (error) {
    logger.error(`Failed to send staff attendance notification: ${error.message}`);
  }
};

/**
 * Mark single attendance
 */
export const markAttendance = async (data, options = {}) => {
  const { transaction } = options;
  const attendance = await StaffAttendance.create(data, { transaction });
  
  // Send notification
  try {
    const staff = await User.findByPk(data.staff_id, {
      attributes: ['id', 'first_name', 'last_name']
    });
    if (staff) {
      const staffName = `${staff.first_name} ${staff.last_name}`;
      await sendStaffAttendanceNotification(
        data.staff_id,
        attendance,
        data.institute_id,
        staffName,
        data.status
      );
    }
  } catch (notifError) {
    logger.error(`Notification error in markAttendance: ${notifError.message}`);
  }

  return await StaffAttendance.findByPk(attendance.id, {
    include: [{ model: User, as: 'staff', attributes: ['id', 'first_name', 'last_name', 'staff_type', 'user_type'] }],
    transaction,
  });
};

/**
 * Bulk mark attendance from CSV buffer
 * Expected CSV columns: staff_id, date, status, check_in, check_out, remarks
 */
export const bulkMarkAttendance = async (instituteId, userId, buffer, options = {}) => {
  const { transaction } = options;
  const records = await parseCSVBuffer(buffer); // returns array of objects

  const results = { success: [], errors: [] };
  for (const record of records) {
    try {
      // Validate staff exists and belongs to institute
      const staff = await User.findOne({
        where: {
          id: record.staff_id,
          school_id: instituteId,
          user_type: ['STAFF', 'TEACHER'],
        },
      });
      if (!staff) {
        results.errors.push({ staff_id: record.staff_id, error: 'Staff not found' });
        continue;
      }

      const attendanceData = {
        institute_id: instituteId,
        branch_id: staff.branch_id,
        staff_id: record.staff_id,
        date: record.date,
        status: record.status || 'PRESENT',
        check_in: record.check_in ? new Date(record.check_in) : null,
        check_out: record.check_out ? new Date(record.check_out) : null,
        remarks: record.remarks || null,
        marked_by: userId,
      };
      const att = await StaffAttendance.create(attendanceData, { transaction });
      results.success.push({ staff_id: record.staff_id, date: record.date });

      // Send individual notification
      try {
        const staffName = `${staff.first_name} ${staff.last_name}`;
        await sendStaffAttendanceNotification(
          record.staff_id,
          att,
          instituteId,
          staffName,
          attendanceData.status
        );
      } catch (notifErr) {
        logger.error(`Notification error for staff ${record.staff_id}: ${notifErr.message}`);
      }
    } catch (err) {
      results.errors.push({ staff_id: record.staff_id, error: err.message });
    }
  }
  return results;
};

/**
 * Get all attendances with filters
 */
export const getAllAttendances = async (filters, pagination) => {
  const { page = 1, limit = 10, sortBy = 'date', sortOrder = 'DESC' } = pagination;
  const offset = (page - 1) * limit;

  const where = { institute_id: filters.institute_id };
  if (filters.branch_id) where.branch_id = filters.branch_id;
  if (filters.staff_id) where.staff_id = filters.staff_id;
  if (filters.status) where.status = filters.status;
  if (filters.date_from || filters.date_to) {
    where.date = {};
    if (filters.date_from) where.date[Op.gte] = filters.date_from;
    if (filters.date_to) where.date[Op.lte] = filters.date_to;
  }
  if (filters.staff_type) {
    // Need to join User model to filter by staff_type
    where['$staff.staff_type$'] = filters.staff_type;
  }

  const { count, rows } = await StaffAttendance.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'staff',
        attributes: ['id', 'first_name', 'last_name', 'staff_type', 'user_type', 'email', 'phone'],
        where: filters.staff_type ? { staff_type: filters.staff_type } : undefined,
      },
      { model: Branch, as: 'branch', attributes: ['id', 'name'] },
    ],
    order: [[sortBy, sortOrder]],
    limit,
    offset,
  });

  const normalizedRows = rows.map((row) => {
    const record = row.toJSON();
    record.role = record?.staff?.user_type || record?.staff?.staff_type || null;
    return record;
  });

  return {
    data: normalizedRows,
    pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / limit) },
  };
};

/**
 * Get attendance by ID
 */
export const getAttendanceById = async (id, instituteId) => {
  const attendance = await StaffAttendance.findOne({
    where: { id, institute_id: instituteId },
    include: [
      { model: User, as: 'staff', attributes: ['id', 'first_name', 'last_name', 'staff_type', 'user_type'] },
      { model: Branch, as: 'branch' },
    ],
  });
  if (!attendance) throw new Error('Attendance record not found');
  return attendance;
};

/**
 * Update attendance
 */
export const updateAttendance = async (id, instituteId, updateData, userId) => {
  const attendance = await StaffAttendance.findOne({ where: { id, institute_id: instituteId } });
  if (!attendance) throw new Error('Attendance record not found');

  await attendance.update({
    ...updateData,
    updated_by: userId,
    updated_at: new Date(),
  });

  // Send update notification
  try {
    const staff = await User.findByPk(attendance.staff_id, {
      attributes: ['id', 'first_name', 'last_name']
    });
    if (staff) {
      const staffName = `${staff.first_name} ${staff.last_name}`;
      const newStatus = updateData.status || attendance.status;
      await sendStaffAttendanceNotification(
        attendance.staff_id,
        attendance,
        instituteId,
        staffName,
        newStatus
      );
    }
  } catch (notifError) {
    logger.error(`Notification error in updateAttendance: ${notifError.message}`);
  }

  return getAttendanceById(id, instituteId);
};

/**
 * Delete attendance
 */
export const deleteAttendance = async (id, instituteId) => {
  const attendance = await StaffAttendance.findOne({ where: { id, institute_id: instituteId } });
  if (!attendance) throw new Error('Attendance record not found');
  await attendance.destroy();
  return { message: 'Attendance record deleted' };
};

/**
 * Get attendance report (summary)
 */
export const getAttendanceReport = async (filters) => {
  const { institute_id, branch_id, staff_type, date_from, date_to } = filters;

  const staffWhere = { school_id: institute_id, user_type: ['STAFF', 'TEACHER'] };
  if (staff_type) staffWhere.staff_type = staff_type;
  if (branch_id) staffWhere.branch_id = branch_id;

  const staffList = await User.findAll({
    where: staffWhere,
    attributes: ['id', 'first_name', 'last_name', 'staff_type', 'branch_id'],
  });

  const attendanceWhere = { institute_id };
  if (branch_id) attendanceWhere.branch_id = branch_id;
  if (date_from || date_to) {
    attendanceWhere.date = {};
    if (date_from) attendanceWhere.date[Op.gte] = date_from;
    if (date_to) attendanceWhere.date[Op.lte] = date_to;
  }

  const attendances = await StaffAttendance.findAll({
    where: attendanceWhere,
    attributes: ['staff_id', 'status'],
  });

  // Build summary per staff
  const report = staffList.map(staff => {
    const staffAttendances = attendances.filter(a => a.staff_id === staff.id);
    const present = staffAttendances.filter(a => a.status === 'PRESENT').length;
    const absent = staffAttendances.filter(a => a.status === 'ABSENT').length;
    const late = staffAttendances.filter(a => a.status === 'LATE').length;
    const leave = staffAttendances.filter(a => a.status === 'LEAVE').length;
    const total = staffAttendances.length;
    const percentage = total === 0 ? 0 : ((present + late) / total) * 100;

    return {
      staff_id: staff.id,
      name: `${staff.first_name} ${staff.last_name}`,
      staff_type: staff.staff_type,
      present,
      absent,
      late,
      leave,
      total_days: total,
      attendance_percentage: percentage.toFixed(2),
    };
  });

  // Summary totals
  const totalStaff = staffList.length;
  const totalPresent = report.reduce((sum, s) => sum + s.present, 0);
  const totalAbsent = report.reduce((sum, s) => sum + s.absent, 0);
  const totalLate = report.reduce((sum, s) => sum + s.late, 0);
  const totalLeave = report.reduce((sum, s) => sum + s.leave, 0);
  const overallPercentage = totalStaff === 0 ? 0 : (totalPresent + totalLate) / (totalPresent + totalAbsent + totalLate + totalLeave) * 100;

  return {
    summary: {
      total_staff: totalStaff,
      total_present: totalPresent,
      total_absent: totalAbsent,
      total_late: totalLate,
      total_leave: totalLeave,
      overall_percentage: overallPercentage.toFixed(2),
    },
    staff_wise: report,
  };
};

/**
 * Mark a specific date as a holiday for all staff members in the institute
 */
export const markHoliday = async (data) => {
  const { date, institute_id, branch_id, marked_by, remarks } = data;

  const transaction = await sequelize.transaction();
  try {
    // 1. Find all active staff members in the institute/branch
    const staffFilters = {
      school_id: institute_id,
      user_type: ["STAFF", "TEACHER"],
      is_active: true,
    };
    if (branch_id) staffFilters.branch_id = branch_id;

    const staffList = await User.findAll({
      where: staffFilters,
      attributes: ["id", "branch_id"],
      transaction,
    });

    const results = [];

    // 2. Prepare and upsert holiday records for all staff
    for (const staff of staffList) {
      const attendanceData = {
        institute_id,
        branch_id: staff.branch_id || branch_id || null,
        date,
        staff_id: staff.id,
        status: "HOLIDAY",
        remarks: remarks || "Public Holiday",
        marked_by,
        marked_at: new Date()
      };

      // 3. Upsert holiday record
      const existing = await StaffAttendance.findOne({
        where: { staff_id: staff.id, date },
        transaction,
      });

      if (existing) {
        await existing.update(attendanceData, { transaction });
        results.push(existing);
      } else {
        const created = await StaffAttendance.create(attendanceData, { transaction });
        results.push(created);
      }
    }

    await transaction.commit();

    // 4. Send bulk notification to admins
    try {
      await broadcastNotification({
        institute_id: institute_id,
        recipient_type: 'ALL_ADMINS',
        title: `📅 Staff Holiday Marked - ${date}`,
        body: `${date} has been marked as a holiday for ${results.length} staff members.`,
        type: 'attendance',
        channel: 'in_app',
        data: { date, count: results.length }
      }, true);
    } catch (notifError) {
      logger.error(`Notification error in staff markHoliday: ${notifError.message}`);
    }

    return { success: true, count: results.length, date };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export default {
  markAttendance,
  bulkMarkAttendance,
  getAllAttendances,
  getAttendanceById,
  updateAttendance,
  deleteAttendance,
  getAttendanceReport,
  markHoliday,
};