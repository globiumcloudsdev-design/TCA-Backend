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
import logger from '../../config/logger.js';

const {
  User,
  Timetable,
  Assignment,
  AssignmentSubmission,
  StudentAttendance: Attendance,
  FeeVoucher,
  ExamResult,
  Notice,
  Notification,
  Class,
  Section,
  sequelize
} = models;

const NoticeModel = Notice || Notification;

const mapNoticeRow = (row) => {
  const createdAt = row.created_at || row.createdAt || new Date();
  const content = row.content || row.body || row.data?.message || '';
  const priority = row.priority || row.data?.priority || 'normal';

  return {
    id: row.id,
    title: row.title || 'Notice',
    content,
    priority,
    created_at: createdAt,
    attachments: row.attachments || row.data?.attachments || []
  };
};

const pickStudentDetails = (student) => {
  if (!student?.details) return {};
  return student.details.studentDetails || student.details;
};

const getActiveAcademicSession = (details = {}) => {
  const sessions = Array.isArray(details?.academicSessions) ? details.academicSessions : [];
  const normalized = sessions
    .filter((session) => session && (session.class_id || session.class_name))
    .map((session) => ({
      ...session,
      status_normalized: String(session.status || '').trim().toLowerCase(),
      start_ts: Number(new Date(session.start_date || 0)),
      end_ts: Number(new Date(session.end_date || 0))
    }));

  const active = normalized
    .filter((session) => session.status_normalized === 'active')
    .sort((a, b) => b.start_ts - a.start_ts);

  if (active.length) return active[0];

  const latest = normalized.sort((a, b) => {
    const bKey = Number.isFinite(b.end_ts) && b.end_ts > 0 ? b.end_ts : b.start_ts;
    const aKey = Number.isFinite(a.end_ts) && a.end_ts > 0 ? a.end_ts : a.start_ts;
    return bKey - aKey;
  });

  return latest[0] || null;
};

const normalizeStudentPortalProfile = (student) => {
  const details = pickStudentDetails(student);
  const activeSession = getActiveAcademicSession(details);
  const pickValue = (...values) => {
    const found = values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
    return found ?? null;
  };

  return {
    id: student.id,
    name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
    first_name: student.first_name,
    last_name: student.last_name,
    email: student.email,
    phone: student.phone,
    registration_no: student.registration_no,
    avatar: student.avatar_url,

    class_id: pickValue(activeSession?.class_id, details.class_id, details.classId, student.class_id, student.classId),
    class_name: pickValue(activeSession?.class_name, details.class_name, details.className, student.class_name, student.className),
    section_id: pickValue(activeSession?.section_id, details.section_id, details.sectionId, student.section_id, student.sectionId),
    section_name: pickValue(activeSession?.section_name, details.section_name, details.sectionName, student.section_name, student.sectionName),
    roll_number: pickValue(activeSession?.roll_no, details.roll_number, details.roll_no),
    admission_date: details.admission_date || null,
    
    cnic: details.cnic || null,   // Add this line

    date_of_birth: details.date_of_birth || null,
    gender: details.gender || null,
    blood_group: details.blood_group || null,
    religion: details.religion || null,
    nationality: details.nationality || null,

    present_address: details.present_address || null,
    permanent_address: details.permanent_address || null,
    city: details.city || null,

    guardian_name: details.guardian_name || null,
    guardian_relation: details.guardian_relation || null,
    guardian_phone: details.guardian_phone || null,
    guardian_email: details.guardian_email || null,

    documents: student.documents || [],
    academic_sessions: Array.isArray(details.academicSessions) ? details.academicSessions : [],
    active_academic_session: activeSession,
    created_at: student.created_at
  };
};

const normalizeCandidate = (candidate = {}) => {
  const classId = String(candidate.class_id || '').trim();
  const sectionId = String(candidate.section_id || '').trim();
  const className = String(candidate.class_name || '').trim();
  const sectionName = String(candidate.section_name || '').trim();

  return {
    class_id: classId || null,
    section_id: sectionId || null,
    class_name: className || null,
    section_name: sectionName || null
  };
};

const hasTeachingSlots = (timetable) => {
  const slots = Array.isArray(timetable?.slots) ? timetable.slots : [];
  return slots.some((slot) => slot && !slot.is_break);
};

const buildStudentAcademicCandidates = (student) => {
  const candidates = [];
  const seen = new Set();
  const pushCandidate = (rawCandidate) => {
    const candidate = normalizeCandidate(rawCandidate);
    if (!candidate.class_id && !candidate.class_name) return;

    const key = [candidate.class_id || '', candidate.section_id || '', candidate.class_name || '', candidate.section_name || '']
      .join('|')
      .toLowerCase();

    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  // Primary candidate should always be current profile values.
  pushCandidate(student);

  const sessions = Array.isArray(student?.academic_sessions) ? student.academic_sessions : [];

  const normalizedSessions = sessions
    .filter((session) => session && (session.class_id || session.class_name))
    .map((session) => ({
      class_id: session.class_id,
      section_id: session.section_id,
      class_name: session.class_name,
      section_name: session.section_name,
      status: String(session.status || '').trim().toLowerCase(),
      start_ts: Number(new Date(session.start_date || 0)),
      end_ts: Number(new Date(session.end_date || 0))
    }));

  const activeSessions = normalizedSessions
    .filter((session) => session.status === 'active')
    .sort((a, b) => b.start_ts - a.start_ts);

  const historicalSessions = normalizedSessions
    .filter((session) => session.status !== 'active')
    .sort((a, b) => {
      const bKey = Number.isFinite(b.end_ts) && b.end_ts > 0 ? b.end_ts : b.start_ts;
      const aKey = Number.isFinite(a.end_ts) && a.end_ts > 0 ? a.end_ts : a.start_ts;
      return bKey - aKey;
    });

  activeSessions.forEach(pushCandidate);
  historicalSessions.forEach(pushCandidate);

  return candidates;
};

const findBestMatchedTimetables = (timetables = [], student = {}) => {
  const candidates = buildStudentAcademicCandidates(student);
  if (!candidates.length) return [];

  const primaryCandidate = candidates[0] || {};
  const primaryMatches = timetables.filter((timetable) => timetableMatchesStudent(timetable, primaryCandidate));
  const primaryHasSection = Boolean(primaryCandidate.section_id || primaryCandidate.section_name);

  // If current profile has a section, never fall back to old academic sessions.
  if (primaryHasSection) {
    return primaryMatches;
  }

  let fallbackMatches = [];

  for (const candidate of candidates) {
    const matches = timetables.filter((timetable) => timetableMatchesStudent(timetable, candidate));
    if (!matches.length) continue;

    if (!fallbackMatches.length) {
      fallbackMatches = matches;
    }

    if (matches.some((timetable) => hasTeachingSlots(timetable))) {
      return matches;
    }
  }

  return fallbackMatches;
};

const buildAssignmentDirectAudience = (student = {}) => {
  const classId = String(student?.class_id || '').trim();
  const sectionId = String(student?.section_id || '').trim();

  if (!classId && !sectionId) return [];

  if (classId && sectionId) {
    return [
      {
        [Op.and]: [
          { class_id: classId },
          { section_id: sectionId }
        ]
      },
      {
        [Op.and]: [
          { class_id: classId },
          { section_id: { [Op.is]: null } }
        ]
      }
    ];
  }

  if (classId) {
    return [{ class_id: classId }];
  }

  return [{ section_id: sectionId }];
};

const timetableMatchesStudent = (timetable, student) => {
  const studentClassId = String(student.class_id || '').trim();
  const studentSectionId = String(student.section_id || '').trim();
  const studentClassName = String(student.class_name || '').trim().toLowerCase();
  const studentSectionName = String(student.section_name || '').trim().toLowerCase();
  const requiresSectionMatch = Boolean(studentSectionId || studentSectionName);
  const entityIds = timetable?.entity_ids || {};

  const entityClassId = String(entityIds.class_id || '').trim();
  const entitySectionId = String(entityIds.section_id || '').trim();
  const entityClassName = String(entityIds.class_name || '').trim().toLowerCase();
  const entitySectionName = String(entityIds.section_name || '').trim().toLowerCase();
  const entityClassIds = [
    ...(Array.isArray(entityIds.class_ids) ? entityIds.class_ids : []),
    ...(Array.isArray(entityIds.classIds) ? entityIds.classIds : [])
  ].map((id) => String(id || '').trim()).filter(Boolean);
  const entitySectionIds = [
    ...(Array.isArray(entityIds.section_ids) ? entityIds.section_ids : []),
    ...(Array.isArray(entityIds.sectionIds) ? entityIds.sectionIds : [])
  ].map((id) => String(id || '').trim()).filter(Boolean);
  const classSectionPairs = Array.isArray(entityIds.class_sections)
    ? entityIds.class_sections
    : (Array.isArray(entityIds.classSections) ? entityIds.classSections : []);

  if (studentClassId && entityClassId && studentClassId === entityClassId) {
    if (!requiresSectionMatch) {
      return true;
    }
    if ((studentSectionId && entitySectionId && studentSectionId === entitySectionId) || (studentSectionName && entitySectionName && studentSectionName === entitySectionName)) {
      return true;
    }
  }

  if (studentClassName && entityClassName && studentClassName === entityClassName) {
    if (!requiresSectionMatch) {
      return true;
    }
    if ((studentSectionName && entitySectionName && studentSectionName === entitySectionName) || (studentSectionId && entitySectionId && studentSectionId === entitySectionId)) {
      return true;
    }
  }

  if (studentClassId && entityClassIds.includes(studentClassId)) {
    if (!requiresSectionMatch) {
      return true;
    }
    if ((studentSectionId && entitySectionIds.includes(studentSectionId)) || (studentSectionName && entitySectionName && studentSectionName === entitySectionName)) {
      return true;
    }
  }

  if (studentClassId && classSectionPairs.length) {
    const pairMatch = classSectionPairs.some((pair) => {
      if (!pair) return false;
      const pairClassId = String(pair.class_id || pair.classId || '').trim();
      const pairSectionId = String(pair.section_id || pair.sectionId || '').trim();
      const pairSectionName = String(pair.section_name || pair.sectionName || '').trim().toLowerCase();
      if (pairClassId !== studentClassId) return false;
      if (!requiresSectionMatch) return true;
      return (studentSectionId && pairSectionId && pairSectionId === studentSectionId)
        || (studentSectionName && pairSectionName && pairSectionName === studentSectionName);
    });
    if (pairMatch) return true;
  }

  const slots = Array.isArray(timetable?.slots) ? timetable.slots : [];
  return slots.some((slot) => {
    if (!slot || slot.is_break) return false;

    const slotClassId = String(
      slot.class_id || slot.assigned_class_id || slot.assigned_to?.class_id || ''
    ).trim();
    const slotSectionId = String(
      slot.section_id || slot.assigned_section_id || slot.assigned_to?.section_id || ''
    ).trim();
    const slotClassName = String(
      slot.class_name || slot.assigned_to?.class_name || ''
    ).trim().toLowerCase();
    const slotSectionName = String(
      slot.section_name || slot.assigned_to?.section_name || ''
    ).trim().toLowerCase();

    const slotClassIds = [
      ...(Array.isArray(slot.class_ids) ? slot.class_ids : []),
      ...(Array.isArray(slot.assigned_to?.class_ids) ? slot.assigned_to.class_ids : [])
    ].map((id) => String(id || '').trim()).filter(Boolean);

    const slotSectionIds = [
      ...(Array.isArray(slot.section_ids) ? slot.section_ids : []),
      ...(Array.isArray(slot.assigned_to?.section_ids) ? slot.assigned_to.section_ids : [])
    ].map((id) => String(id || '').trim()).filter(Boolean);

    const classMatch = studentClassId && (
      slotClassId === studentClassId ||
      slotClassIds.includes(studentClassId)
    );

    const classNameMatch = studentClassName && slotClassName && slotClassName === studentClassName;

    const sectionMatch = !studentSectionId || (
      slotSectionId === studentSectionId ||
      slotSectionIds.includes(studentSectionId)
    );

    const sectionNameMatch = !studentSectionName || !slotSectionName || slotSectionName === studentSectionName;

    return (classMatch && sectionMatch) || (classNameMatch && sectionNameMatch);
  });
};

const normalizeDayKey = (rawDay) => {
  if (rawDay === undefined || rawDay === null) return null;

  const asNumber = Number(rawDay);
  if (!Number.isNaN(asNumber) && String(rawDay).trim() !== '') {
    const numericMap = {
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
      7: 'sunday',
      0: 'sunday'
    };
    if (numericMap[asNumber]) return numericMap[asNumber];
  }

  const day = String(rawDay || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!day) return null;

  const map = {
    mon: 'monday',
    monday: 'monday',
    tue: 'tuesday',
    tues: 'tuesday',
    tuesday: 'tuesday',
    wed: 'wednesday',
    wednesday: 'wednesday',
    thu: 'thursday',
    thur: 'thursday',
    thursday: 'thursday',
    fri: 'friday',
    friday: 'friday',
    sat: 'saturday',
    saturday: 'saturday',
    sun: 'sunday',
    sunday: 'sunday'
  };

  return map[day] || null;
};

const resolveSlotTime = (slot = {}, periodConfig = []) => {
  if (slot.start_time || slot.end_time) {
    return {
      start: slot.start_time || '--:--',
      end: slot.end_time || '--:--'
    };
  }

  const periodRaw = String(slot.period || slot.period_no || '').trim();
  const periodNo = Number(periodRaw.replace(/[^0-9]/g, ''));
  const periodList = Array.isArray(periodConfig)
    ? periodConfig
    : (Array.isArray(periodConfig?.periods) ? periodConfig.periods : []);
  const matchedPeriod = periodList.find((period) => Number(String(period?.period_no || period?.period || '').replace(/[^0-9]/g, '')) === periodNo);

  if (!matchedPeriod && slot.time && String(slot.time).includes('-')) {
    const [start, end] = String(slot.time).split('-').map((v) => v.trim());
    return {
      start: start || '--:--',
      end: end || '--:--'
    };
  }

  return {
    start: matchedPeriod?.start_time || '--:--',
    end: matchedPeriod?.end_time || '--:--'
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get complete student dashboard
 */
export const getStudentDashboard = async (studentId, instituteId) => {
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
    // Notices should never break dashboard core widgets.
    getRecentNotices(instituteId, 5).catch(() => []),
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

  const profile = normalizeStudentPortalProfile(student);
  const session = profile.active_academic_session || null;

  const classId = session?.class_id || profile.class_id;
  const sectionId = session?.section_id || profile.section_id;

  const [classInfo, sectionInfo] = await Promise.all([
    classId ? Class.findByPk(classId, { attributes: ['id', 'name'] }) : Promise.resolve(null),
    sectionId ? Section.findByPk(sectionId, { attributes: ['id', 'name'] }) : Promise.resolve(null)
  ]);

  const resolvedClassName = classInfo?.name || session?.class_name || profile.class_name || null;
  const resolvedSectionName = sectionInfo?.name || session?.section_name || profile.section_name || null;

  return {
    ...profile,
    class_id: classId || profile.class_id,
    section_id: sectionId || profile.section_id,
    class_name: resolvedClassName,
    section_name: resolvedSectionName,
    active_academic_session: session
      ? {
        ...session,
        class_id: classId || session.class_id || null,
        section_id: sectionId || session.section_id || null,
        class_name: resolvedClassName,
        section_name: resolvedSectionName
      }
      : null
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
        await deleteFromCloudinary(student.avatar_public_id).catch(() => { });
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

  if (!student.class_id && !student.class_name) return [];

  const normalizeSubjectKey = (value) => String(value || '').trim().toLowerCase();

  const classRecord = student.class_id
    ? await Class.findOne({
      where: {
        id: student.class_id,
        school_id: instituteId,
        is_active: true,
      },
      attributes: ['id', 'name', 'courses'],
    })
    : null;

  const courseSyllabusMap = new Map();
  const courses = Array.isArray(classRecord?.courses) ? classRecord.courses : [];
  courses.forEach((course, courseIndex) => {
    const courseName = String(course?.name || '').trim();
    if (!courseName) return;

    const materials = Array.isArray(course?.materials) ? course.materials : [];
    const syllabusItems = materials
      .map((material, materialIndex) => {
        const text = material?.text || material?.description || material?.content || null;
        const link = material?.url || material?.link || material?.pdf_url || null;
        const pdfUrl = material?.pdf_url || (typeof link === 'string' && link.toLowerCase().includes('.pdf') ? link : null);

        if (!text && !link && !pdfUrl) return null;

        return {
          id: material?.id || `${courseName}-${materialIndex + 1}`,
          title: material?.name || `Material ${materialIndex + 1}`,
          text,
          url: link,
          pdf_url: pdfUrl,
          type: material?.type || (pdfUrl ? 'pdf' : (link ? 'url' : 'text')),
        };
      })
      .filter(Boolean);

    courseSyllabusMap.set(normalizeSubjectKey(courseName), {
      course_id: course?.id || `course-${courseIndex + 1}`,
      subject_name: courseName,
      syllabus: syllabusItems,
    });
  });

  // Get timetable for student's class
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });

  const matchedTimetables = findBestMatchedTimetables(timetables, student);

  // Extract subjects from timetable
  const subjects = new Map();

  matchedTimetables.forEach(timetable => {
    (timetable.slots || []).forEach(slot => {
      if (slot.subject_name && !slot.is_break) {
        if (!subjects.has(slot.subject_name)) {
          const subjectKey = normalizeSubjectKey(slot.subject_name);
          const courseSyllabus = courseSyllabusMap.get(subjectKey);
          subjects.set(slot.subject_name, {
            name: slot.subject_name,
            teacher: slot.teacher_name,
            room: slot.room_no,
            total_classes: 0,
            attended: 0,
            course_id: courseSyllabus?.course_id || slot.subject_id || null,
            syllabus: courseSyllabus?.syllabus || [],
            materials: courseSyllabus?.syllabus || [],
          });
        }
      }
    });
  });

  // Add class course subjects even if they are not present in timetable slots yet.
  courseSyllabusMap.forEach((courseSyllabus, key) => {
    const existing = Array.from(subjects.values()).find((item) => normalizeSubjectKey(item.name) === key);
    if (existing) {
      existing.syllabus = Array.isArray(existing.syllabus) && existing.syllabus.length
        ? existing.syllabus
        : (courseSyllabus.syllabus || []);
      existing.materials = existing.syllabus;
      if (!existing.course_id) existing.course_id = courseSyllabus.course_id;
      return;
    }

    subjects.set(courseSyllabus.subject_name, {
      name: courseSyllabus.subject_name,
      teacher: null,
      room: null,
      total_classes: 0,
      attended: 0,
      course_id: courseSyllabus.course_id || null,
      syllabus: courseSyllabus.syllabus || [],
      materials: courseSyllabus.syllabus || [],
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
      attended: att.present,
      has_syllabus: Array.isArray(subject.syllabus) && subject.syllabus.length > 0,
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

  if (!student.class_id && !student.class_name) {
    return {
      week: {
        start: format(weekStart ? new Date(weekStart) : startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(weekStart ? endOfWeek(new Date(weekStart), { weekStartsOn: 1 }) : endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      },
      schedule: {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: []
      }
    };
  }

  const startDate = weekStart ? new Date(weekStart) : startOfWeek(new Date(), { weekStartsOn: 1 });
  const endDate = endOfWeek(startDate, { weekStartsOn: 1 });

  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });

  const matchedTimetables = findBestMatchedTimetables(timetables, student);

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const schedule = {};

  days.forEach(day => { schedule[day] = []; });

  matchedTimetables.forEach(timetable => {
    const slots = timetable.slots || [];
    slots.forEach(slot => {
      const dayKey = normalizeDayKey(slot.day || slot.day_name || slot.week_day);
      if (dayKey && days.includes(dayKey) && !slot.is_break) {
        const slotTime = resolveSlotTime(slot, timetable.period_config);
        schedule[dayKey].push({
          id: slot.id,
          period: slot.period || slot.period_no,
          start_time: slotTime.start,
          end_time: slotTime.end,
          subject: slot.subject_name || slot.subject || 'Subject',
          teacher: slot.teacher_name || slot.teacher || slot.teacher_id || 'N/A',
          room: slot.room_no
        });
      }
    });
  });

  // Sort each day by start time
  Object.keys(schedule).forEach(day => {
    schedule[day].sort((a, b) => {
      const aTime = String(a.start_time || '');
      const bTime = String(b.start_time || '');
      if (aTime && bTime && aTime !== '--:--' && bTime !== '--:--') {
        return aTime.localeCompare(bTime);
      }
      return Number(a.period || 0) - Number(b.period || 0);
    });
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

  if (!student.class_id && !student.class_name) return [];

  const today = format(new Date(), 'EEEE').toLowerCase();

  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });

  const matchedTimetables = findBestMatchedTimetables(timetables, student);

  const todayClasses = [];

  matchedTimetables.forEach(timetable => {
    (timetable.slots || [])
      .filter(slot => normalizeDayKey(slot.day || slot.day_name || slot.week_day) === today && !slot.is_break)
      .forEach(slot => {
        const slotTime = resolveSlotTime(slot, timetable.period_config);
        todayClasses.push({
          id: slot.id,
          period: slot.period || slot.period_no,
          start_time: slotTime.start,
          time: `${slotTime.start} - ${slotTime.end}`,
          subject: slot.subject_name || slot.subject || 'Subject',
          teacher: slot.teacher_name || slot.teacher || slot.teacher_id || 'N/A',
          room: slot.room_no,
          status: 'upcoming' // Can be 'ongoing', 'completed', 'upcoming'
        });
      });
  });

  return todayClasses.sort((a, b) => {
    const aTime = String(a.start_time || '');
    const bTime = String(b.start_time || '');
    if (aTime && bTime && aTime !== '--:--' && bTime !== '--:--') {
      return aTime.localeCompare(bTime);
    }
    return Number(a.period || 0) - Number(b.period || 0);
  });
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
  const assignmentAudience = [{ target_type: 'all' }];
  if (student.class_id) {
    assignmentAudience.push({ target_type: 'class', target_ids: { [Op.contains]: [student.class_id] } });
  }
  if (student.section_id) {
    assignmentAudience.push({ target_type: 'section', target_ids: { [Op.contains]: [student.section_id] } });
  }

  const directClassSectionAudience = buildAssignmentDirectAudience(student);

  const where = {
    institute_id: instituteId,
    [Op.or]: [
      ...assignmentAudience,
      ...directClassSectionAudience
    ],
    [Op.and]: [
      {
        [Op.or]: [
          { is_published: true },
          { status: 'published' }
        ]
      }
    ]
  };

  if (filters.subject) where.subject = filters.subject;
  if (filters.type) {
    where.type = filters.type === 'notes' ? 'project' : filters.type;
  }
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

  // //
  // const assignmentsWithStatus = rows.map(assignment => {
  //   const submission = submissionsMap[assignment.id];
  //   const isOverdue = new Date(assignment.due_date) < new Date();

  //   let status = 'pending';
  //   if (submission) {
  //     if (submission.status === 'graded') status = 'graded';
  //     else if (submission.status === 'submitted') status = 'submitted';
  //     else if (submission.status === 'late') status = 'late';
  //   } else if (isOverdue) {
  //     status = 'overdue';
  //   }

  //   return {
  //     id: assignment.id,
  //     title: assignment.title,
  //     subject: assignment.subject,
  //     teacher: assignment.teacher ? `${assignment.teacher.first_name} ${assignment.teacher.last_name}` : 'Unknown',
  //     due_date: assignment.due_date,
  //     total_marks: assignment.total_marks,
  //     status,
  //     submission: submission ? {
  //       id: submission.id,
  //       submitted_at: submission.submitted_at,
  //       marks: submission.marks,
  //       feedback: submission.feedback,
  //       files: submission.files
  //     } : null,
  //     attachments: assignment.attachments
  //   };
  // });
  // In getMyAssignments function, enhance the response format

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
      description: assignment.description,
      subject: assignment.subject,
      teacher: assignment.teacher ? `${assignment.teacher.first_name} ${assignment.teacher.last_name}` : 'Unknown',
      due_date: assignment.due_date,
      total_marks: assignment.total_marks,
      passing_marks: assignment.passing_marks,
      instructions: assignment.instructions,
      allow_late_submission: assignment.allow_late_submission,
      late_submission_penalty: assignment.late_submission_penalty,
      max_files: assignment.max_files,
      max_file_size: assignment.max_file_size,
      allowed_file_types: assignment.allowed_file_types,
      estimated_time: assignment.estimated_time,
      difficulty_level: assignment.difficulty_level,
      status,
      submission: submission ? {
        id: submission.id,
        submitted_at: submission.submitted_at,
        marks: submission.marks,
        grade: submission.grade,
        feedback: submission.feedback,
        files: submission.files,
        submission_text: submission.submission_text,
        attempt_number: submission.attempt_number,
        is_resubmission: submission.is_resubmission
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

  const assignmentAudience = [{ target_type: 'all' }];
  if (student.class_id) {
    assignmentAudience.push({ target_type: 'class', target_ids: { [Op.contains]: [student.class_id] } });
  }
  if (student.section_id) {
    assignmentAudience.push({ target_type: 'section', target_ids: { [Op.contains]: [student.section_id] } });
  }

  const directClassSectionAudience = buildAssignmentDirectAudience(student);

  const assignments = await Assignment.findAll({
    where: {
      institute_id: instituteId,
      due_date: { [Op.gte]: today },
      [Op.or]: [
        ...assignmentAudience,
        ...directClassSectionAudience
      ],
      [Op.and]: [
        {
          [Op.or]: [
            { is_published: true },
            { status: 'published' }
          ]
        }
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

// Update the submitAssignment function

/**
 * Submit assignment with text and multiple files
 */
export const submitAssignment = async (assignmentId, studentId, instituteId, files = [], submissionText = null) => {
  const transaction = await sequelize.transaction();

  try {
    // Check if assignment exists and is published
    const assignment = await Assignment.findOne({
      where: {
        id: assignmentId,
        institute_id: instituteId,
        [Op.or]: [
          { is_published: true },
          { status: 'published' }
        ]
      },
      transaction
    });

    if (!assignment) throw new Error('Assignment not found or not published');

    // Check if already submitted
    const existing = await AssignmentSubmission.findOne({
      where: { assignment_id: assignmentId, student_id: studentId },
      transaction
    });

    if (existing && existing.status !== 'draft') {
      throw new Error('You have already submitted this assignment');
    }

    // Upload files
    const submissionFiles = [];
    if (files?.length) {
      for (const file of files) {
        const folder = `the-clouds-academy/${instituteId}/submissions/${assignmentId}/${studentId}`;

        // Use 'raw' for all file types to preserve original format
        const result = await uploadToCloudinary(file.path, folder, {
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true
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
    const allowLate = assignment.allow_late_submission === true;

    let status = 'submitted';
    if (isLate) {
      status = allowLate ? 'late' : 'overdue';
    }

    // Create or update submission
    let submission;
    if (existing) {
      // Update existing submission (resubmission)
      const existingFiles = existing.files || [];
      await existing.update({
        files: [...existingFiles, ...submissionFiles],
        submission_text: submissionText || existing.submission_text,
        submitted_at: new Date(),
        status: status,
        attempt_number: existing.attempt_number + 1,
        is_resubmission: true
      }, { transaction });
      submission = existing;
    } else {
      // Create new submission
      submission = await AssignmentSubmission.create({
        id: uuidv4(),
        assignment_id: assignmentId,
        institute_id: instituteId,
        student_id: studentId,
        files: submissionFiles,
        submission_text: submissionText,
        submitted_at: new Date(),
        status: status,
        attempt_number: 1,
        is_resubmission: false
      }, { transaction });
    }

    // Update assignment stats
    const totalSubmissions = await AssignmentSubmission.count({
      where: { assignment_id: assignmentId },
      transaction
    });

    await assignment.update({
      stats: {
        ...assignment.stats,
        submitted: totalSubmissions,
        pending: Math.max(0, (assignment.stats?.total_students || 0) - totalSubmissions)
      }
    }, { transaction });

    await transaction.commit();

    return {
      id: submission.id,
      submitted_at: submission.submitted_at,
      status: submission.status,
      files: submissionFiles,
      submission_text: submission.submission_text,
      attempt_number: submission.attempt_number
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXAMS & RESULTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get exam schedule (upcoming and ongoing exams) for student
 */
export const getMyExamSchedule = async (studentId, instituteId) => {
  const student = await User.findByPk(studentId, {
    attributes: ['id', 'details']
  });

  if (!student) throw new Error('Student not found');

  // Extract class_id and section_id from studentDetails (nested in details object)
  const studentClass = student.details?.studentDetails?.class_id;
  const studentSection = student.details?.studentDetails?.section_id;

  try {
    // Get exams for student's class/section
    // Exams have direct class_id and section_id columns
    const exams = await models.Exam.findAll({
      where: {
        school_id: instituteId,
        status: { [Op.in]: ['draft', 'scheduled', 'ongoing'] },
        [Op.or]: [
          { class_id: studentClass },  // Exam is for this student's class
          {
            [Op.and]: [
              { class_id: studentClass },
              { [Op.or]: [{ section_id: studentSection }, { section_id: null }] }  // Exam is for this section or all sections of class
            ]
          }
        ]
      },
      attributes: ['id', 'name', 'type', 'start_date', 'end_date', 'status', 'total_marks', 'subject_schedules'],
      order: [['start_date', 'ASC']],
      raw: true
    });

    return exams.map(exam => {
      const subject_schedules = typeof exam.subject_schedules === 'string'
        ? JSON.parse(exam.subject_schedules)
        : exam.subject_schedules || [];

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
 * Get student's exam results
 */
export const getMyResults = async (studentId, instituteId, filters = {}) => {
  const where = {
    student_id: studentId
  };

  const examWhere = {};
  if (filters.exam_type) examWhere.type = filters.exam_type;
  if (filters.academic_year_id) examWhere.academic_year_id = filters.academic_year_id;

  const results = await ExamResult.findAll({
    where,
    order: [['created_at', 'DESC']],
    include: [
      {
        model: models.Exam,
        as: 'exam',
        attributes: ['id', 'name', 'type', 'start_date', 'total_marks', 'academic_year_id'],
        ...(Object.keys(examWhere).length ? { where: examWhere } : {})
      }
    ]
  });

  // Group by exam
  const examGroups = {};
  results.forEach(r => {
    const examRef = r.exam;
    const examId = r.exam_id;

    if (!examGroups[examId]) {
      examGroups[examId] = {
        exam_id: examId,
        exam_name: examRef?.name,
        exam_type: examRef?.type,
        date: examRef?.start_date || r.created_at,
        subjects: [],
        total_marks: Number(r.total_marks) || 0,
        obtained_marks: Number(r.total_marks_obtained) || 0,
        percentage: Number(r.percentage) || 0,
        rank: r.rank,
        grade: r.grade
      };
    }

    // Extract subjects from JSONB subject_marks array
    const subjectMarks = Array.isArray(r.subject_marks) ? r.subject_marks : [];
    subjectMarks.forEach(sm => {
      examGroups[examId].subjects.push({
        subject: sm.subject_name || 'Subject',
        marks: Number(sm.marks_obtained) || 0,
        total: Number(sm.total_marks) || 0,
        grade: sm.grade || null,
        remarks: sm.remarks || null
      });
    });
  });

  return Object.values(examGroups);
};

/**
 * Get recent results for dashboard
 */
export const getRecentResults = async (studentId, instituteId, limit = 3) => {
  const results = await ExamResult.findAll({
    where: { student_id: studentId },
    order: [['created_at', 'DESC']],
    limit,
    include: [
      { model: models.Exam, as: 'exam', attributes: ['name', 'start_date', 'total_marks'] }
    ]
  });

  const examMap = {};
  results.forEach(r => {
    const examRef = r.exam;
    const examId = r.exam_id;

    if (!examMap[examId]) {
      examMap[examId] = {
        exam_name: examRef?.name,
        date: examRef?.start_date || r.created_at,
        subjects: [],
        total: Number(r.total_marks) || 0,
        obtained: Number(r.total_marks_obtained) || 0
      };
    }

    // Extract subjects from JSONB subject_marks array
    const subjectMarks = Array.isArray(r.subject_marks) ? r.subject_marks : [];
    subjectMarks.forEach(sm => {
      examMap[examId].subjects.push({
        subject: sm.subject_name || 'Subject',
        marks: Number(sm.marks_obtained) || 0,
        total: Number(sm.total_marks) || 0
      });
    });
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
    institute_id: instituteId,
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
      institute_id: instituteId,
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

  if (!NoticeModel) {
    return {
      data: [],
      pagination: {
        total: 0,
        page,
        limit,
        totalPages: 0
      }
    };
  }

  const isNoticeTable = NoticeModel === Notice;

  const where = isNoticeTable
    ? {
      institute_id: instituteId,
      is_published: true,
      target_audience: { [Op.overlap]: ['student', 'all'] }
    }
    : {
      school_id: instituteId
    };

  if (filters.priority && isNoticeTable) where.priority = filters.priority;

  const { count, rows } = await NoticeModel.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset
  });

  return {
    data: rows.map(mapNoticeRow),
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
  if (!NoticeModel) return [];

  const isNoticeTable = NoticeModel === Notice;

  const notices = await NoticeModel.findAll({
    where: isNoticeTable
      ? {
        institute_id: instituteId,
        is_published: true,
        target_audience: { [Op.overlap]: ['student', 'all'] }
      }
      : {
        school_id: instituteId
      },
    order: [['created_at', 'DESC']],
    limit
  });

  return notices.map((n) => {
    const mapped = mapNoticeRow(n);
    return {
      id: mapped.id,
      title: mapped.title,
      content: mapped.content ? `${String(mapped.content).substring(0, 100)}...` : '',
      priority: mapped.priority,
      date: format(new Date(mapped.created_at), 'dd MMM yyyy')
    };
  });
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
    ExamResult.count({
      where: { student_id: studentId },
      include: [{
        model: models.Exam,
        as: 'exam',
        where: { school_id: instituteId },
        required: true
      }]
    })
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

  // Exams & Results
  getMyExamSchedule,
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