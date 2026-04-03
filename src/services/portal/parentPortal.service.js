// backend/src/services/portal/parentPortal.service.js

/**
 * The Clouds Academy - Parent Portal Unified Service
 * 
 * Parent ke saare portal-specific functions ek hi jagah:
 * - Dashboard (with multiple children)
 * - Each child's data (attendance, results, fees, assignments)
 * - Profile management
 * - Fee payments
 * - Notices
 * - Communication with teachers
 */

import { Op } from 'sequelize';
import models from '../../models/postgres/index.js';
import { format, addDays, subMonths } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';
import { unlink } from 'fs/promises';


const {
  User,
  Timetable,
  Assignment,
  AssignmentSubmission,
  StudentAttendance: Attendance,
  FeeVoucher,
  ExamResult,
  Notice,
  sequelize
} = models;

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get complete parent dashboard with all children's data
 */
export const getParentDashboard = async (parentId, instituteId) => {
  const [parent, children] = await Promise.all([
    getParentProfile(parentId, instituteId),
    getMyChildren(parentId, instituteId)
  ]);

  // Get dashboard data for each child
  const childrenWithData = await Promise.all(
    children.map(async (child) => {
      const [attendance, upcomingAssignments, recentResults, feeStatus] = await Promise.all([
        getChildAttendanceSummary(child.id, instituteId),
        getChildUpcomingAssignments(child.id, instituteId, 3),
        getChildRecentResults(child.id, instituteId, 2),
        getChildFeeSummary(child.id, instituteId)
      ]);

      return {
        ...child,
        attendance,
        upcoming_assignments: upcomingAssignments,
        recent_results: recentResults,
        fee_status: feeStatus,
        alerts: getChildAlerts(child, { attendance, feeStatus, upcomingAssignments })
      };
    })
  );

  // Get recent notices for parent
  const notices = await getParentNotices(instituteId, 5);

  // Calculate overall stats
  const stats = calculateParentStats(childrenWithData);

  return {
    parent: {
      id: parent.id,
      name: parent.name,
      email: parent.email,
      phone: parent.phone,
      avatar: parent.avatar,
      children_count: children.length
    },
    children: childrenWithData,
    notices,
    stats,
    quick_actions: [
      { label: 'Pay Fees', icon: 'CreditCard', href: '/fees/pay', alert: stats.has_fee_due },
      { label: 'View Attendance', icon: 'CheckSquare', href: '/attendance' },
      { label: 'Check Results', icon: 'Award', href: '/results' },
      { label: 'Contact Teacher', icon: 'MessageCircle', href: '/messages' }
    ]
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get parent profile
 */
export const getParentProfile = async (parentId, instituteId) => {
  const parent = await User.findOne({
    where: { id: parentId, school_id: instituteId, user_type: 'PARENT' },
    attributes: { exclude: ['password_hash', 'password_reset_token'] }
  });

  if (!parent) throw new Error('Parent not found');

  return {
    id: parent.id,
    name: `${parent.first_name} ${parent.last_name}`,
    first_name: parent.first_name,
    last_name: parent.last_name,
    email: parent.email,
    phone: parent.phone,
    avatar: parent.avatar_url,
    
    // Personal details
    occupation: parent.details?.occupation,
    cnic: parent.details?.cnic,
    address: parent.details?.address,
    city: parent.details?.city,
    
    // Children count
    children_count: parent.details?.children_ids?.length || 0,
    
    created_at: parent.created_at
  };
};

/**
 * Update parent profile
 */
export const updateParentProfile = async (parentId, instituteId, updateData, file = null) => {
  const parent = await User.findOne({
    where: { id: parentId, school_id: instituteId, user_type: 'PARENT' }
  });

  if (!parent) throw new Error('Parent not found');

  let avatarUrl = parent.avatar_url;
  let avatarPublicId = parent.avatar_public_id;

  // Upload new avatar
  if (file) {
    try {
      const folder = `the-clouds-academy/${instituteId}/parents/avatars`;
      const result = await uploadToCloudinary(file.path, folder, {
        transformation: [{ width: 300, height: 300, crop: 'thumb' }]
      });

      avatarUrl = result.url;
      
      if (parent.avatar_public_id) {
        await deleteFromCloudinary(parent.avatar_public_id).catch(() => {});
      }
      avatarPublicId = result.public_id;
    } finally {
      try { await unlink(file.path); } catch { /* ignore */ }
    }
  }

  // Update allowed fields
  const allowedFields = ['first_name', 'last_name', 'email', 'phone'];
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      parent[field] = updateData[field];
    }
  });

  // Update details
  if (updateData.details) {
    const allowedDetails = ['occupation', 'cnic', 'address', 'city'];
    const currentDetails = parent.details || {};
    
    allowedDetails.forEach(field => {
      if (updateData.details[field] !== undefined) {
        currentDetails[field] = updateData.details[field];
      }
    });
    
    parent.details = currentDetails;
  }

  if (avatarUrl) {
    parent.avatar_url = avatarUrl;
    parent.avatar_public_id = avatarPublicId;
  }

  await parent.save();
  return getParentProfile(parentId, instituteId);
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILDREN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all children of a parent
 */
export const getMyChildren = async (parentId, instituteId) => {
  const parent = await User.findByPk(parentId);
  
  const childrenIds = parent.details?.children_ids || [];
  
  if (childrenIds.length === 0) return [];

  const children = await User.findAll({
    where: {
      id: { [Op.in]: childrenIds },
      school_id: instituteId,
      user_type: 'STUDENT',
      is_active: true
    },
    attributes: ['id', 'first_name', 'last_name', 'registration_no', 'avatar_url', 'details']
  });

  return children.map(child => ({
    id: child.id,
    name: `${child.first_name} ${child.last_name}`,
    registration_no: child.registration_no,
    avatar: child.avatar_url,
    class: child.details?.class_name,
    section: child.details?.section_name,
    roll_number: child.details?.roll_number,
    class_id: child.details?.class_id,
    section_id: child.details?.section_id
  }));
};

/**
 * Get specific child details
 */
export const getChildDetails = async (childId, parentId, instituteId) => {
  // Verify parent owns this child
  const parent = await User.findByPk(parentId);
  const childrenIds = parent.details?.children_ids || [];
  
  if (!childrenIds.includes(childId)) {
    throw new Error('You are not authorized to view this child\'s data');
  }

  const child = await User.findOne({
    where: { id: childId, school_id: instituteId, user_type: 'STUDENT' },
    attributes: ['id', 'first_name', 'last_name', 'registration_no', 'avatar_url', 'details']
  });

  if (!child) throw new Error('Child not found');

  // Get comprehensive child data
  const [attendance, results, fees, assignments, timetable] = await Promise.all([
    getChildFullAttendance(childId, instituteId),
    getChildFullResults(childId, instituteId),
    getChildFullFees(childId, instituteId),
    getChildAssignments(childId, instituteId, { limit: 10 }),
    getChildTimetable(childId, instituteId)
  ]);

  return {
    child: {
      id: child.id,
      name: `${child.first_name} ${child.last_name}`,
      registration_no: child.registration_no,
      avatar: child.avatar_url,
      class: child.details?.class_name,
      section: child.details?.section_name,
      roll_number: child.details?.roll_number,
      date_of_birth: child.details?.date_of_birth,
      blood_group: child.details?.blood_group
    },
    attendance,
    results,
    fees,
    assignments: assignments.data,
    timetable
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get attendance summary for a child
 */
const getChildAttendanceSummary = async (childId, instituteId) => {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const attendance = await Attendance.findAll({
    where: {
      school_id: instituteId,
      student_id: childId,
      date: { [Op.gte]: monthStart }
    },
    order: [['date', 'DESC']]
  });

  const total = attendance.length;
  const present = attendance.filter(a => a.status === 'present').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const late = attendance.filter(a => a.status === 'late').length;

  // Subject-wise breakdown
  const subjectWise = {};
  attendance.forEach(a => {
    if (a.subject_name) {
      subjectWise[a.subject_name] = subjectWise[a.subject_name] || { total: 0, present: 0 };
      subjectWise[a.subject_name].total++;
      if (a.status === 'present') subjectWise[a.subject_name].present++;
    }
  });

  const subjectStats = Object.entries(subjectWise).map(([subject, stats]) => ({
    subject,
    percentage: Math.round((stats.present / stats.total) * 100) || 0
  }));

  return {
    month: format(monthStart, 'MMMM yyyy'),
    total_days: total,
    present,
    absent,
    late,
    percentage: total ? Math.round((present / total) * 100) : 0,
    subject_wise: subjectStats,
    recent: attendance.slice(0, 5).map(a => ({
      date: format(new Date(a.date), 'dd MMM'),
      status: a.status,
      subject: a.subject_name
    }))
  };
};

/**
 * Get full attendance history for a child
 */
const getChildFullAttendance = async (childId, instituteId) => {
  const attendance = await Attendance.findAll({
    where: {
      school_id: instituteId,
      student_id: childId
    },
    order: [['date', 'DESC']]
  });

  // Group by month
  const monthlyStats = {};
  attendance.forEach(a => {
    const monthKey = format(new Date(a.date), 'yyyy-MM');
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = { total: 0, present: 0, absent: 0, late: 0 };
    }
    monthlyStats[monthKey].total++;
    monthlyStats[monthKey][a.status]++;
  });

  const monthly = Object.entries(monthlyStats).map(([month, stats]) => ({
    month: format(new Date(month + '-01'), 'MMMM yyyy'),
    ...stats,
    percentage: Math.round((stats.present / stats.total) * 100) || 0
  }));

  return {
    summary: {
      total: attendance.length,
      present: attendance.filter(a => a.status === 'present').length,
      absent: attendance.filter(a => a.status === 'absent').length,
      late: attendance.filter(a => a.status === 'late').length,
      percentage: attendance.length ? 
        Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100) : 0
    },
    monthly,
    records: attendance.slice(0, 30).map(a => ({
      date: format(new Date(a.date), 'dd MMM yyyy'),
      day: format(new Date(a.date), 'EEEE'),
      subject: a.subject_name,
      status: a.status
    }))
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD RESULTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get recent results for a child
 */
const getChildRecentResults = async (childId, instituteId, limit = 2) => {
  const results = await ExamResult.findAll({
    where: {
      school_id: instituteId,
      student_id: childId
    },
    order: [['exam_date', 'DESC']],
    limit: limit * 5, // Get more to group by exam
    include: [
      { model: models.Exam, as: 'exam', attributes: ['name', 'exam_type'] }
    ]
  });

  // Group by exam
  const examGroups = {};
  results.forEach(r => {
    const examId = r.exam_id;
    if (!examGroups[examId]) {
      examGroups[examId] = {
        exam_name: r.exam?.name,
        exam_type: r.exam?.exam_type,
        date: r.exam_date,
        subjects: [],
        total: 0,
        obtained: 0
      };
    }
    examGroups[examId].subjects.push({
      subject: r.subject_name,
      marks: r.obtained_marks,
      total: r.total_marks,
      grade: r.grade
    });
    examGroups[examId].total += r.total_marks;
    examGroups[examId].obtained += r.obtained_marks;
  });

  return Object.values(examGroups).slice(0, limit).map(exam => ({
    exam_name: exam.exam_name,
    date: exam.date,
    subjects_count: exam.subjects.length,
    percentage: Math.round((exam.obtained / exam.total) * 100) || 0,
    total_marks: exam.total,
    obtained_marks: exam.obtained,
    subjects: exam.subjects.slice(0, 3) // Show only top 3 subjects in summary
  }));
};

/**
 * Get full results for a child
 */
const getChildFullResults = async (childId, instituteId) => {
  const results = await ExamResult.findAll({
    where: {
      school_id: instituteId,
      student_id: childId
    },
    order: [['exam_date', 'DESC']],
    include: [
      { model: models.Exam, as: 'exam', attributes: ['name', 'exam_type'] }
    ]
  });

  // Group by exam
  const exams = {};
  results.forEach(r => {
    const examId = r.exam_id;
    if (!exams[examId]) {
      exams[examId] = {
        exam_id: examId,
        exam_name: r.exam?.name,
        exam_type: r.exam?.exam_type,
        date: r.exam_date,
        subjects: [],
        total_marks: 0,
        obtained_marks: 0,
        rank: r.rank
      };
    }
    exams[examId].subjects.push({
      subject: r.subject_name,
      marks: r.obtained_marks,
      total: r.total_marks,
      grade: r.grade,
      remarks: r.remarks
    });
    exams[examId].total_marks += r.total_marks;
    exams[examId].obtained_marks += r.obtained_marks;
  });

  return Object.values(exams).map(exam => ({
    ...exam,
    percentage: Math.round((exam.obtained_marks / exam.total_marks) * 100) || 0
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD FEES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get fee summary for a child
 */
const getChildFeeSummary = async (childId, instituteId) => {
  const vouchers = await FeeVoucher.findAll({
    where: {
      school_id: instituteId,
      student_id: childId
    },
    order: [['due_date', 'ASC']]
  });

  const due = vouchers.filter(v => v.status === 'pending' || v.status === 'overdue');
  const totalDue = due.reduce((sum, v) => sum + parseFloat(v.net_amount || 0), 0);
  const nextDue = due[0];

  return {
    has_due: due.length > 0,
    due_count: due.length,
    total_due: totalDue,
    next_due_date: nextDue?.due_date,
    next_due_amount: nextDue?.net_amount,
    next_due_title: nextDue?.title
  };
};

/**
 * Get full fee details for a child
 */
const getChildFullFees = async (childId, instituteId) => {
  const vouchers = await FeeVoucher.findAll({
    where: {
      school_id: instituteId,
      student_id: childId
    },
    order: [['due_date', 'DESC']]
  });

  const summary = {
    total_paid: 0,
    total_due: 0,
    paid_count: 0,
    pending_count: 0,
    overdue_count: 0
  };

  const voucherList = vouchers.map(v => {
    const amount = parseFloat(v.net_amount || 0);
    if (v.status === 'paid') {
      summary.total_paid += amount;
      summary.paid_count++;
    } else if (v.status === 'overdue') {
      summary.total_due += amount;
      summary.overdue_count++;
    } else if (v.status === 'pending') {
      summary.total_due += amount;
      summary.pending_count++;
    }

    return {
      id: v.id,
      title: v.title,
      amount,
      due_date: v.due_date,
      status: v.status,
      paid_date: v.paid_at,
      fine: v.fine_amount,
      discount: v.discount_amount
    };
  });

  return {
    summary,
    vouchers: voucherList
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get assignments for a child
 */
const getChildAssignments = async (childId, instituteId, filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const child = await User.findByPk(childId);

  const where = {
    institute_id: instituteId,
    is_published: true,
    [Op.or]: [
      { target_type: 'class', target_ids: { [Op.contains]: [child.details?.class_id] } },
      { target_type: 'all' }
    ]
  };

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
        attributes: ['id', 'first_name', 'last_name']
      }
    ]
  });

  // Get submissions
  const submissions = await AssignmentSubmission.findAll({
    where: {
      student_id: childId,
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
      status,
      submission: submission ? {
        submitted_at: submission.submitted_at,
        marks: submission.marks,
        feedback: submission.feedback
      } : null
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
 * Get upcoming assignments for a child (dashboard)
 */
const getChildUpcomingAssignments = async (childId, instituteId, limit = 3) => {
  const child = await User.findByPk(childId);
  const today = new Date();

  const assignments = await Assignment.findAll({
    where: {
      institute_id: instituteId,
      is_published: true,
      due_date: { [Op.gte]: today },
      [Op.or]: [
        { target_type: 'class', target_ids: { [Op.contains]: [child.details?.class_id] } },
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

  // Check which are already submitted
  const submissions = await AssignmentSubmission.findAll({
    where: {
      student_id: childId,
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

// ─────────────────────────────────────────────────────────────────────────────
// CHILD TIMETABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get child's weekly timetable
 */
const getChildTimetable = async (childId, instituteId) => {
  const child = await User.findByPk(childId);

  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true,
      'entity_ids.class_id': child.details?.class_id
    }
  });

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const schedule = {};

  days.forEach(day => { schedule[day] = []; });

  timetables.forEach(timetable => {
    (timetable.slots || []).forEach(slot => {
      if (days.includes(slot.day) && !slot.is_break) {
        schedule[slot.day].push({
          time: `${slot.start_time} - ${slot.end_time}`,
          subject: slot.subject_name,
          teacher: slot.teacher_name,
          room: slot.room_no
        });
      }
    });
  });

  // Sort by time
  Object.keys(schedule).forEach(day => {
    schedule[day].sort((a, b) => a.start_time?.localeCompare(b.start_time || ''));
  });

  return schedule;
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get notices for parent
 */
export const getParentNotices = async (instituteId, limit = 10) => {
  const notices = await Notice.findAll({
    where: {
      institute_id: instituteId,
      is_published: true,
      target_audience: { [Op.overlap]: ['parent', 'all'] }
    },
    order: [['created_at', 'DESC']],
    limit
  });

  return notices.map(n => ({
    id: n.id,
    title: n.title,
    content: n.content,
    priority: n.priority,
    date: format(new Date(n.created_at), 'dd MMM yyyy'),
    attachments: n.attachments
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// FEE PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pay fee for a child
 */
export const payChildFee = async (voucherId, parentId, instituteId, paymentData) => {
  const transaction = await sequelize.transaction();

  try {
    const voucher = await FeeVoucher.findOne({
      where: { id: voucherId, school_id: instituteId },
      include: [
        { model: User, as: 'student', attributes: ['id', 'first_name', 'last_name', 'details'] }
      ]
    });

    if (!voucher) throw new Error('Voucher not found');

    // Verify parent owns this child
    const parent = await User.findByPk(parentId);
    const childrenIds = parent.details?.children_ids || [];
    
    if (!childrenIds.includes(voucher.student_id)) {
      throw new Error('You are not authorized to pay for this student');
    }

    if (voucher.status === 'paid') {
      throw new Error('This voucher is already paid');
    }

    // Update voucher
    voucher.status = 'paid';
    voucher.paid_at = new Date();
    voucher.payment_method = paymentData.payment_method;
    voucher.payment_reference = paymentData.payment_reference;
    voucher.paid_by = parentId;
    
    await voucher.save({ transaction });

    await transaction.commit();

    return {
      id: voucher.id,
      title: voucher.title,
      amount: voucher.net_amount,
      paid_at: voucher.paid_at,
      message: 'Payment successful'
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Get payment history for all children
 */
export const getPaymentHistory = async (parentId, instituteId, filters = {}) => {
  const parent = await User.findByPk(parentId);
  const childrenIds = parent.details?.children_ids || [];

  const where = {
    school_id: instituteId,
    student_id: { [Op.in]: childrenIds },
    status: 'paid'
  };

  if (filters.from_date) {
    where.paid_at = { [Op.gte]: new Date(filters.from_date) };
  }
  if (filters.to_date) {
    where.paid_at = { ...where.paid_at, [Op.lte]: new Date(filters.to_date) };
  }

  const vouchers = await FeeVoucher.findAll({
    where,
    order: [['paid_at', 'DESC']],
    include: [
      { model: User, as: 'student', attributes: ['id', 'first_name', 'last_name'] }
    ],
    limit: filters.limit || 50
  });

  return vouchers.map(v => ({
    id: v.id,
    title: v.title,
    amount: v.net_amount,
    paid_at: v.paid_at,
    student: v.student ? `${v.student.first_name} ${v.student.last_name}` : 'Unknown',
    payment_method: v.payment_method,
    reference: v.payment_reference
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get teachers for parent's children
 */
export const getChildrenTeachers = async (parentId, instituteId) => {
  const parent = await User.findByPk(parentId);
  const childrenIds = parent.details?.children_ids || [];

  const children = await User.findAll({
    where: { id: { [Op.in]: childrenIds } },
    attributes: ['id', 'details']
  });

  const classIds = children.map(c => c.details?.class_id).filter(Boolean);

  // Get timetables for these classes to extract teachers
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true,
      'entity_ids.class_id': { [Op.in]: classIds }
    }
  });

  const teacherIds = new Set();
  const teacherMap = {};

  timetables.forEach(t => {
    (t.slots || []).forEach(slot => {
      if (slot.teacher_id && slot.teacher_name) {
        teacherIds.add(slot.teacher_id);
        teacherMap[slot.teacher_id] = {
          id: slot.teacher_id,
          name: slot.teacher_name,
          subject: slot.subject_name,
          class: getEntityName(t.entity_ids)
        };
      }
    });
  });

  return Object.values(teacherMap);
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate parent dashboard stats
 */
const calculateParentStats = (children) => {
  let totalChildren = children.length;
  let totalFeeDue = 0;
  let childrenWithLowAttendance = 0;
  let childrenWithPendingAssignments = 0;

  children.forEach(child => {
    totalFeeDue += child.fee_status?.total_due || 0;
    
    if (child.attendance?.percentage < 75) {
      childrenWithLowAttendance++;
    }
    
    if (child.upcoming_assignments?.length > 0) {
      childrenWithPendingAssignments++;
    }
  });

  return {
    total_children: totalChildren,
    total_fee_due: totalFeeDue,
    has_fee_due: totalFeeDue > 0,
    children_with_low_attendance: childrenWithLowAttendance,
    children_with_pending_assignments: childrenWithPendingAssignments
  };
};

/**
 * Get alerts for a child
 */
const getChildAlerts = (child, data) => {
  const alerts = [];

  if (data.attendance?.percentage < 75) {
    alerts.push({
      type: 'attendance',
      message: 'Attendance is below 75%',
      severity: 'warning'
    });
  }

  if (data.fee_status?.has_due) {
    alerts.push({
      type: 'fee',
      message: `Fee due of Rs. ${data.fee_status.total_due}`,
      severity: 'high'
    });
  }

  if (data.upcoming_assignments?.length > 0) {
    alerts.push({
      type: 'assignment',
      message: `${data.upcoming_assignments.length} pending assignments`,
      severity: 'info'
    });
  }

  return alerts;
};

const getEntityName = (entityIds) => {
  if (!entityIds) return 'Unknown';
  if (entityIds.class_name) return entityIds.class_name;
  if (entityIds.course_name) return entityIds.course_name;
  return 'Class';
};

export default {
  // Dashboard
  getParentDashboard,
  
  // Profile
  getParentProfile,
  updateParentProfile,
  
  // Children
  getMyChildren,
  getChildDetails,
  
  // Child specific data
  getChildFullAttendance,
  getChildFullResults,
  getChildFullFees,
  getChildAssignments,
  getChildTimetable,
  
  // Fee payment
  payChildFee,
  getPaymentHistory,
  
  // Communication
  getChildrenTeachers,
  
  // Notices
  getParentNotices
};