/**
 * The Clouds Academy - Attendance Controller
 */

import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess } from '../../utils/helpers/response.helper.js';
import {
  markAttendance,
  getAttendanceByClassDate,
  getStudentAttendanceSummary,
} from '../../services/attendance.service.js';

export const markAttendanceController = catchAsync(async (req, res) => {
  const { classId, date, records } = req.body;
  const result = await markAttendance(req.school.id, classId, date, records, req.user.id);
  sendSuccess(res, result, 'Attendance marked successfully');
});

export const getClassAttendanceController = catchAsync(async (req, res) => {
  const { classId, date } = req.query;
  const attendance = await getAttendanceByClassDate(req.school.id, classId, date);
  sendSuccess(res, attendance, 'Attendance fetched');
});

export const getStudentSummaryController = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const summary = await getStudentAttendanceSummary(
    req.school.id,
    req.params.studentId,
    startDate,
    endDate
  );
  sendSuccess(res, summary, 'Attendance summary');
});

export default { markAttendanceController, getClassAttendanceController, getStudentSummaryController };
