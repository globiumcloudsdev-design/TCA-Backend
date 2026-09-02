/**
 * The Clouds Academy - Attendance Service
 */

import Attendance from '../models/postgres/Attendance.model.js';
import User from '../models/postgres/User.model.js';
import { AppError } from '../utils/lib/AppError.js';
import { Op } from 'sequelize';

/**
 * Mark attendance for a class (bulk)
 */
export const markAttendance = async (schoolId, classId, date, records, markedBy, branchId = null) => {
  const attendanceData = records.map((r) => ({
    school_id: schoolId,
    branch_id: branchId || null,
    class_id: classId,
    student_id: r.studentId,
    date,
    status: r.status,
    remarks: r.remarks,
    marked_by: markedBy,
  }));

  await Attendance.bulkCreate(attendanceData, {
    updateOnDuplicate: ['status', 'remarks', 'marked_by'],
  });

  return { message: `Attendance marked for ${attendanceData.length} students.` };
};

/**
 * Get attendance by class and date
 */
export const getAttendanceByClassDate = async (schoolId, classId, date, branchId = null) => {
  const where = { school_id: schoolId, class_id: classId, date };
  if (branchId) where.branch_id = branchId;

  const attendance = await Attendance.findAll({
    where,
    include: [{ model: User, attributes: ['id', 'first_name', 'last_name', 'registration_no', 'details'] }],
  });
  return attendance;
};

/**
 * Get student attendance summary
 */
export const getStudentAttendanceSummary = async (schoolId, studentId, startDate, endDate, branchId = null) => {
  const where = {
    school_id: schoolId,
    student_id: studentId,
    date: { [Op.between]: [startDate, endDate] },
  };
  if (branchId) where.branch_id = branchId;

  const records = await Attendance.findAll({
    where,
  });

  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const late = records.filter((r) => r.status === 'late').length;

  return {
    total,
    present,
    absent,
    late,
    percentage: total > 0 ? ((present / total) * 100).toFixed(2) : '0.00',
    records,
  };
};

export default { markAttendance, getAttendanceByClassDate, getStudentAttendanceSummary };
