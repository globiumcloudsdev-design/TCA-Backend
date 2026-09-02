import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess } from '../../utils/helpers/response.helper.js';
import {
  markAttendance,
  getAttendanceByClassDate,
  getStudentAttendanceSummary,
} from '../../services/attendance.service.js';
import { getInstituteId, getBranchId } from '../../utils/helpers/request.helper.js';

export const markAttendanceController = catchAsync(async (req, res) => {
  const { classId, date, records } = req.body;
  const instituteId = getInstituteId(req);
  const branchId = getBranchId(req);
  const result = await markAttendance(instituteId, classId, date, records, req.user.id, branchId);
  sendSuccess(res, result, 'Attendance marked successfully');
});

export const getClassAttendanceController = catchAsync(async (req, res) => {
  const { classId, date } = req.query;
  const instituteId = getInstituteId(req);
  const branchId = getBranchId(req);
  const attendance = await getAttendanceByClassDate(instituteId, classId, date, branchId);
  sendSuccess(res, attendance, 'Attendance fetched');
});

export const getStudentSummaryController = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const instituteId = getInstituteId(req);
  const branchId = getBranchId(req);
  const summary = await getStudentAttendanceSummary(
    instituteId,
    req.params.studentId,
    startDate,
    endDate,
    branchId
  );
  sendSuccess(res, summary, 'Attendance summary');
});

export default { markAttendanceController, getClassAttendanceController, getStudentSummaryController };
