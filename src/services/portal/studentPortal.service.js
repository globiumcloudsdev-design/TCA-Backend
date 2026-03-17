// backend/src/services/portal/studentPortal.service.js

/**
 * The Clouds Academy - Student Portal Unified Service
 * 
 * Student ke saare portal-specific functions ek hi jagah:
 * - Dashboard
 * - My Classes
 * - My Timetable
 * - My Attendance
 * - My Results
 * - My Fees
 * - Homework & Assignments
 * - Notices & Announcements
 * - Profile
 * - Library
 */

import { Op } from 'sequelize';
import models from '../../models/postgres/index.js';
import { startOfWeek, endOfWeek, format, addDays, subMonths } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';
import { unlink } from 'fs/promises';

const { 
  User, 
  Timetable, 
  Assignment, 
  AssignmentSubmission, 
  Attendance, 
  FeeVoucher,
  ExamResult,
  Notice,
  sequelize 
} = models;

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get complete student dashboard
 */
export const getStudentDashboard = async (studentId, instituteId) => {
  const today = new Date();
  
  const [
    student,
    todayClasses,
    upcomingAssignments,
    recentAttendance,
    recentResults,
    feeStatus,
    notices,
    statistics
  ] = await Promise.all([
    getStudentProfile(studentId, instituteId),
    getTodayClasses(studentId, instituteId),
    getUpcomingAssignments(studentId, instituteId, 5),
    getRecentAttendance(studentId, instituteId, 7),
    getRecentResults(studentId, instituteId, 3),
    getFeeSummary(studentId, instituteId),
    getRecentNotices(instituteId, 5),
    getStudentStats(studentId, instituteId)
  ]);

  return {
    student: {
      id: student.id,
      name: student.name,
      registration_no: student.registration_no,
      class: student.class,
      section: student.section,
      roll_number: student.roll_number,
      avatar: student.avatar
    },
    today_classes: todayClasses,
    upcoming_assignments: upcomingAssignments,
    recent_attendance: recentAttendance,
    recent_results: recentResults,
    fee_status: feeStatus,
    notices,
    statistics,
    quick_actions: [
      { label: 'View Timetable', icon: 'Calendar', href: '/timetable' },
      { label: 'Pay Fees', icon: 'CreditCard', href: '/fees/pay', alert: feeStatus.has_due },
      { label: 'Download Results', icon: 'Download', href: '/results' },
      { label: 'Contact Teacher', icon: 'MessageCircle', href: '/messages' }
    ]
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get student profile
 */
export const getStudentProfile = async (studentId, instituteId) => {
  const student = await User.findOne({
    where: { id: studentId, school_id: instituteId, user_type: 'STUDENT' },
    attributes: { exclude: ['password_hash', 'password_reset_token'] }
  });

  if (!student) throw new Error('Student not found');

  return {
    id: student.id,
    name: `${student.first_name} ${student.last_name}`,
    first_name: student.first_name,
    last_name: student.last_name,
    email: student.email,
    phone: student.phone,
    registration_no: student.registration_no,
    avatar: student.avatar_url,
    
    // Academic details from JSONB
    class_id: student.details?.class_id,
    class_name: student.details?.class_name,
    section_id: student.details?.section_id,
    section_name: student.details?.section_name,
    roll_number: student.details?.roll_number,
    admission_date: student.details?.admission_date,
    
    // Personal details
    date_of_birth: student.details?.date_of_birth,
    gender: student.details?.gender,
    blood_group: student.details?.blood_group,
    religion: student.details?.religion,
    nationality: student.details?.nationality,
    
    // Address
    present_address: student.details?.present_address,
    permanent_address: student.details?.permanent_address,
    city: student.details?.city,
    
    // Guardian info
    guardian_name: student.details?.guardian_name,
    guardian_relation: student.details?.guardian_relation,
    guardian_phone: student.details?.guardian_phone,
    guardian_email: student.details?.guardian_email,
    
    // Documents
    documents: student.documents || [],
    
    created_at: student.created_at
  };
};

/**
 * Update student profile (limited fields)
 */
export const updateStudentProfile = async (studentId, instituteId, updateData, file = null) => {
  const student = await User.findOne({
    where: { id: studentId, school_id: instituteId, user_type: 'STUDENT' }
  });

  if (!student) throw new Error('Student not found');

  let avatarUrl = student.avatar_url;
  let avatarPublicId = student.avatar_public_id;

  // Upload new avatar
  if (file) {
    try {
      const folder = `the-clouds-academy/${instituteId}/students/avatars`;
      const result = await uploadToCloudinary(file.path, folder, {
        transformation: [{ width: 300, height: 300, crop: 'thumb' }]
      });

      avatarUrl = result.url;
      
      if (student.avatar_public_id) {
        await deleteFromCloudinary(student.avatar_public_id).catch(() => {});
      }
      avatarPublicId = result.public_id;
    } finally {
      try { await unlink(file.path); } catch { /* ignore */ }
    }
  }

  // Update allowed fields only
  const allowedFields = ['phone', 'email'];
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      student[field] = updateData[field];
    }
  });

  // Update details (student can update limited personal info)
  if (updateData.details) {
    const allowedDetails = [
      'present_address', 'permanent_address', 'city',
      'emergency_contact_name', 'emergency_contact_phone'
    ];
    
    const currentDetails = student.details || {};
    const newDetails = { ...currentDetails };
    
    allowedDetails.forEach(field => {
      if (updateData.details[field] !== undefined) {
        newDetails[field] = updateData.details[field];
      }
    });
    
    student.details = newDetails;
  }

  if (avatarUrl) {
    student.avatar_url = avatarUrl;
    student.avatar_public_id = avatarPublicId;
  }

  await student.save();
  return getStudentProfile(studentId, instituteId);
};

// ─────────────────────────────────────────────────────────────────────────────
// MY CLASSES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get student's classes/subjects
 */
export const getMyClasses = async (studentId, instituteId) => {
  const student = await getStudentProfile(studentId, instituteId);
  
  // Get timetable for student's class
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true,
      'entity_ids.class_id': student.class_id
    }
  });

  // Extract subjects from timetable
  const subjects = new Map();
  
  timetables.forEach(timetable => {
    (timetable.slots || []).forEach(slot => {
      if (slot.subject_name && !slot.is_break) {
        if (!subjects.has(slot.subject_name)) {
          subjects.set(slot.subject_name, {
            name: slot.subject_name,
            teacher: slot.teacher_name,
            room: slot.room_no,
            total_classes: 0,
            attended: 0
          });
        }
      }
    });
  });

  // Get attendance for each subject
  const attendance = await Attendance.findAll({
    where: {
      school_id: instituteId,
      student_id: studentId
    }
  });

  const subjectAttendance = {};
  attendance.forEach(a => {
    if (a.subject_name) {
      subjectAttendance[a.subject_name] = subjectAttendance[a.subject_name] || { total: 0, present: 0 };
      subjectAttendance[a.subject_name].total++;
      if (a.status === 'present') {
        subjectAttendance[a.subject_name].present++;
      }
    }
  });

  // Calculate attendance percentage for each subject
  const classes = Array.from(subjects.values()).map(subject => {
    const att = subjectAttendance[subject.name] || { total: 0, present: 0 };
    return {
      ...subject,
      attendance_percentage: att.total ? Math.round((att.present / att.total) * 100) : 0,
      total_classes: att.total,
      attended: att.present
    };
  });

  return classes;
};

// ─────────────────────────────────────────────────────────────────────────────
// TIMETABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get student's weekly timetable
 */
export const getMyTimetable = async (studentId, instituteId, weekStart = null) => {
  const student = await getStudentProfile(studentId, instituteId);
  
  const startDate = weekStart ? new Date(weekStart) : startOfWeek(new Date());
  const endDate = endOfWeek(startDate);

  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true,
      'entity_ids.class_id': student.class_id
    }
  });

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const schedule = {};

  days.forEach(day => { schedule[day] = []; });

  timetables.forEach(timetable => {
    const slots = timetable.slots || [];
    slots.forEach(slot => {
      if (days.includes(slot.day) && !slot.is_break) {
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

  // Sort each day by start time
  Object.keys(schedule).forEach(day => {
    schedule[day].sort((a, b) => a.start_time?.localeCompare(b.start_time || ''));
  });

  return {
    week: {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd')
    },
    schedule
  };
};

/**
 * Get today's classes
 */
export const getTodayClasses = async (studentId, instituteId) => {
  const student = await getStudentProfile(studentId, instituteId);
  const today = format(new Date(), 'EEEE').toLowerCase();

  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true,
      'entity_ids.class_id': student.class_id
    }
  });

  const todayClasses = [];

  timetables.forEach(timetable => {
    (timetable.slots || [])
      .filter(slot => slot.day === today && !slot.is_break)
      .forEach(slot => {
        todayClasses.push({
          id: slot.id,
          time: `${slot.start_time} - ${slot.end_time}`,
          subject: slot.subject_name,
          teacher: slot.teacher_name,
          room: slot.room_no,
          status: 'upcoming' // Can be 'ongoing', 'completed', 'upcoming'
        });
      });
  });

  return todayClasses.sort((a, b) => a.start_time?.localeCompare(b.start_time || ''));
};

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get student attendance history
 */
export const getMyAttendance = async (studentId, instituteId, filters = {}) => {
  const where = {
    school_id: instituteId,
    student_id: studentId
  };

  if (filters.from_date) {
    where.date = { [Op.gte]: new Date(filters.from_date) };
  }
  if (filters.to_date) {
    where.date = { ...where.date, [Op.lte]: new Date(filters.to_date) };
  }
  if (filters.subject) {
    where.subject_name = filters.subject;
  }

  const attendance = await Attendance.findAll({
    where,
    order: [['date', 'DESC']],
    limit: filters.limit || 100
  });

  // Calculate summary
  const total = attendance.length;
  const present = attendance.filter(a => a.status === 'present').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const late = attendance.filter(a => a.status === 'late').length;
  const leave = attendance.filter(a => a.status === 'leave').length;

  // Group by subject
  const subjectWise = {};
  attendance.forEach(a => {
    if (a.subject_name) {
      subjectWise[a.subject_name] = subjectWise[a.subject_name] || { total: 0, present: 0, absent: 0, late: 0 };
      subjectWise[a.subject_name].total++;
      subjectWise[a.subject_name][a.status]++;
    }
  });

  // Calculate percentages for each subject
  const subjectStats = Object.entries(subjectWise).map(([subject, stats]) => ({
    subject,
    total: stats.total,
    present: stats.present,
    absent: stats.absent,
    late: stats.late,
    percentage: Math.round((stats.present / stats.total) * 100) || 0
  }));

  return {
    summary: {
      total,
      present,
      absent,
      late,
      leave,
      percentage: total ? Math.round((present / total) * 100) : 0
    },
    subject_wise: subjectStats,
    records: attendance.slice(0, 30).map(a => ({
      date: format(new Date(a.date), 'dd MMM yyyy'),
      day: format(new Date(a.date), 'EEEE'),
      subject: a.subject_name,
      status: a.status,
      marked_by: a.marked_by_name
    }))
  };
};

/**
 * Get recent attendance for dashboard
 */
export const getRecentAttendance = async (studentId, instituteId, days = 7) => {
  const fromDate = addDays(new Date(), -days);
  
  const attendance = await Attendance.findAll({
    where: {
      school_id: instituteId,
      student_id: studentId,
      date: { [Op.gte]: fromDate }
    },
    order: [['date', 'ASC']]
  });

  const total = attendance.length;
  const present = attendance.filter(a => a.status === 'present').length;

  // Group by date for chart
  const chartData = {};
  attendance.forEach(a => {
    const dateStr = format(new Date(a.date), 'dd MMM');
    chartData[dateStr] = a.status;
  });

  return {
    total_days: total,
    present_days: present,
    percentage: total ? Math.round((present / total) * 100) : 0,
    chart: chartData
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENTS & HOMEWORK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get student's assignments
 */
export const getMyAssignments = async (studentId, instituteId, filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const student = await getStudentProfile(studentId, instituteId);

  // Find assignments for student's class
  const where = {
    institute_id: instituteId,
    is_published: true,
    [Op.or]: [
      { target_type: 'class', target_ids: { [Op.contains]: [student.class_id] } },
      { target_type: 'section', target_ids: { [Op.contains]: [student.section_id] } },
      { target_type: 'all' }
    ]
  };

  if (filters.subject) where.subject = filters.subject;
  if (filters.status === 'pending') {
    where.due_date = { [Op.gte]: new Date() };
  }
  if (filters.status === 'overdue') {
    where.due_date = { [Op.lt]: new Date() };
  }

  const { count, rows } = await Assignment.findAndCountAll({
    where,
    order: [['due_date', 'ASC']],
    limit,
    offset,
    include: [
      {
        model: User,
        as: 'teacher',
        attributes: ['id', 'first_name', 'last_name', 'avatar_url']
      }
    ]
  });

  // Get student's submissions
  const submissions = await AssignmentSubmission.findAll({
    where: {
      student_id: studentId,
      assignment_id: { [Op.in]: rows.map(a => a.id) }
    }
  });

  const submissionsMap = {};
  submissions.forEach(s => { submissionsMap[s.assignment_id] = s; });

  const assignmentsWithStatus = rows.map(assignment => {
    const submission = submissionsMap[assignment.id];
    const isOverdue = new Date(assignment.due_date) < new Date();
    
    let status = 'pending';
    if (submission) {
      if (submission.status === 'graded') status = 'graded';
      else if (submission.status === 'submitted') status = 'submitted';
      else if (submission.status === 'late') status = 'late';
    } else if (isOverdue) {
      status = 'overdue';
    }

    return {
      id: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      teacher: assignment.teacher ? `${assignment.teacher.first_name} ${assignment.teacher.last_name}` : 'Unknown',
      due_date: assignment.due_date,
      total_marks: assignment.total_marks,
      status,
      submission: submission ? {
        id: submission.id,
        submitted_at: submission.submitted_at,
        marks: submission.marks,
        feedback: submission.feedback,
        files: submission.files
      } : null,
      attachments: assignment.attachments
    };
  });

  return {
    data: assignmentsWithStatus,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    }
  };
};

/**
 * Get upcoming assignments (for dashboard)
 */
export const getUpcomingAssignments = async (studentId, instituteId, limit = 5) => {
  const student = await getStudentProfile(studentId, instituteId);
  const today = new Date();

  const assignments = await Assignment.findAll({
    where: {
      institute_id: instituteId,
      is_published: true,
      due_date: { [Op.gte]: today },
      [Op.or]: [
        { target_type: 'class', target_ids: { [Op.contains]: [student.class_id] } },
        { target_type: 'all' }
      ]
    },
    order: [['due_date', 'ASC']],
    limit,
    include: [
      {
        model: User,
        as: 'teacher',
        attributes: ['id', 'first_name', 'last_name']
      }
    ]
  });

  // Get submissions
  const submissions = await AssignmentSubmission.findAll({
    where: {
      student_id: studentId,
      assignment_id: { [Op.in]: assignments.map(a => a.id) }
    }
  });

  const submittedIds = new Set(submissions.map(s => s.assignment_id));

  return assignments
    .filter(a => !submittedIds.has(a.id))
    .map(a => ({
      id: a.id,
      title: a.title,
      subject: a.subject,
      teacher: a.teacher ? `${a.teacher.first_name} ${a.teacher.last_name}` : 'Unknown',
      due_date: a.due_date,
      days_left: Math.ceil((new Date(a.due_date) - today) / (1000 * 60 * 60 * 24))
    }));
};

/**
 * Submit assignment
 */
export const submitAssignment = async (assignmentId, studentId, instituteId, files = []) => {
  const transaction = await sequelize.transaction();

  try {
    // Check if assignment exists and is published
    const assignment = await Assignment.findOne({
      where: { id: assignmentId, institute_id: instituteId, is_published: true }
    });

    if (!assignment) throw new Error('Assignment not found');

    // Check if already submitted
    const existing = await AssignmentSubmission.findOne({
      where: { assignment_id: assignmentId, student_id: studentId }
    });

    if (existing) throw new Error('You have already submitted this assignment');

    // Upload files
    const submissionFiles = [];
    if (files?.length) {
      for (const file of files) {
        const folder = `the-clouds-academy/${instituteId}/submissions/${assignmentId}/${studentId}`;
        const result = await uploadToCloudinary(file.path, folder, {
          resource_type: 'auto',
          use_filename: true
        });

        submissionFiles.push({
          id: uuidv4(),
          name: file.originalname,
          url: result.url,
          public_id: result.public_id,
          size: file.size,
          type: file.mimetype,
          uploaded_at: new Date()
        });

        try { await unlink(file.path); } catch { /* ignore */ }
      }
    }

    // Check if late
    const isLate = new Date(assignment.due_date) < new Date();

    // Create submission
    const submission = await AssignmentSubmission.create({
      id: uuidv4(),
      assignment_id: assignmentId,
      institute_id: instituteId,
      student_id: studentId,
      files: submissionFiles,
      submitted_at: new Date(),
      status: isLate ? 'late' : 'submitted',
      attempt_number: 1,
      is_resubmission: false
    }, { transaction });

    await transaction.commit();

    return {
      id: submission.id,
      submitted_at: submission.submitted_at,
      status: submission.status,
      files: submissionFiles
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get student's exam results
 */
export const getMyResults = async (studentId, instituteId, filters = {}) => {
  const where = {
    school_id: instituteId,
    student_id: studentId
  };

  if (filters.exam_type) where.exam_type = filters.exam_type;
  if (filters.academic_year_id) where.academic_year_id = filters.academic_year_id;

  const results = await ExamResult.findAll({
    where,
    order: [['exam_date', 'DESC']],
    include: [
      { model: models.Exam, as: 'exam', attributes: ['id', 'name', 'exam_type'] }
    ]
  });

  // Group by exam
  const examGroups = {};
  results.forEach(r => {
    const examId = r.exam_id;
    if (!examGroups[examId]) {
      examGroups[examId] = {
        exam_id: examId,
        exam_name: r.exam?.name,
        exam_type: r.exam?.exam_type,
        date: r.exam_date,
        subjects: [],
        total_marks: 0,
        obtained_marks: 0,
        percentage: 0,
        rank: r.rank
      };
    }
    examGroups[examId].subjects.push({
      subject: r.subject_name,
      marks: r.obtained_marks,
      total: r.total_marks,
      grade: r.grade,
      remarks: r.remarks
    });
    examGroups[examId].total_marks += r.total_marks;
    examGroups[examId].obtained_marks += r.obtained_marks;
  });

  // Calculate percentages
  Object.values(examGroups).forEach(exam => {
    exam.percentage = Math.round((exam.obtained_marks / exam.total_marks) * 100) || 0;
  });

  return Object.values(examGroups);
};

/**
 * Get recent results for dashboard
 */
export const getRecentResults = async (studentId, instituteId, limit = 3) => {
  const results = await ExamResult.findAll({
    where: { school_id: instituteId, student_id: studentId },
    order: [['exam_date', 'DESC']],
    limit,
    include: [
      { model: models.Exam, as: 'exam', attributes: ['name'] }
    ]
  });

  const examMap = {};
  results.forEach(r => {
    const examId = r.exam_id;
    if (!examMap[examId]) {
      examMap[examId] = {
        exam_name: r.exam?.name,
        date: r.exam_date,
        subjects: [],
        total: 0,
        obtained: 0
      };
    }
    examMap[examId].subjects.push({
      subject: r.subject_name,
      marks: r.obtained_marks,
      total: r.total_marks
    });
    examMap[examId].total += r.total_marks;
    examMap[examId].obtained += r.obtained_marks;
  });

  return Object.values(examMap).map(exam => ({
    exam_name: exam.exam_name,
    date: exam.date,
    subjects: exam.subjects.length,
    percentage: Math.round((exam.obtained / exam.total) * 100) || 0,
    obtained: exam.obtained,
    total: exam.total
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// FEES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get student's fee details
 */
export const getMyFees = async (studentId, instituteId, filters = {}) => {
  const where = {
    school_id: instituteId,
    student_id: studentId
  };

  if (filters.status) where.status = filters.status;

  const vouchers = await FeeVoucher.findAll({
    where,
    order: [['due_date', 'ASC']]
  });

  const totalDue = vouchers
    .filter(v => v.status === 'pending' || v.status === 'overdue')
    .reduce((sum, v) => sum + parseFloat(v.net_amount || 0), 0);

  const totalPaid = vouchers
    .filter(v => v.status === 'paid')
    .reduce((sum, v) => sum + parseFloat(v.net_amount || 0), 0);

  const nextDue = vouchers
    .filter(v => v.status === 'pending')
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

  return {
    summary: {
      total_due: totalDue,
      total_paid: totalPaid,
      pending_vouchers: vouchers.filter(v => v.status === 'pending').length,
      overdue_vouchers: vouchers.filter(v => v.status === 'overdue').length,
      paid_vouchers: vouchers.filter(v => v.status === 'paid').length,
      next_due_date: nextDue?.due_date,
      next_due_amount: nextDue?.net_amount
    },
    vouchers: vouchers.map(v => ({
      id: v.id,
      title: v.title,
      amount: v.net_amount,
      due_date: v.due_date,
      status: v.status,
      paid_date: v.paid_at,
      fine: v.fine_amount,
      discount: v.discount_amount
    }))
  };
};

/**
 * Get fee summary for dashboard
 */
export const getFeeSummary = async (studentId, instituteId) => {
  const vouchers = await FeeVoucher.findAll({
    where: {
      school_id: instituteId,
      student_id: studentId
    },
    order: [['due_date', 'ASC']]
  });

  const due = vouchers.filter(v => v.status === 'pending' || v.status === 'overdue');
  const totalDue = due.reduce((sum, v) => sum + parseFloat(v.net_amount || 0), 0);
  const nextDue = due[0];

  return {
    has_due: due.length > 0,
    total_due: totalDue,
    due_count: due.length,
    next_due_date: nextDue?.due_date,
    next_due_amount: nextDue?.net_amount
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get notices for student
 */
export const getNotices = async (instituteId, filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const where = {
    institute_id: instituteId,
    is_published: true,
    target_audience: { [Op.overlap]: ['student', 'all'] }
  };

  if (filters.priority) where.priority = filters.priority;

  const { count, rows } = await Notice.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset
  });

  return {
    data: rows.map(n => ({
      id: n.id,
      title: n.title,
      content: n.content,
      priority: n.priority,
      created_at: n.created_at,
      attachments: n.attachments
    })),
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    }
  };
};

/**
 * Get recent notices for dashboard
 */
export const getRecentNotices = async (instituteId, limit = 5) => {
  const notices = await Notice.findAll({
    where: {
      institute_id: instituteId,
      is_published: true,
      target_audience: { [Op.overlap]: ['student', 'all'] }
    },
    order: [['created_at', 'DESC']],
    limit
  });

  return notices.map(n => ({
    id: n.id,
    title: n.title,
    content: n.content?.substring(0, 100) + '...',
    priority: n.priority,
    date: format(new Date(n.created_at), 'dd MMM yyyy')
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// LIBRARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get library books and student's issued books
 */
export const getLibraryData = async (studentId, instituteId) => {
  // This would query library model
  return {
    issued_books: [
      {
        id: 1,
        title: 'Mathematics Class 10',
        author: 'R.D. Sharma',
        issue_date: '2024-02-15',
        due_date: '2024-03-15',
        status: 'issued'
      }
    ],
    available_books: [
      {
        id: 2,
        title: 'Physics Part 1',
        author: 'H.C. Verma',
        available_copies: 5
      }
    ],
    history: []
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const getStudentStats = async (studentId, instituteId) => {
  const [attendance, assignments, results] = await Promise.all([
    getRecentAttendance(studentId, instituteId, 30),
    AssignmentSubmission.count({ where: { student_id: studentId } }),
    ExamResult.count({ where: { school_id: instituteId, student_id: studentId } })
  ]);

  return {
    attendance_percentage: attendance.percentage,
    total_assignments_submitted: assignments,
    total_exams_taken: results,
    rank: 15 // Would calculate from results
  };
};

export default {
  // Dashboard
  getStudentDashboard,
  
  // Profile
  getStudentProfile,
  updateStudentProfile,
  
  // Classes & Timetable
  getMyClasses,
  getMyTimetable,
  getTodayClasses,
  
  // Attendance
  getMyAttendance,
  getRecentAttendance,
  
  // Assignments
  getMyAssignments,
  getUpcomingAssignments,
  submitAssignment,
  
  // Results
  getMyResults,
  getRecentResults,
  
  // Fees
  getMyFees,
  getFeeSummary,
  
  // Notices
  getNotices,
  getRecentNotices,
  
  // Library
  getLibraryData
};