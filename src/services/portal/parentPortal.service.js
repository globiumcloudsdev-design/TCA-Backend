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
import logger from '../../config/logger.js';
import { assertParentOwnsChild, getParentChildIds } from './parentOwnership.js';
import { countAttendance, attendancePercentage, emptyCounts } from '../../utils/helpers/attendance.helper.js';
import { getStudentAcademicInfo } from '../../utils/helpers/student.helper.js';
import { fetchNotices } from './notices.helper.js';
import { AppError } from '../../utils/lib/AppError.js';
import { createPaymentRequest } from '../feeVoucher.service.js';
import { pktParts } from '../../utils/helpers/date.helper.js';

const ymd = (d) => format(d, 'yyyy-MM-dd');
/** fee_breakdown holds pending payment requests under _payment_requests; keep them out of the fee items */
const splitBreakdown = (fb) => {
  let breakdown = fb;
  if (typeof breakdown === 'string') { try { breakdown = JSON.parse(breakdown); } catch (e) { breakdown = {}; } }
  if (!breakdown || typeof breakdown !== 'object') return { breakdown: {}, requests: [] };
  const { _payment_requests, ...rest } = breakdown;
  return { breakdown: rest, requests: Array.isArray(_payment_requests) ? _payment_requests : [] };
};

// Single ownership check used by every :childId parent endpoint (B8)
export { assertParentOwnsChild };


const {
  User,
  Timetable,
  Assignment,
  AssignmentSubmission,
  StudentAttendance: Attendance,
  FeeVoucher,
  FeePayment,
  ExamResult,
  Exam,
  Class,
  Notification,
  sequelize
} = models;

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get complete parent dashboard with all children's data
 */
export const getParentDashboard = async (parentId, instituteId) => {
  try {
    const [parent, children] = await Promise.all([
      getParentProfile(parentId, instituteId),
      getMyChildren(parentId, instituteId)
    ]);

    // Get dashboard data for each child
    const childrenWithData = await Promise.all(
      children.map(async (child) => {
        const [attendance, upcomingAssignments, recentResults, feeStatus] = await Promise.all([
          getChildAttendanceSummary(child.id, instituteId).catch(err => {
            logger.error(`Error fetching attendance for child ${child.id}:`, err);
            return { percentage: 0, monthly_history: [] };
          }),
          getChildUpcomingAssignments(child.id, instituteId, 3).catch(err => {
            logger.error(`Error fetching assignments for child ${child.id}:`, err);
            return [];
          }),
          getChildRecentResults(child.id, instituteId, 2).catch(err => {
            logger.error(`Error fetching results for child ${child.id}:`, err);
            return [];
          }),
          getChildFeeSummary(child.id, instituteId).catch(err => {
            logger.error(`Error fetching fees for child ${child.id}:`, err);
            return { has_due: false, total_due: 0 };
          })
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

    // Get recent notices for parent (with error handling)
    const notices = await getParentNotices(parentId, instituteId, 5).catch(err => {
      logger.error('Error fetching notices:', err);
      return [];
    });

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
  } catch (error) {
    logger.error('Error fetching parent dashboard:', error);
    throw error;
  }
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

  // Get children count from multiple possible field names (stored in details.parentDetails.student_ids)
  const childrenIds =
    parent.details?.parentDetails?.student_ids ||
    parent.student_ids ||
    parent.details?.student_ids ||
    parent.details?.children_ids ||
    [];
  const childrenCount = Array.isArray(childrenIds) ? childrenIds.length : 0;

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
    relation: parent.details?.relation,   // Add this
    address: parent.details?.address,
    city: parent.details?.city,

    // Children count
    children_count: childrenCount,

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
        await deleteFromCloudinary(parent.avatar_public_id).catch(() => { });
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
    const allowedDetails = ['occupation', 'cnic', 'address', 'city', 'relation'];
    const currentDetails = { ...(parent.details || {}) };

    allowedDetails.forEach(field => {
      if (updateData.details[field] !== undefined) {
        currentDetails[field] = updateData.details[field];
      }
    });

    parent.details = currentDetails;
    parent.changed('details', true);
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
  const parent = await User.findByPk(parentId, {
    // Explicitly include all fields to ensure student_ids is fetched
    attributes: { exclude: ['password_hash', 'password_reset_token'] }
  });

  if (!parent) {
    logger.warn(`Parent not found: ${parentId}`);
    return [];
  }

  // Log parent data for debugging
  logger.debug('Parent object type:', parent.constructor.name);
  logger.debug('Parent details structure:', JSON.stringify(parent.details, null, 2));
  logger.debug('Parent details.parentDetails:', parent.details?.parentDetails);
  logger.debug('Parent details.parentDetails.student_ids:', parent.details?.parentDetails?.student_ids);

  // Check for children IDs - student_ids are stored in details.parentDetails.student_ids
  let childrenIds = getParentChildIds(parent);

  // Ensure it's an array
  if (!Array.isArray(childrenIds)) {
    logger.warn(`Children IDs is not an array for parent ${parentId}, type: ${typeof childrenIds}, value: ${JSON.stringify(childrenIds)}`);
    childrenIds = [];
  }

  if (childrenIds.length === 0) {
    logger.info(`No children found for parent ${parentId}`);
    return [];
  }

  logger.info(`Fetching ${childrenIds.length} children for parent ${parentId}: ${JSON.stringify(childrenIds)}`);

  const children = await User.findAll({
    where: {
      id: { [Op.in]: childrenIds },
      school_id: instituteId,
      user_type: 'STUDENT',
      is_active: true
    },
    attributes: ['id', 'first_name', 'last_name', 'registration_no', 'avatar_url', 'details']
  });

  logger.info(`Found ${children.length} children for parent ${parentId} (requested ${childrenIds.length})`);

  return children.map(child => {
    const studentDetails = child.details?.studentDetails || {};
    const activeSession = studentDetails.academicSessions?.find(s => s.status === 'active');

    return {
      // Basic Info
      id: child.id,
      first_name: child.first_name,
      last_name: child.last_name,
      name: `${child.first_name} ${child.last_name}`,
      email: child.email,
      phone: child.phone,
      registration_no: child.registration_no,
      avatar: child.avatar_url,

      // Academic Info
      class: studentDetails.class_name || activeSession?.class_name,
      section: studentDetails.section_name || activeSession?.section_name,
      roll_number: activeSession?.roll_no || studentDetails.roll_no,
      class_id: studentDetails.class_id || activeSession?.class_id,
      section_id: studentDetails.section_id || activeSession?.section_id,
      academic_year_id: studentDetails.academic_year_id || activeSession?.academic_year_id,
      admission_date: studentDetails.admission_date,

      // Personal Info
      date_of_birth: studentDetails.date_of_birth,
      gender: studentDetails.gender,
      blood_group: studentDetails.blood_group,
      religion: studentDetails.religion,
      nationality: studentDetails.nationality,
      cnic: studentDetails.cnic,

      // Parent/Guardian Info
      father_name: studentDetails.father_name,
      father_cnic: studentDetails.father_cnic,
      father_phone: studentDetails.father_phone,
      father_occupation: studentDetails.father_occupation,
      father_education: studentDetails.father_education,
      mother_name: studentDetails.mother_name,
      mother_cnic: studentDetails.mother_cnic,
      mother_phone: studentDetails.mother_phone,
      mother_occupation: studentDetails.mother_occupation,
      guardians: studentDetails.guardians || [],

      // Contact Info
      present_address: studentDetails.present_address,
      permanent_address: studentDetails.permanent_address,
      city: studentDetails.city,

      // Fee Info
      fee_plan_id: studentDetails.fee_plan_id,
      monthly_fee: studentDetails.monthly_fee,
      admission_fee: studentDetails.admission_fee,
      annual_charges: studentDetails.annual_acharges,
      lab_charges: studentDetails.lab_charges,
      discount_type: studentDetails.discount_type,
      concession_type: studentDetails.concession_type,
      concession_percentage: studentDetails.concession_percentage,
      concession_reason: studentDetails.concession_reason,

      // Medical Info
      medical_conditions: studentDetails.medical_conditions,
      allergies: studentDetails.allergies,

      // Previous School
      previous_school: studentDetails.previous_school,
      previous_class: studentDetails.previous_class,

      // Status
      status: studentDetails.status,

      // Academic Sessions
      academic_sessions: studentDetails.academicSessions || []
    };
  });
};

/**
 * Get specific child details
 */
export const getChildDetails = async (childId, parentId, instituteId) => {
  await assertParentOwnsChild(parentId, childId, instituteId);

  const child = await User.findOne({
    where: { id: childId, school_id: instituteId, user_type: 'STUDENT' },
    attributes: ['id', 'first_name', 'last_name', 'registration_no', 'avatar_url', 'details']
  });

  if (!child) throw new AppError('Child not found', 404);

  const academic = getStudentAcademicInfo(child);

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
      class: academic.class_name,
      section: academic.section_name,
      roll_number: academic.roll_no,
      date_of_birth: child.details?.studentDetails?.date_of_birth || child.details?.date_of_birth,
      blood_group: child.details?.studentDetails?.blood_group || child.details?.blood_group
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
 * Get full attendance with filters for a child
 */
export const getChildFullAttendance = async (childId, instituteId, filters = {}) => {
  const {
    month,
    year,
    subject_id,
    from_date,
    to_date,
    include_monthly_breakdown = true
  } = filters;

  // Build where clause
  const where = {
    school_id: instituteId,
    student_id: childId
  };

  // Date filtering (DATEONLY column -> compare as yyyy-MM-dd strings; default = current month in PKT)
  if (from_date && to_date) {
    where.date = { [Op.between]: [String(from_date).slice(0, 10), String(to_date).slice(0, 10)] };
  } else if (month && year) {
    where.date = { [Op.between]: [ymd(new Date(year, month - 1, 1)), ymd(new Date(year, month, 0))] };
  } else if (year) {
    where.date = { [Op.between]: [ymd(new Date(year, 0, 1)), ymd(new Date(year, 11, 31))] };
  } else {
    const { year: py, month: pm } = pktParts();
    where.date = { [Op.between]: [ymd(new Date(py, pm - 1, 1)), ymd(new Date(py, pm, 0))] };
  }

  const attendance = await Attendance.findAll({
    where,
    order: [['date', 'DESC']]
  });

  // Get child details for class/section info
  const child = await User.findByPk(childId);

  // Overall summary
  const total = attendance.length;
  const present = attendance.filter(a => a.status === 'present').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const late = attendance.filter(a => a.status === 'late').length;
  const halfDay = attendance.filter(a => a.status === 'half_day').length;
  const holiday = attendance.filter(a => a.status === 'holiday').length;
  const leave = attendance.filter(a => a.status === 'leave').length;

  // Since StudentAttendance tracks attendance by day and not by subject,
  // we do not return subjectStats here.
  const subjectStats = [];

  // Get child's class and section from student details
  const childClassNameTemp = child?.details?.studentDetails?.class_name || child?.details?.class_name;
  const childSectionNameTemp = child?.details?.studentDetails?.section_name || child?.details?.section_name;
  const childClassIdTemp = child?.details?.studentDetails?.class_id || child?.details?.class_id;
  const childSectionIdTemp = child?.details?.studentDetails?.section_id || child?.details?.section_id;

  // Class-wise breakdown (with section info)
  const classWise = {};
  attendance.forEach(a => {
    // Use child's class/section as key
    const classKey = `${childClassNameTemp} - ${childSectionNameTemp}`;
    if (!classWise[classKey]) {
      classWise[classKey] = {
        class_name: childClassNameTemp,
        section_name: childSectionNameTemp,
        class_id: childClassIdTemp,
        section_id: childSectionIdTemp,
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        half_day: 0
      };
    }
    classWise[classKey].total++;
    classWise[classKey][a.status] = (classWise[classKey][a.status] || 0) + 1;
  });

  const classStats = Object.entries(classWise).map(([key, stats]) => ({
    class: stats.class_name,
    section: stats.section_name,
    class_id: stats.class_id,
    section_id: stats.section_id,
    total: stats.total,
    present: stats.present,
    absent: stats.absent,
    late: stats.late,
    half_day: stats.half_day,
    percentage: attendancePercentage(stats)
  }));

  // Monthly breakdown
  let monthly = [];
  if (include_monthly_breakdown) {
    const monthlyStats = {};
    attendance.forEach(a => {
      const monthKey = format(new Date(a.date), 'yyyy-MM');
      const monthName = format(new Date(a.date), 'MMMM yyyy');
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          month: monthName,
          month_key: monthKey,
          total: 0,
          ...emptyCounts()
        };
      }
      monthlyStats[monthKey].total++;
      monthlyStats[monthKey][a.status] = (monthlyStats[monthKey][a.status] || 0) + 1;
    });

    monthly = Object.values(monthlyStats).map(stat => ({
      ...stat,
      percentage: attendancePercentage(stat)
    })).sort((a, b) => b.month_key.localeCompare(a.month_key));
  }

  // Get child's class and section from active academic session
  const activeSession = child.details?.studentDetails?.academicSessions?.find(s => s.status === 'active');
  const childClassId = activeSession?.class_id || child.details?.studentDetails?.class_id;
  const childSectionId = activeSession?.section_id || child.details?.studentDetails?.section_id;
  const childClassName = activeSession?.class_name || child.details?.studentDetails?.class_name;
  const activeRollNo = activeSession?.roll_no || child.details?.studentDetails?.roll_no;

  // Helper: Get day name from date
  const getDayNameForDate = (dateStr) => {
    return format(new Date(dateStr), 'EEEE');
  };

  // Daily records with class details
  const dailyRecords = attendance.slice(0, 90).map(a => ({
    date: format(new Date(a.date), 'yyyy-MM-dd'),
    date_formatted: format(new Date(a.date), 'dd MMM yyyy'),
    day: format(new Date(a.date), 'EEEE'),
    status: a.status,
    class_id: childClassId,
    class_name: childClassName,
    check_in_time: a.check_in_time || undefined,
    check_out_time: a.check_out_time || undefined,
    remarks: a.remarks
  }));

  return {
    child: {
      id: child.id,
      name: `${child.first_name} ${child.last_name}`,
      registration_no: child.registration_no,
      class: child.details?.studentDetails?.class_name,
      section: child.details?.studentDetails?.section_name,
      class_id: child.details?.studentDetails?.class_id,
      section_id: child.details?.studentDetails?.section_id,
      roll_number: activeRollNo
    },
    summary: {
      total_days: total,
      present,
      absent,
      late,
      half_day: halfDay,
      holiday,
      leave,
      percentage: attendancePercentage({ present, late, half_day: halfDay, absent }),
      perfect_days: attendance.filter(a => a.status === 'present' && !a.late_arrival).length
    },
    subject_wise: subjectStats,
    class_wise: classStats,
    monthly_history: monthly,
    recent_records: dailyRecords.slice(0, 10),
    all_records: dailyRecords,
    filters_applied: {
      month,
      year,
      subject_id,
      from_date,
      to_date
    }
  };
};

/**
 * Get attendance summary for dashboard (lightweight version)
 */
const getChildAttendanceSummary = async (childId, instituteId, month = null, year = null) => {
  let startDate, endDate;

  if (month !== null && year !== null) {
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 0);
  } else {
    const { year: py, month: pm } = pktParts();
    startDate = new Date(py, pm - 1, 1);
    endDate = new Date(py, pm, 0);
  }

  const attendance = await Attendance.findAll({
    where: {
      school_id: instituteId,
      student_id: childId,
      date: { [Op.between]: [ymd(startDate), ymd(endDate)] }
    },
    order: [['date', 'DESC']]
  });

  const total = attendance.length;
  const present = attendance.filter(a => a.status === 'present').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const late = attendance.filter(a => a.status === 'late').length;
  const halfDay = attendance.filter(a => a.status === 'half_day').length;
  const leave = attendance.filter(a => a.status === 'leave').length;

  // Subject-wise breakdown
  const subjectWise = {};
  attendance.forEach(a => {
    const subjectName = a.subject_name || 'General';
    if (!subjectWise[subjectName]) {
      subjectWise[subjectName] = { total: 0, present: 0 };
    }
    subjectWise[subjectName].total++;
    if (a.status === 'present' || a.status === 'late') subjectWise[subjectName].present++;
  });

  const subjectStats = Object.entries(subjectWise).map(([subject, stats]) => ({
    subject,
    percentage: stats.total ? Math.round((stats.present / stats.total) * 100) : 0
  }));

  return {
    month: format(startDate, 'MMMM yyyy'),
    total_days: total,
    present,
    absent,
    late,
    half_day: halfDay,
    leave,
    percentage: attendancePercentage({ present, late, half_day: halfDay, absent }),
    subject_wise: subjectStats,
    recent: attendance.slice(0, 5).map(a => ({
      date: format(new Date(a.date), 'dd MMM'),
      status: a.status,
      subject: a.subject_name
    }))
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD RESULTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get exam schedule (upcoming and ongoing exams) for a child
 */
export const getChildExamSchedule = async (childId, instituteId) => {
  const child = await User.findByPk(childId, {
    attributes: ['id', 'details']
  });

  if (!child) throw new Error('Child not found');

  // Extract class_id and section_id from studentDetails (nested in details object)
  const childClass = child.details?.studentDetails?.class_id || child.details?.class_id;
  const childSection = child.details?.studentDetails?.section_id || child.details?.section_id;

  if (!childClass) {
    logger.warn(`No class found for child ${childId}`);
    return [];
  }

  try {
    // Get exams for child's class/section
    const exams = await Exam.findAll({
      where: {
        school_id: instituteId,
        status: { [Op.in]: ['draft', 'scheduled', 'ongoing'] },
        [Op.or]: [
          { class_id: childClass },
          {
            [Op.and]: [
              { class_id: childClass },
              { [Op.or]: [{ section_id: childSection }, { section_id: null }] }
            ]
          }
        ]
      },
      attributes: ['id', 'name', 'type', 'start_date', 'end_date', 'status', 'total_marks', 'subject_schedules'],
      order: [['start_date', 'ASC']],
      raw: true
    });

    return exams.map(exam => {
      let subject_schedules = exam.subject_schedules;
      if (typeof subject_schedules === 'string') {
        try {
          subject_schedules = JSON.parse(subject_schedules);
        } catch (e) {
          subject_schedules = [];
        }
      }
      subject_schedules = subject_schedules || [];

      return {
        exam_id: exam.id,
        exam_name: exam.name,
        exam_type: exam.type,
        status: exam.status,
        start_date: exam.start_date,
        end_date: exam.end_date,
        total_marks: exam.total_marks,
        subjects_count: subject_schedules.length,
        subjects: subject_schedules.map(s => ({
          subject_name: s.subject_name,
          total_marks: s.total_marks || exam.total_marks,
          scheduled_date: s.date,
          scheduled_time: s.start_time
        }))
      };
    });
  } catch (error) {
    logger.error('Error fetching exam schedule:', error);
    return [];
  }
};

/**
 * Get full results for a child with filters
 */
export const getChildFullResults = async (childId, instituteId, filters = {}) => {
  const {
    exam_type,
    from_date,
    to_date,
    academic_year,
    include_subject_details = true
  } = filters;

  // Get child details
  const child = await User.findByPk(childId);

  if (!child) throw new Error('Child not found');

  // Build where clause for results
  const where = {
    student_id: childId
  };

  // Get exam results
  const results = await ExamResult.findAll({
    where,
    order: [['created_at', 'DESC']],
    include: [
      {
        model: Exam,
        as: 'exam',
        attributes: ['id', 'name', 'type', 'start_date', 'end_date', 'total_marks', 'pass_marks', 'pass_percentage', 'academic_year_id'],
        where: { school_id: instituteId, [Op.or]: [{ status: 'results_published' }, { is_published: true }] },
        required: true
      }
    ]
  });

  // Filter by exam type
  let filteredResults = results;
  if (exam_type) {
    filteredResults = filteredResults.filter(r => r.exam?.type === exam_type);
  }
  if (from_date) {
    filteredResults = filteredResults.filter(r => new Date(r.exam?.start_date) >= new Date(from_date));
  }
  if (to_date) {
    filteredResults = filteredResults.filter(r => new Date(r.exam?.start_date) <= new Date(to_date));
  }
  if (academic_year) {
    filteredResults = filteredResults.filter(r => r.exam?.academic_year === academic_year);
  }

  // Process each result
  const processedResults = filteredResults.map(result => {
    // Parse subject marks
    let subjectMarks = result.subject_marks;
    if (typeof subjectMarks === 'string') {
      try {
        subjectMarks = JSON.parse(subjectMarks);
      } catch (e) {
        subjectMarks = [];
      }
    }
    subjectMarks = Array.isArray(subjectMarks) ? subjectMarks : [];

    // Calculate statistics
    let totalObtained = 0;
    let totalFull = 0;
    let highestScore = 0;
    let lowestScore = Infinity;
    let subjectsWithDetails = [];

    subjectMarks.forEach(sm => {
      const obtained = Number(sm.marks_obtained) || 0;
      const total = Number(sm.total_marks) || 0;
      const percentage = total > 0 ? (obtained / total) * 100 : 0;

      totalObtained += obtained;
      totalFull += total;
      if (obtained > highestScore) highestScore = obtained;
      if (obtained < lowestScore) lowestScore = obtained;

      subjectsWithDetails.push({
        subject_id: sm.subject_id,
        subject_name: sm.subject_name || sm.subject,
        marks_obtained: obtained,
        total_marks: total,
        percentage: Math.round(percentage),
        grade: sm.grade || calculateGrade(percentage),
        remarks: sm.remarks || null,
        status: percentage >= 40 ? 'pass' : 'fail'
      });
    });

    const overallPercentage = totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;
    const overallGrade = calculateGrade(overallPercentage);
    const passedSubjects = subjectsWithDetails.filter(s => s.status === 'pass').length;
    const failedSubjects = subjectsWithDetails.filter(s => s.status === 'fail').length;

    return {
      id: result.id,
      exam_id: result.exam_id,
      exam_name: result.exam?.name,
      exam_type: result.exam?.type,
      exam_date: result.exam?.start_date,
      academic_year: result.exam?.academic_year,
      total_marks: totalFull,
      obtained_marks: totalObtained,
      percentage: Math.round(overallPercentage),
      grade: overallGrade,
      rank: result.rank || null,
      total_students: result.total_students || null,
      position: result.position || null,
      passed_subjects: passedSubjects,
      failed_subjects: failedSubjects,
      highest_subject_score: highestScore,
      lowest_subject_score: lowestScore === Infinity ? 0 : lowestScore,
      subjects: subjectsWithDetails,
      remarks: result.remarks || result.teacher_remarks,
      teacher_feedback: result.teacher_feedback,
      certificate_url: result.certificate_url,
      created_at: result.created_at
    };
  });

  // Calculate overall statistics across all exams
  const statistics = {
    total_exams: processedResults.length,
    average_percentage: processedResults.length > 0
      ? Math.round(processedResults.reduce((sum, r) => sum + r.percentage, 0) / processedResults.length)
      : 0,
    best_performance: processedResults.length > 0
      ? processedResults.reduce((best, r) => r.percentage > best.percentage ? r : best, processedResults[0])
      : null,
    subjects_performance: {},
    exam_type_breakdown: {}
  };

  // Calculate subject-wise performance across all exams
  processedResults.forEach(result => {
    result.subjects.forEach(subject => {
      if (!statistics.subjects_performance[subject.subject_name]) {
        statistics.subjects_performance[subject.subject_name] = {
          total_marks: 0,
          obtained_marks: 0,
          exam_count: 0,
          best_score: 0,
          average_percentage: 0
        };
      }
      const perf = statistics.subjects_performance[subject.subject_name];
      perf.total_marks += subject.total_marks;
      perf.obtained_marks += subject.marks_obtained;
      perf.exam_count++;
      if (subject.percentage > perf.best_score) perf.best_score = subject.percentage;
      perf.average_percentage = (perf.obtained_marks / perf.total_marks) * 100;
    });
  });

  // Calculate exam type breakdown
  processedResults.forEach(result => {
    if (!statistics.exam_type_breakdown[result.exam_type]) {
      statistics.exam_type_breakdown[result.exam_type] = {
        count: 0,
        total_percentage: 0,
        exams: []
      };
    }
    const breakdown = statistics.exam_type_breakdown[result.exam_type];
    breakdown.count++;
    breakdown.total_percentage += result.percentage;
    breakdown.exams.push({
      name: result.exam_name,
      percentage: result.percentage,
      grade: result.grade
    });
  });

  // Calculate average for each exam type
  Object.keys(statistics.exam_type_breakdown).forEach(type => {
    statistics.exam_type_breakdown[type].average_percentage =
      Math.round(statistics.exam_type_breakdown[type].total_percentage / statistics.exam_type_breakdown[type].count);
  });

  // Get upcoming exams
  const upcomingExams = await getUpcomingExams(childId, instituteId);

  // Get active academic session roll_no
  const activeSession = child.details?.studentDetails?.academicSessions?.find(s => s.status === 'active');
  const activeRollNo = activeSession?.roll_no || child.details?.studentDetails?.roll_no;

  return {
    child: {
      id: child.id,
      name: `${child.first_name} ${child.last_name}`,
      registration_no: child.registration_no,
      class: child.details?.studentDetails?.class_name,
      section: child.details?.studentDetails?.section_name,
      class_id: child.details?.studentDetails?.class_id,
      section_id: child.details?.studentDetails?.section_id,
      roll_number: activeRollNo
    },
    statistics,
    results: processedResults,
    upcoming_exams: upcomingExams,
    filters_applied: {
      exam_type,
      from_date,
      to_date,
      academic_year
    }
  };
};

/**
 * Get upcoming exams for a child
 */
const getUpcomingExams = async (childId, instituteId) => {
  const child = await User.findByPk(childId);

  if (!child) return [];

  const childClass = child.details?.studentDetails?.class_id;
  const childSection = child.details?.studentDetails?.section_id;

  // If child doesn't have a class assigned, return empty
  if (!childClass) return [];

  const today = new Date();

  const exams = await Exam.findAll({
    where: {
      school_id: instituteId,
      start_date: { [Op.gte]: today },
      status: { [Op.in]: ['scheduled', 'ongoing'] },
      class_id: childClass,
      [Op.or]: [
        { section_id: childSection },
        { section_id: null }
      ]
    },
    order: [['start_date', 'ASC']],
    limit: 5
  });

  return exams.map(exam => {
    let subjectSchedules = exam.subject_schedules;
    if (typeof subjectSchedules === 'string') {
      try {
        subjectSchedules = JSON.parse(subjectSchedules);
      } catch (e) {
        subjectSchedules = [];
      }
    }

    return {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      start_date: exam.start_date,
      end_date: exam.end_date,
      total_marks: exam.total_marks,
      subjects_count: subjectSchedules.length,
      subjects: subjectSchedules.map(s => ({
        name: s.subject_name,
        date: s.date,
      }))
    };
  });
};

/**
 * Get single exam result details
 */
export const getExamResultDetails = async (resultId, parentId, instituteId) => {
  const result = await ExamResult.findOne({
    where: { id: resultId },
    include: [
      {
        model: Exam,
        as: 'exam',
        attributes: ['id', 'name', 'type', 'start_date', 'end_date', 'total_marks', 'pass_marks', 'pass_percentage', 'academic_year_id', 'description', 'status', 'is_published']
      },
      {
        model: User,
        as: 'student',
        attributes: ['id', 'first_name', 'last_name', 'registration_no', 'details']
      }
    ]
  });

  if (!result) throw new AppError('Result not found', 404);

  // Parent must own the child, and the result's exam must be published
  await assertParentOwnsChild(parentId, result.student_id, instituteId);
  if (!(result.exam?.status === 'results_published' || result.exam?.is_published)) {
    throw new AppError('Result not found', 404);
  }

  // Parse subject marks
  let subjectMarks = result.subject_marks;
  if (typeof subjectMarks === 'string') {
    try {
      subjectMarks = JSON.parse(subjectMarks);
    } catch (e) {
      subjectMarks = [];
    }
  }

  // Get class average for comparison
  const classResults = await ExamResult.findAll({
    where: {
      exam_id: result.exam_id,
      student_id: { [Op.ne]: result.student_id }
    },
    attributes: ['percentage']
  });

  const classAverage = classResults.length > 0
    ? classResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / classResults.length
    : 0;

  return {
    id: result.id,
    exam: result.exam,
    student: {
      id: result.student.id,
      name: `${result.student.first_name} ${result.student.last_name}`,
      registration_no: result.student.registration_no,
      class: result.student.details?.class_name,
      section: result.student.details?.section_name
    },
    total_marks: result.total_marks,
    obtained_marks: result.obtained_marks,
    percentage: result.percentage,
    grade: result.grade,
    rank: result.rank,
    total_students: result.total_students,
    position: result.position,
    subjects: subjectMarks.map(sm => ({
      subject_name: sm.subject_name || sm.subject,
      marks_obtained: sm.marks_obtained,
      total_marks: sm.total_marks,
      percentage: (sm.marks_obtained / sm.total_marks) * 100,
      grade: sm.grade,
      remarks: sm.remarks
    })),
    class_average: classAverage,
    performance_compared_to_class: result.percentage - classAverage,
    remarks: result.remarks,
    teacher_feedback: result.teacher_feedback,
    certificate_url: result.certificate_url
  };
};

/**
 * Get result summary for dashboard
 */
export const getChildRecentResults = async (childId, instituteId, limit = 2) => {
  const results = await ExamResult.findAll({
    where: { student_id: childId },
    order: [['created_at', 'DESC']],
    limit: limit,
    include: [
      {
        model: Exam,
        as: 'exam',
        attributes: ['id', 'name', 'type', 'start_date'],
        where: { school_id: instituteId, [Op.or]: [{ status: 'results_published' }, { is_published: true }] },
        required: true
      }
    ]
  });

  return results.map(result => {
    let subjectMarks = result.subject_marks;
    if (typeof subjectMarks === 'string') {
      try {
        subjectMarks = JSON.parse(subjectMarks);
      } catch (e) {
        subjectMarks = [];
      }
    }

    const subjects = subjectMarks.slice(0, 3).map(sm => ({
      name: sm.subject_name || sm.subject,
      marks: sm.marks_obtained,
      total: sm.total_marks,
      grade: sm.grade
    }));

    return {
      exam_id: result.exam_id,
      exam_name: result.exam?.name,
      exam_type: result.exam?.type,
      date: result.exam?.start_date,
      percentage: result.percentage,
      grade: result.grade,
      rank: result.rank,
      subjects_count: subjectMarks.length,
      subjects: subjects
    };
  });
};

/**
 * Helper function to calculate grade
 */
const calculateGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
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
      institute_id: instituteId,
      student_id: childId,
      archived: false
    },
    order: [['due_date', 'ASC']]
  });

  const due = vouchers.filter(v => ['pending', 'overdue', 'partial'].includes(v.status));
  const paidRows = due.length
    ? await FeePayment.findAll({ where: { voucher_id: { [Op.in]: due.map(v => v.id) } }, attributes: ['voucher_id', 'amount_paid'] })
    : [];
  const paidMap = {};
  paidRows.forEach(p => { paidMap[p.voucher_id] = (paidMap[p.voucher_id] || 0) + (parseFloat(p.amount_paid) || 0); });
  const totalDue = due.reduce((sum, v) => sum + Math.max((parseFloat(v.net_amount) || 0) - (paidMap[v.id] || 0), 0), 0);
  const nextDue = due[0];

  return {
    has_due: due.length > 0,
    due_count: due.length,
    total_due: totalDue,
    next_due_date: nextDue?.due_date,
    next_due_amount: nextDue?.net_amount ? parseFloat(nextDue.net_amount) : null,
    next_due_voucher: nextDue ? {
      id: nextDue.id,
      voucher_number: nextDue.voucher_number || `VCH-${nextDue.id}`,
      month: nextDue.month,
      year: nextDue.year
    } : null
  };
};

/**
 * Get full fee details for a child with vouchers
 */
export const getChildFullFees = async (childId, instituteId, filters = {}) => {
  const {
    status,
    from_date,
    to_date,
    year,
    include_paid = true,
    include_pending = true,
    include_overdue = true
  } = filters;

  // Build where clause
  const where = {
    institute_id: instituteId,
    student_id: childId,
    archived: false // carried-forward / deleted vouchers must not be counted twice
  };

  // Status filtering
  if (status) {
    where.status = status;
  } else {
    const statusConditions = [];
    if (include_paid) statusConditions.push('paid');
    if (include_pending) statusConditions.push('pending');
    if (include_pending) statusConditions.push('partial');
    if (include_overdue) statusConditions.push('overdue');
    if (statusConditions.length > 0) {
      where.status = { [Op.in]: statusConditions };
    }
  }

  // Date filtering
  if (from_date && to_date) {
    where.due_date = { [Op.between]: [new Date(from_date), new Date(to_date)] };
  } else if (year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    where.due_date = { [Op.between]: [startDate, endDate] };
  }

  const vouchers = await FeeVoucher.findAll({
    where,
    order: [['due_date', 'DESC']],
    include: [
      {
        model: User,
        as: 'Student',
        attributes: ['id', 'first_name', 'last_name', 'registration_no', 'details']
      }
    ]
  });

  // Recorded payments per voucher (partial payments count towards paid)
  const payRows = vouchers.length
    ? await FeePayment.findAll({ where: { voucher_id: { [Op.in]: vouchers.map(v => v.id) } }, attributes: ['voucher_id', 'amount_paid'] })
    : [];
  const paidByVoucher = {};
  payRows.forEach(p => { paidByVoucher[p.voucher_id] = (paidByVoucher[p.voucher_id] || 0) + (parseFloat(p.amount_paid) || 0); });

  // Get child details
  const child = await User.findByPk(childId);

  // Calculate summaries
  let summary = {
    total_invoiced: 0,
    total_paid: 0,
    total_due: 0,
    total_discount: 0,
    total_fine: 0,
    paid_count: 0,
    pending_count: 0,
    overdue_count: 0,
    partial_count: 0
  };

  const voucherList = vouchers.map(v => {
    const amount = parseFloat(v.amount) || 0;
    const discount = parseFloat(v.discount) || 0;
    const fine = parseFloat(v.fine) || 0;
    const netAmount = parseFloat(v.net_amount) || (amount - discount + fine);

    // Update summary
    summary.total_invoiced += amount;
    summary.total_discount += discount;
    summary.total_fine += fine;

    // Legacy vouchers marked paid without payment rows count as fully paid
    const recorded = paidByVoucher[v.id] || 0;
    const paidAmount = v.status === 'paid' ? Math.max(recorded, netAmount) : Math.min(recorded, netAmount);
    const dueAmount = (v.status === 'paid' || v.status === 'cancelled') ? 0 : Math.max(netAmount - paidAmount, 0);
    summary.total_paid += paidAmount;
    summary.total_due += dueAmount;
    if (v.status === 'paid') summary.paid_count++;
    else if (v.status === 'overdue') summary.overdue_count++;
    else if (v.status === 'pending') summary.pending_count++;
    else if (v.status === 'partial') summary.partial_count++;
    const split = splitBreakdown(v.fee_breakdown);

    // Get active academic session for student
    const studentActiveSession = v.Student?.details?.studentDetails?.academicSessions?.find(s => s.status === 'active');
    const studentActiveRollNo = studentActiveSession?.roll_no || v.Student?.details?.studentDetails?.roll_no;

    return {
      id: v.id,
      voucher_number: v.voucher_number || `VCH-${v.id}`,
      month: v.month,
      year: v.year,
      amount: amount,
      discount: discount,
      fine: fine,
      net_amount: netAmount,
      paid_amount: Number(paidAmount.toFixed(2)),
      due_amount: Number(dueAmount.toFixed(2)),
      due_date: v.due_date,
      status: v.status,
      issued_date: v.issued_date,
      notes: v.notes,
      fee_breakdown: split.breakdown,
      payment_requests: split.requests,
      created_at: v.created_at,
      student: v.Student ? {
        id: v.Student.id,
        name: `${v.Student.first_name} ${v.Student.last_name}`,
        registration_no: v.Student.registration_no,
        class: v.Student.details?.studentDetails?.class_name,
        section: v.Student.details?.studentDetails?.section_name,
        class_id: v.Student.details?.studentDetails?.class_id,
        section_id: v.Student.details?.studentDetails?.section_id,
        roll_number: studentActiveRollNo
      } : null
    };
  });

  // Get payment history across all vouchers
  const paymentHistory = await getChildPaymentHistory(childId, instituteId);

  // Get upcoming dues
  const upcomingDues = voucherList
    .filter(v => v.status !== 'paid' && new Date(v.due_date) >= new Date())
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  // Get overdue dues
  const overdueDues = voucherList
    .filter(v => v.status === 'overdue' || (v.status === 'pending' && new Date(v.due_date) < new Date()))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  // Get active academic session roll_no
  const activeSession = child.details?.studentDetails?.academicSessions?.find(s => s.status === 'active');
  const activeRollNo = activeSession?.roll_no || child.details?.studentDetails?.roll_no;

  return {
    child: {
      id: child.id,
      name: `${child.first_name} ${child.last_name}`,
      registration_no: child.registration_no,
      class: child.details?.studentDetails?.class_name,
      section: child.details?.studentDetails?.section_name,
      class_id: child.details?.studentDetails?.class_id,
      section_id: child.details?.studentDetails?.section_id,
      roll_number: activeRollNo,
      parent_name: child.details?.parentDetails?.parent_name,
      parent_phone: child.details?.parentDetails?.parent_phone
    },
    summary,
    vouchers: voucherList,
    payment_history: paymentHistory,
    upcoming_dues: upcomingDues,
    overdue_dues: overdueDues,
    stats: {
      payment_compliance_rate: summary.total_invoiced > 0
        ? Math.round((summary.total_paid / summary.total_invoiced) * 100)
        : 100,
      outstanding_months: voucherList.filter(v => v.status !== 'paid').length,
      total_vouchers: voucherList.length
    }
  };
};

/**
 * Get payment history for a child
 */
const getChildPaymentHistory = async (childId, instituteId, limit = 50) => {
  const vouchers = await FeeVoucher.findAll({
    where: { institute_id: instituteId, student_id: childId },
    attributes: ['id', 'voucher_number', 'month', 'year']
  });
  if (!vouchers.length) return [];
  const byId = Object.fromEntries(vouchers.map(v => [v.id, v]));
  const payments = await FeePayment.findAll({
    where: { voucher_id: { [Op.in]: vouchers.map(v => v.id) } },
    order: [['payment_date', 'DESC'], ['created_at', 'DESC']],
    limit
  });
  return payments.map(p => ({
    id: p.id,
    voucher_id: p.voucher_id,
    voucher_number: byId[p.voucher_id]?.voucher_number,
    month: byId[p.voucher_id]?.month,
    year: byId[p.voucher_id]?.year,
    amount: parseFloat(p.amount_paid) || 0,
    payment_method: p.payment_method,
    transaction_id: p.transaction_id,
    receipt_number: p.receipt_number,
    payment_date: p.payment_date,
    status: 'confirmed'
  }));
};

/**
 * Payment history across all of a parent's children (confirmed payments +
 * pending/rejected payment requests). GET /portal/parent/payments/history
 */
export const getPaymentHistory = async (parentId, instituteId, filters = {}) => {
  const children = await getMyChildren(parentId, instituteId);
  const limit = Math.min(parseInt(filters.limit, 10) || 50, 200);
  const rows = [];
  for (const child of children) {
    const confirmed = await getChildPaymentHistory(child.id, instituteId, limit);
    confirmed.forEach(p => rows.push({ ...p, child_id: child.id, child_name: child.name }));

    const vouchers = await FeeVoucher.findAll({
      where: { institute_id: instituteId, student_id: child.id, archived: false },
      attributes: ['id', 'voucher_number', 'fee_breakdown']
    });
    vouchers.forEach(v => {
      splitBreakdown(v.fee_breakdown).requests
        .filter(r => r.status !== 'confirmed') // confirmed ones already appear as real payments
        .forEach(r => rows.push({
          id: r.id,
          voucher_id: v.id,
          voucher_number: v.voucher_number,
          amount: r.amount,
          payment_method: r.payment_method,
          transaction_id: r.transaction_id,
          receipt_number: null,
          payment_date: r.created_at,
          status: r.status,
          child_id: child.id,
          child_name: child.name
        }));
    });
  }
  let out = rows;
  if (filters.from_date) out = out.filter(r => new Date(r.payment_date) >= new Date(filters.from_date));
  if (filters.to_date) out = out.filter(r => new Date(r.payment_date) <= new Date(filters.to_date + 'T23:59:59'));
  out.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
  return out.slice(0, limit);
};

/**
 * Months that have attendance records for a child (for the month picker).
 * GET /portal/parent/children/:childId/attendance/months
 */
export const getAttendanceMonths = async (childId, instituteId) => {
  const records = await Attendance.findAll({
    where: { school_id: instituteId, student_id: childId },
    attributes: ['date', 'status'],
    order: [['date', 'DESC']],
    raw: true
  });
  const months = {};
  records.forEach(r => {
    const key = String(r.date).slice(0, 7);
    if (!months[key]) months[key] = { total_days: 0, ...emptyCounts() };
    months[key].total_days++;
    if (r.status in months[key]) months[key][r.status]++;
  });
  return Object.entries(months)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, stats]) => {
      const [y, m] = key.split('-').map(Number);
      return {
        month_key: key,
        year: y,
        month: m,
        label: format(new Date(y, m - 1, 1), 'MMMM yyyy'),
        ...stats,
        percentage: attendancePercentage(stats)
      };
    });
};

/**
 * Get single fee voucher details
 */
export const getFeeVoucherById = async (voucherId, parentId, instituteId) => {
  const voucher = await FeeVoucher.findOne({
    where: { id: voucherId, institute_id: instituteId },
    include: [
      {
        model: User,
        as: 'Student',
        attributes: ['id', 'first_name', 'last_name', 'registration_no', 'details']
      }
    ]
  });

  if (!voucher) throw new AppError('Voucher not found', 404);

  await assertParentOwnsChild(parentId, voucher.student_id, instituteId);

  const paymentHistory = (await getChildPaymentHistory(voucher.student_id, instituteId, 200))
    .filter(p => p.voucher_id === voucher.id);
  const paidAmount = paymentHistory.reduce((s, p) => s + p.amount, 0);

  // fee_breakdown holds the fee items; pending payment requests are exposed separately
  const { breakdown: feeBreakdown, requests: paymentRequests } = splitBreakdown(voucher.fee_breakdown);

  return {
    id: voucher.id,
    voucher_number: voucher.voucher_number || `VCH-${voucher.id}`,
    month: voucher.month,
    year: voucher.year,
    issued_date: voucher.issued_date,
    due_date: voucher.due_date,
    amount: parseFloat(voucher.amount) || 0,
    discount: parseFloat(voucher.discount) || 0,
    fine: parseFloat(voucher.fine) || 0,
    net_amount: parseFloat(voucher.net_amount) || 0,
    status: voucher.status,
    notes: voucher.notes,
    fee_breakdown: feeBreakdown,
    paid_amount: Number(paidAmount.toFixed(2)),
    payment_history: paymentHistory,
    payment_requests: paymentRequests,
    student: voucher.Student ? {
      id: voucher.Student.id,
      name: `${voucher.Student.first_name} ${voucher.Student.last_name}`,
      registration_no: voucher.Student.registration_no,
      class: voucher.Student.details?.class_name,
      section: voucher.Student.details?.section_name
    } : null,
    created_at: voucher.created_at,
    updated_at: voucher.updated_at
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get assignments for a child
 */
export const getChildAssignments = async (childId, instituteId, filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const child = await User.findByPk(childId);

  if (!child) {
    return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } };
  }

  const childClass = getStudentAcademicInfo(child).class_id;

  const where = {
    institute_id: instituteId,
    is_published: true,
    [Op.or]: [
      ...(childClass ? [{ target_type: 'class', target_ids: { [Op.contains]: [childClass] } }] : []),
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

  if (!child) return [];

  const childClass = getStudentAcademicInfo(child).class_id;
  const today = new Date();

  const assignments = await Assignment.findAll({
    where: {
      institute_id: instituteId,
      is_published: true,
      due_date: { [Op.gte]: today },
      [Op.or]: [
        ...(childClass ? [{ target_type: 'class', target_ids: { [Op.contains]: [childClass] } }] : []),
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
export const getChildTimetable = async (childId, instituteId) => {
  const child = await User.findByPk(childId);

  if (!child) {
    const emptySchedule = {};
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].forEach(day => {
      emptySchedule[day] = [];
    });
    return emptySchedule;
  }

  const childClass = getStudentAcademicInfo(child).class_id;
  if (!childClass) {
    const emptySchedule = {};
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].forEach(day => {
      emptySchedule[day] = [];
    });
    return emptySchedule;
  }

  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true,
      'entity_ids.class_id': childClass
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
          time: `${slot.start_time} - ${slot.end_time}`,
          subject: slot.subject_name,
          teacher: slot.teacher_name,
          room: slot.room_no,
          start_time: slot.start_time
        });
      }
    });
  });

  // Sort by time
  Object.keys(schedule).forEach(day => {
    schedule[day].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  });

  return schedule;
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notices for a parent: notifications addressed to the parent or any of their
 * children plus institute broadcasts (Notification model, scoped by institute).
 */
export const getParentNotices = async (parentId, instituteId, limit = 10) => {
  try {
    const parent = await User.findByPk(parentId, { attributes: ['id', 'branch_id', 'details'] });
    if (!parent) return [];
    const { data } = await fetchNotices({
      instituteId,
      branchId: parent.branch_id,
      userIds: [parentId, ...getParentChildIds(parent)],
      limit
    });
    return data;
  } catch (error) {
    logger.error('Error fetching parent notices:', error);
    return [];
  }
};

/**
 * Notices for one child (addressed to the child or parent, plus broadcasts).
 */
export const getNoticesForChild = async (childId, parentId, instituteId, filters = {}) => {
  await assertParentOwnsChild(parentId, childId, instituteId);
  const parent = await User.findByPk(parentId, { attributes: ['id', 'branch_id'] });
  return fetchNotices({
    instituteId,
    branchId: parent?.branch_id,
    userIds: [childId, parentId],
    type: filters.type,
    is_read: filters.is_read,
    limit: filters.limit || 20,
    page: filters.page || 1
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// FEE PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "Pay" a fee for a child.
 *
 * SECURITY: this NEVER marks a voucher paid. There is no payment gateway, so it
 * records a PENDING payment request (optionally with proof of payment) that a
 * school admin must confirm (PATCH /fee-vouchers/:voucherId/payment-requests/:requestId).
 */
export const payChildFee = async (voucherId, parentId, instituteId, paymentData = {}, file = null) => {
  const voucher = await FeeVoucher.findOne({
    where: { id: voucherId, institute_id: instituteId },
    attributes: ['id', 'student_id']
  });
  if (!voucher) {
    if (file?.path) await unlink(file.path).catch(() => {});
    throw new AppError('Voucher not found', 404);
  }
  try {
    await assertParentOwnsChild(parentId, voucher.student_id, instituteId);
  } catch (err) {
    if (file?.path) await unlink(file.path).catch(() => {});
    throw err;
  }

  const parent = await User.findByPk(parentId, { attributes: ['id', 'first_name', 'last_name'] });

  let proofUrl = null;
  if (file) {
    try {
      const uploaded = await uploadToCloudinary(file.path, `the-clouds-academy/${instituteId}/fee-proofs`);
      proofUrl = uploaded.url;
    } finally {
      await unlink(file.path).catch(() => {});
    }
  }

  const { request, voucher: v } = await createPaymentRequest(
    voucherId,
    instituteId,
    { id: parentId, name: parent ? `${parent.first_name} ${parent.last_name}`.trim() : null },
    { ...paymentData, proof_url: proofUrl },
    { student_ids: [voucher.student_id] }
  );

  return {
    id: v.id,
    voucher_number: v.voucher_number,
    amount: request.amount,
    status: v.status, // voucher status is unchanged until the school confirms
    payment_status: 'pending_confirmation',
    payment_request: request,
    message: 'Payment request submitted. The school will confirm it once the payment is verified.'
  };
};


// ─────────────────────────────────────────────────────────────────────────────
// COMMUNICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get teachers for parent's children
 */
export const getChildrenTeachers = async (parentId, instituteId) => {
  const parent = await User.findByPk(parentId);
  if (!parent) return [];

  const childrenIds = getParentChildIds(parent);

  const children = await User.findAll({
    where: { id: { [Op.in]: childrenIds }, school_id: instituteId, user_type: 'STUDENT' },
    attributes: ['id', 'details']
  });

  const classIds = [...new Set(children.map(c => getStudentAcademicInfo(c).class_id).filter(Boolean))];

  if (classIds.length === 0) return [];

  // Get timetables for these classes to extract teachers
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true,
      'entity_ids.class_id': { [Op.in]: classIds }
    }
  });

  const teacherMap = {};

  timetables.forEach(t => {
    const slots = t.slots || [];
    slots.forEach(slot => {
      if (slot.teacher_id && slot.teacher_name && !teacherMap[slot.teacher_id]) {
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

  if (data.feeStatus?.has_due) {
    alerts.push({
      type: 'fee',
      message: `Fee due of Rs. ${data.feeStatus.total_due}`,
      severity: 'high'
    });
  }

  if (data.upcomingAssignments?.length > 0) {
    alerts.push({
      type: 'assignment',
      message: `${data.upcomingAssignments.length} pending assignments`,
      severity: 'info'
    });
  }

  return alerts;
};

export const updateChildProfile = async (childId, parentId, instituteId, updateData = {}, file) => {
  try {
    await assertParentOwnsChild(parentId, childId, instituteId);
  } catch (err) {
    if (file?.path) await unlink(file.path).catch(() => {});
    throw err;
  }

  const child = await User.findOne({ where: { id: childId, school_id: instituteId, user_type: 'STUDENT' } });
  if (!child) {
    if (file?.path) await unlink(file.path).catch(() => {});
    throw new AppError('Child not found', 404);
  }

  // Upload avatar if provided
  let avatarUrl = child.avatar_url;
  let avatarPublicId = child.avatar_public_id;
  if (file) {
    try {
      const folder = `the-clouds-academy/${instituteId}/students/avatars`;
      const result = await uploadToCloudinary(file.path, folder, { transformation: [{ width: 300, height: 300, crop: 'thumb' }] });
      avatarUrl = result.url;
      if (child.avatar_public_id) await deleteFromCloudinary(child.avatar_public_id).catch(() => { });
      avatarPublicId = result.public_id;
    } finally {
      await unlink(file.path).catch(() => {});
    }
  }

  // Only contact-type fields; never email/registration/fees/class
  ['first_name', 'last_name', 'phone'].forEach(f => { if (updateData[f] !== undefined) child[f] = updateData[f]; });

  // Limited studentDetails fields a parent may edit
  let incoming = updateData.details;
  if (typeof incoming === 'string') { try { incoming = JSON.parse(incoming); } catch { incoming = null; } }
  if (incoming && typeof incoming === 'object') {
    const editable = ['present_address', 'permanent_address', 'city', 'emergency_contact_name', 'emergency_contact_phone'];
    const safeDetails = {};
    editable.forEach(f => { if (incoming[f] !== undefined) safeDetails[f] = incoming[f]; });
    const details = { ...(child.details || {}) };
    details.studentDetails = { ...(details.studentDetails || {}), ...safeDetails };
    child.details = details;
    child.changed('details', true);
  }

  if (avatarUrl) {
    child.avatar_url = avatarUrl;
    child.avatar_public_id = avatarPublicId;
  }

  await child.save();
  return getChildDetails(childId, parentId, instituteId);
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
  updateChildProfile,

  // Children
  getMyChildren,
  getChildDetails,

  // Child specific data
  getChildFullAttendance,
  getChildRecentResults,
  getChildFullResults,
  getExamResultDetails,
  getChildExamSchedule,
  getChildFullFees,
  getChildAssignments,
  getChildTimetable,

  getChildUpcomingAssignments,

  // Fee payment
  payChildFee,
  getPaymentHistory,
  getFeeVoucherById,

  // Communication
  getChildrenTeachers,

  // Notices
  getParentNotices
};