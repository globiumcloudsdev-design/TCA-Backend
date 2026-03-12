/**
 * The Clouds Academy - Dashboard Controller
 */

import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess } from '../../utils/helpers/response.helper.js';
import User from '../../models/postgres/User.model.js';
import FeeVoucher from '../../models/postgres/FeeVoucher.model.js';
import Attendance from '../../models/postgres/Attendance.model.js';
import { Op } from 'sequelize';

export const getDashboardStats = catchAsync(async (req, res) => {
  const schoolId = req.school.id;
  const today = new Date().toISOString().split('T')[0];

  const [totalStudents, totalTeachers, pendingFees, todayAttendance] = await Promise.all([
    User.count({ where: { school_id: schoolId, user_type: 'STUDENT', is_active: true } }),
    User.count({ where: { school_id: schoolId, user_type: 'TEACHER', is_active: true } }),
    FeeVoucher.sum('net_amount', {
      where: { school_id: schoolId, status: { [Op.in]: ['pending', 'overdue'] } },
    }),
    Attendance.count({
      where: { school_id: schoolId, date: today, status: 'present' },
    }),
  ]);

  sendSuccess(
    res,
    { totalStudents, totalTeachers, pendingFees: pendingFees || 0, todayAttendance },
    'Dashboard stats'
  );
});

export default { getDashboardStats };


// export const getDashboardStats = catchAsync(async (req, res) => {
//   const schoolId = req.school.id;
//   const today = new Date().toISOString().split('T')[0];

//   const [totalStudents, totalTeachers, pendingFees, todayAttendance] = await Promise.all([
//     Student.count({ where: { school_id: schoolId, is_active: true } }),
//     Teacher.count({ where: { school_id: schoolId, is_active: true } }),
//     FeeVoucher.sum('net_amount', {
//       where: { school_id: schoolId, status: { [Op.in]: ['pending', 'overdue'] } },
//     }),
//     Attendance.count({
//       where: { school_id: schoolId, date: today, status: 'present' },
//     }),
//   ]);

//   sendSuccess(
//     res,
//     { totalStudents, totalTeachers, pendingFees: pendingFees || 0, todayAttendance },
//     'Dashboard stats'
//   );
// });

// export default { getDashboardStats };
