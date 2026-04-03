// backend/src/services/dashboard/instituteDashboard.service.js

/**
 * Institute Dashboard Service
 *
 * Unified realtime dashboard payload for institute-facing web app.
 * Returns card stats, charts and activity in frontend-ready shape.
 */

import { Op } from 'sequelize';
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  addDays,
} from 'date-fns';
import models from '../../models/postgres/index.js';

const {
  Institute,
  InstituteType,
  User,
  Class,
  Section,
  StudentAttendance: Attendance,
  FeeVoucher,
  Exam,
  Branch,
} = models;

const STUDENT_PATHS = [
  'studentDetails',
  'student_details',
  null,
];

const pickStudentDetails = (details = {}) => {
  for (const path of STUDENT_PATHS) {
    if (path && details[path] && typeof details[path] === 'object') {
      return details[path];
    }
  }
  return details && typeof details === 'object' ? details : {};
};

const parseAmount = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

const formatMoney = (value) => {
  const num = Math.round(parseAmount(value));
  return `PKR ${num.toLocaleString('en-PK')}`;
};

const resolveTypeSlug = (instituteType = null, fallback = 'school') => {
  const slug = String(instituteType?.slug || '').trim().toLowerCase();
  if (slug) return slug;

  const name = String(instituteType?.name || '').trim().toLowerCase();
  if (name.includes('coaching')) return 'coaching';
  if (name.includes('academy')) return 'academy';
  if (name.includes('college')) return 'college';
  if (name.includes('university')) return 'university';
  if (name.includes('tuition')) return 'tuition_center';
  return fallback;
};

const buildWhere = (instituteId, branchId = null) => {
  const where = { school_id: instituteId };
  if (branchId) where.branch_id = branchId;
  return where;
};

const getOverviewStats = async ({ instituteId, branchId }) => {
  const userWhere = buildWhere(instituteId, branchId);

  const [
    totalStudents,
    totalTeachers,
    totalClasses,
    totalSections,
    todayAttendance,
    monthlyAttendance,
    monthlyCollected,
    monthlyPending,
    upcomingExams,
  ] = await Promise.all([
    User.count({ where: { ...userWhere, user_type: 'STUDENT' } }),
    User.count({ where: { ...userWhere, user_type: 'TEACHER' } }),
    Class.count({ where: buildWhere(instituteId, branchId) }),
    Section.count({ where: buildWhere(instituteId, branchId) }),
    Attendance.findAll({
      where: {
        ...buildWhere(instituteId, branchId),
        date: new Date().toISOString().slice(0, 10),
      },
      attributes: ['status'],
      raw: true,
    }),
    Attendance.findAll({
      where: {
        ...buildWhere(instituteId, branchId),
        date: {
          [Op.between]: [
            startOfMonth(new Date()),
            endOfMonth(new Date()),
          ],
        },
      },
      attributes: ['status'],
      raw: true,
    }),
    FeeVoucher.sum('net_amount', {
      where: {
        ...buildWhere(instituteId, branchId),
        status: 'paid',
        due_date: {
          [Op.between]: [
            startOfMonth(new Date()),
            endOfMonth(new Date()),
          ],
        },
      },
    }),
    FeeVoucher.sum('net_amount', {
      where: {
        ...buildWhere(instituteId, branchId),
        status: { [Op.in]: ['pending', 'overdue', 'partial'] },
        due_date: {
          [Op.between]: [
            startOfMonth(new Date()),
            endOfMonth(new Date()),
          ],
        },
      },
    }),
    Exam.count({
      where: {
        ...buildWhere(instituteId, branchId),
        start_date: {
          [Op.between]: [new Date(), addDays(new Date(), 30)],
        },
      },
    }),
  ]);

  const attendanceTotal = monthlyAttendance.filter((row) => row.status !== 'holiday').length;
  const attendancePresent = monthlyAttendance.filter((row) => row.status === 'present').length;
  const attendancePct = attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : 0;

  const todayTotal = todayAttendance.filter((row) => row.status !== 'holiday').length;
  const todayPresent = todayAttendance.filter((row) => row.status === 'present').length;
  const todayPct = todayTotal ? Math.round((todayPresent / todayTotal) * 100) : 0;

  return {
    total_students: totalStudents,
    total_teachers: totalTeachers,
    total_classes: totalClasses,
    total_sections: totalSections,
    fees_collected: parseAmount(monthlyCollected),
    fees_pending: parseAmount(monthlyPending),
    avg_attendance_pct: attendancePct,
    today_attendance_pct: todayPct,
    upcoming_exams: upcomingExams,
  };
};

const getAttendanceChart = async ({ instituteId, branchId }) => {
  const months = Array.from({ length: 6 }).map((_, i) => subMonths(new Date(), 5 - i));

  const chart = await Promise.all(
    months.map(async (monthDate) => {
      const records = await Attendance.findAll({
        where: {
          ...buildWhere(instituteId, branchId),
          date: {
            [Op.between]: [startOfMonth(monthDate), endOfMonth(monthDate)],
          },
        },
        attributes: ['status'],
        raw: true,
      });

      const total = records.filter((r) => r.status !== 'holiday').length;
      const present = records.filter((r) => r.status === 'present').length;
      const absent = records.filter((r) => r.status === 'absent').length;
      const late = records.filter((r) => r.status === 'late').length;

      return {
        month: format(monthDate, 'MMM'),
        present: total ? Math.round((present / total) * 100) : 0,
        absent: total ? Math.round((absent / total) * 100) : 0,
        late: total ? Math.round((late / total) * 100) : 0,
      };
    }),
  );

  return chart;
};

const getFeesChart = async ({ instituteId, branchId }) => {
  const months = Array.from({ length: 6 }).map((_, i) => subMonths(new Date(), 5 - i));

  const chart = await Promise.all(
    months.map(async (monthDate) => {
      const whereBase = {
        ...buildWhere(instituteId, branchId),
        due_date: {
          [Op.between]: [startOfMonth(monthDate), endOfMonth(monthDate)],
        },
      };

      const [collected, pending] = await Promise.all([
        FeeVoucher.sum('net_amount', {
          where: {
            ...whereBase,
            status: 'paid',
          },
        }),
        FeeVoucher.sum('net_amount', {
          where: {
            ...whereBase,
            status: { [Op.in]: ['pending', 'overdue', 'partial'] },
          },
        }),
      ]);

      return {
        month: format(monthDate, 'MMM'),
        collected: Math.round(parseAmount(collected)),
        pending: Math.round(parseAmount(pending)),
      };
    }),
  );

  return chart;
};

const getEnrollmentCharts = async ({ instituteId, branchId }) => {
  const students = await User.findAll({
    where: {
      ...buildWhere(instituteId, branchId),
      user_type: 'STUDENT',
      is_active: true,
    },
    attributes: ['details'],
    raw: true,
  });

  const classMap = new Map();
  let boys = 0;
  let girls = 0;
  let others = 0;

  students.forEach((row) => {
    const details = pickStudentDetails(row.details || {});
    const className =
      details.class_name ||
      details.className ||
      details.class ||
      'Unassigned';

    const genderRaw = String(details.gender || '').toLowerCase();
    const gender = genderRaw === 'male' ? 'male' : genderRaw === 'female' ? 'female' : 'other';

    if (!classMap.has(className)) {
      classMap.set(className, { class: className, boys: 0, girls: 0 });
    }

    const item = classMap.get(className);
    if (gender === 'male') {
      item.boys += 1;
      boys += 1;
    } else if (gender === 'female') {
      item.girls += 1;
      girls += 1;
    } else {
      others += 1;
    }
  });

  const enrollment = Array.from(classMap.values())
    .sort((a, b) => (b.boys + b.girls) - (a.boys + a.girls))
    .slice(0, 8);

  const gender = [
    { name: 'Boys', value: boys, fill: 'hsl(var(--chart-1))' },
    { name: 'Girls', value: girls, fill: 'hsl(var(--chart-2))' },
  ];

  if (others > 0) {
    gender.push({ name: 'Others', value: others, fill: 'hsl(var(--chart-3))' });
  }

  return { enrollment, gender };
};

const getFeeStatusChart = async ({ instituteId, branchId }) => {
  const [paid, pending, overdue] = await Promise.all([
    FeeVoucher.sum('net_amount', {
      where: { ...buildWhere(instituteId, branchId), status: 'paid' },
    }),
    FeeVoucher.sum('net_amount', {
      where: { ...buildWhere(instituteId, branchId), status: { [Op.in]: ['pending', 'partial'] } },
    }),
    FeeVoucher.sum('net_amount', {
      where: { ...buildWhere(instituteId, branchId), status: 'overdue' },
    }),
  ]);

  return [
    { name: 'Paid', value: Math.round(parseAmount(paid)), fill: 'hsl(var(--chart-1))' },
    { name: 'Pending', value: Math.round(parseAmount(pending)), fill: 'hsl(var(--chart-3))' },
    { name: 'Overdue', value: Math.round(parseAmount(overdue)), fill: 'hsl(var(--chart-4))' },
  ];
};

const getRecentActivity = async ({ instituteId, branchId }) => {
  const [recentStudents, recentVouchers, recentExams] = await Promise.all([
    User.findAll({
      where: {
        ...buildWhere(instituteId, branchId),
        user_type: 'STUDENT',
      },
      attributes: ['id', 'first_name', 'last_name', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: 4,
      raw: true,
    }),
    FeeVoucher.findAll({
      where: buildWhere(instituteId, branchId),
      attributes: ['id', 'status', 'net_amount', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: 4,
      raw: true,
    }),
    Exam.findAll({
      where: buildWhere(instituteId, branchId),
      attributes: ['id', 'name', 'start_date', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: 3,
      raw: true,
    }),
  ]);

  const activity = [];

  recentStudents.forEach((student) => {
    activity.push({
      id: `student-${student.id}`,
      type: 'enrollment',
      message: `${student.first_name} ${student.last_name} registered as student`,
      time: format(new Date(student.created_at), 'dd MMM, hh:mm a'),
      created_at: student.created_at,
    });
  });

  recentVouchers.forEach((voucher) => {
    activity.push({
      id: `fee-${voucher.id}`,
      type: 'fee',
      message: `Fee voucher ${voucher.status} (${formatMoney(voucher.net_amount)})`,
      time: format(new Date(voucher.created_at), 'dd MMM, hh:mm a'),
      created_at: voucher.created_at,
    });
  });

  recentExams.forEach((exam) => {
    activity.push({
      id: `exam-${exam.id}`,
      type: 'exam',
      message: `Exam scheduled: ${exam.name}`,
      time: format(new Date(exam.created_at), 'dd MMM, hh:mm a'),
      created_at: exam.created_at,
    });
  });

  return activity
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)
    .map(({ created_at, ...rest }) => rest);
};

const buildStatCards = (typeSlug, stats) => {
  const isCoachingLike = typeSlug === 'coaching' || typeSlug === 'academy' || typeSlug === 'tuition_center';
  const isHigherEd = typeSlug === 'college' || typeSlug === 'university';

  const firstLabel = isCoachingLike
    ? typeSlug === 'academy' ? 'Total Trainees' : 'Total Candidates'
    : 'Total Students';

  const secondLabel = isCoachingLike
    ? typeSlug === 'academy' ? 'Trainers' : 'Instructors'
    : isHigherEd
      ? 'Faculty'
      : 'Teachers';

  const thirdLabel = isCoachingLike
    ? typeSlug === 'academy' ? 'Active Programs' : 'Active Courses'
    : isHigherEd
      ? 'Departments'
      : 'Classes';

  return [
    {
      label: firstLabel,
      value: stats.total_students.toLocaleString('en-PK'),
      icon: 'Users',
      trend: null,
      description: 'Current enrollment',
    },
    {
      label: secondLabel,
      value: stats.total_teachers.toLocaleString('en-PK'),
      icon: 'GraduationCap',
      trend: null,
      description: 'Active faculty members',
    },
    {
      label: thirdLabel,
      value: (isHigherEd ? stats.total_sections : stats.total_classes).toLocaleString('en-PK'),
      icon: isHigherEd ? 'Building2' : 'BookOpen',
      trend: null,
      description: isHigherEd ? 'Academic units' : 'Academic groups',
    },
    {
      label: 'Fee Collected',
      value: formatMoney(stats.fees_collected),
      icon: 'DollarSign',
      trend: null,
      description: 'Current month',
    },
    {
      label: 'Attendance Today',
      value: `${stats.today_attendance_pct}%`,
      icon: 'ClipboardCheck',
      trend: null,
      description: `Monthly avg ${stats.avg_attendance_pct}%`,
    },
    {
      label: 'Upcoming Exams',
      value: stats.upcoming_exams.toLocaleString('en-PK'),
      icon: 'Calendar',
      trend: null,
      description: 'Next 30 days',
    },
  ];
};

const resolveBranchScope = ({ reqUser, requestedBranchId }) => {
  if (reqUser?.user_type === 'BRANCH_ADMIN') {
    return reqUser.branch_id || null;
  }

  return requestedBranchId || null;
};

export const getInstituteDashboard = async ({
  instituteId,
  user,
  type,
  branchId,
}) => {
  const resolvedBranchId = resolveBranchScope({ reqUser: user, requestedBranchId: branchId });

  if (branchId && user?.user_type === 'BRANCH_ADMIN' && user?.branch_id && branchId !== user.branch_id) {
    throw new Error('Branch access denied for current user');
  }

  const institute = await Institute.findByPk(instituteId, {
    include: [{ model: InstituteType, as: 'type', attributes: ['id', 'name', 'slug'] }],
    attributes: ['id', 'institute_name', 'institute_code'],
  });

  if (!institute) {
    throw new Error('Institute not found');
  }

  if (resolvedBranchId) {
    const branch = await Branch.findOne({
      where: { id: resolvedBranchId, institute_id: instituteId, is_active: true },
      attributes: ['id', 'name'],
    });
    if (!branch) throw new Error('Branch not found');
  }

  const typeSlug = String(type || resolveTypeSlug(institute.type)).trim().toLowerCase() || 'school';

  const [overviewStats, attendance, fees, enrollmentData, feeStatus, recentActivity] = await Promise.all([
    getOverviewStats({ instituteId, branchId: resolvedBranchId }),
    getAttendanceChart({ instituteId, branchId: resolvedBranchId }),
    getFeesChart({ instituteId, branchId: resolvedBranchId }),
    getEnrollmentCharts({ instituteId, branchId: resolvedBranchId }),
    getFeeStatusChart({ instituteId, branchId: resolvedBranchId }),
    getRecentActivity({ instituteId, branchId: resolvedBranchId }),
  ]);

  return {
    institute: {
      id: institute.id,
      name: institute.institute_name,
      code: institute.institute_code,
      type: typeSlug,
    },
    stats: buildStatCards(typeSlug, overviewStats),
    summary: overviewStats,
    charts: {
      attendance,
      fees,
      enrollment: enrollmentData.enrollment,
      gender: enrollmentData.gender,
      feeStatus,
    },
    recentActivity,
    scope: {
      branch_id: resolvedBranchId || null,
      generated_at: new Date().toISOString(),
    },
    lastUpdated: new Date().toISOString(),
  };
};

export default {
  getInstituteDashboard,
};
