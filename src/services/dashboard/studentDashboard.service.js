// backend/src/services/dashboard/studentDashboard.service.js

/**
 * The Clouds Academy - Student Dashboard Service
 * 
 * Student ke liye complete portal data:
 * - My Profile
 * - My Classes
 * - My Timetable
 * - My Attendance
 * - My Results
 * - My Fees
 * - Homework & Assignments
 * - Notices & Announcements
 */

import { Op } from 'sequelize';
import models from '../../models/postgres/index.js';
import { startOfWeek, endOfWeek, format } from 'date-fns';

const { User, Timetable, FeeVoucher, Attendance, sequelize } = models;

/**
 * Get complete student dashboard data
 */
export const getStudentDashboard = async (studentId, instituteId) => {
  const today = new Date();
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);

  const [
    student,
    myClasses,
    weeklyTimetable,
    attendance,
    recentResults,
    feeStatus,
    homework,
    notices,
    statistics
  ] = await Promise.all([
    getStudentDetails(studentId, instituteId),
    getStudentClasses(studentId, instituteId),
    getStudentTimetable(studentId, instituteId, weekStart, weekEnd),
    getStudentAttendance(studentId, instituteId),
    getRecentResults(studentId, instituteId),
    getStudentFeeStatus(studentId, instituteId),
    getHomework(studentId, instituteId),
    getNotices(instituteId),
    getStudentStatistics(studentId, instituteId)
  ]);

  return {
    student: {
      id: student.id,
      name: `${student.first_name} ${student.last_name}`,
      registration_no: student.registration_no,
      avatar: student.avatar_url,
      class: student.details?.class_name,
      section: student.details?.section_name,
      roll_number: student.details?.roll_number,
      guardian: student.details?.guardian_name
    },
    my_classes: myClasses,
    weekly_timetable: weeklyTimetable,
    attendance: {
      summary: attendance.summary,
      recent: attendance.recent
    },
    recent_results: recentResults,
    fee_status: feeStatus,
    homework: {
      pending: homework.pending,
      completed: homework.completed,
      upcoming: homework.upcoming
    },
    notices: notices,
    statistics,
    quick_actions: [
      { label: 'View Timetable', icon: 'Calendar', href: '/timetable' },
      { label: 'Pay Fees', icon: 'CreditCard', href: '/fees/pay' },
      { label: 'Download Results', icon: 'Download', href: '/results' },
      { label: 'Contact Teacher', icon: 'MessageCircle', href: '/messages' }
    ]
  };
};

/**
 * Get student details
 */
const getStudentDetails = async (studentId, instituteId) => {
  return await User.findOne({
    where: { 
      id: studentId, 
      school_id: instituteId, 
      user_type: 'STUDENT' 
    }
  });
};

/**
 * Get classes student is enrolled in
 */
const getStudentClasses = async (studentId, instituteId) => {
  const student = await getStudentDetails(studentId, instituteId);
  
  return [{
    id: student.details?.class_id || 'class-1',
    name: student.details?.class_name || 'Class 10',
    section: student.details?.section_name || 'A',
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'English'],
    teacher: 'Mr. John Smith',
    progress: 75
  }];
};

/**
 * Get student's weekly timetable
 */
const getStudentTimetable = async (studentId, instituteId, weekStart, weekEnd) => {
  const student = await getStudentDetails(studentId, instituteId);
  
  // Get timetables for student's class/section
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true,
      [Op.or]: [
        { 'entity_ids.class_id': student.details?.class_id },
        { 'entity_ids.section_id': student.details?.section_id }
      ]
    }
  });

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const schedule = {};

  days.forEach(day => {
    schedule[day] = [];
  });

  timetables.forEach(timetable => {
    const slots = timetable.slots || [];
    slots.forEach(slot => {
      if (days.includes(slot.day)) {
        schedule[slot.day].push({
          id: slot.id,
          period: slot.period,
          start_time: slot.start_time,
          end_time: slot.end_time,
          subject: slot.subject_name,
          teacher: slot.teacher_name,
          room: slot.room_no
        });
      }
    });
  });

  // Sort each day by period
  Object.keys(schedule).forEach(day => {
    schedule[day].sort((a, b) => (a.period || 0) - (b.period || 0));
  });

  return schedule;
};

/**
 * Get student attendance
 */
const getStudentAttendance = async (studentId, instituteId) => {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const attendance = await Attendance.findAll({
    where: {
      school_id: instituteId,
      student_id: studentId,
      date: {
        [Op.between]: [monthStart, monthEnd]
      }
    },
    order: [['date', 'DESC']]
  });

  const total = attendance.length;
  const present = attendance.filter(a => a.status === 'present').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const late = attendance.filter(a => a.status === 'late').length;

  return {
    summary: {
      total_days: total,
      present,
      absent,
      late,
      percentage: total ? Math.round((present / total) * 100) : 0
    },
    recent: attendance.slice(0, 10).map(a => ({
      date: format(new Date(a.date), 'dd MMM yyyy'),
      status: a.status,
      subject: a.subject_name
    }))
  };
};

/**
 * Get recent exam results
 */
const getRecentResults = async (studentId, instituteId) => {
  // This would query exam results
  return [
    {
      id: 1,
      exam_name: 'Mid Term Exams 2024',
      date: '15 Mar 2024',
      subjects: [
        { name: 'Mathematics', marks: 85, total: 100, grade: 'A' },
        { name: 'Physics', marks: 78, total: 100, grade: 'B+' },
        { name: 'Chemistry', marks: 92, total: 100, grade: 'A+' }
      ],
      percentage: 85,
      rank: 5
    }
  ];
};

/**
 * Get student fee status
 */
const getStudentFeeStatus = async (studentId, instituteId) => {
  const vouchers = await FeeVoucher.findAll({
    where: {
      school_id: instituteId,
      student_id: studentId
    },
    order: [['due_date', 'ASC']],
    limit: 5
  });

  const totalDue = await FeeVoucher.sum('net_amount', {
    where: {
      school_id: instituteId,
      student_id: studentId,
      status: { [Op.in]: ['pending', 'overdue'] }
    }
  });

  return {
    total_due: totalDue || 0,
    last_paid: vouchers.find(v => v.status === 'paid')?.paid_at,
    next_due: vouchers.find(v => v.status === 'pending')?.due_date,
    vouchers: vouchers.map(v => ({
      id: v.id,
      title: v.title,
      amount: v.net_amount,
      due_date: v.due_date,
      status: v.status
    }))
  };
};

/**
 * Get homework and assignments
 */
const getHomework = async (studentId, instituteId) => {
  // This would query homework/assignments
  return {
    pending: [
      {
        id: 1,
        title: 'Mathematics Exercise 5.2',
        subject: 'Mathematics',
        due_date: '25 Mar 2024',
        priority: 'high',
        description: 'Solve questions 1-15 from chapter 5'
      },
      {
        id: 2,
        title: 'Physics Lab Report',
        subject: 'Physics',
        due_date: '28 Mar 2024',
        priority: 'medium',
        description: 'Write lab report for refraction experiment'
      }
    ],
    completed: [
      {
        id: 3,
        title: 'Chemistry Assignment',
        subject: 'Chemistry',
        completed_date: '20 Mar 2024',
        grade: 'A'
      }
    ],
    upcoming: [
      {
        id: 4,
        title: 'English Essay',
        subject: 'English',
        due_date: '30 Mar 2024',
        description: 'Write 500 words on "Importance of Education"'
      }
    ]
  };
};

/**
 * Get notices and announcements
 */
const getNotices = async (instituteId) => {
  // This would query notices
  return [
    {
      id: 1,
      title: 'Parent-Teacher Meeting',
      date: '28 Mar 2024',
      description: 'Annual parent-teacher meeting will be held on 28th March',
      priority: 'high',
      attachment: null
    },
    {
      id: 2,
      title: 'Summer Vacation Schedule',
      date: '25 Mar 2024',
      description: 'Summer vacations will start from 1st June',
      priority: 'medium'
    }
  ];
};

/**
 * Get student statistics
 */
const getStudentStatistics = async (studentId, instituteId) => {
  const attendance = await getStudentAttendance(studentId, instituteId);
  
  return {
    attendance_percentage: attendance.summary.percentage,
    average_grade: 'A-',
    rank_in_class: 8,
    total_assignments: 25,
    completed_assignments: 22,
    pending_assignments: 3
  };
};

export default {
  getStudentDashboard
};