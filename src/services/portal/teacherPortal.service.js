// backend/src/services/portal/teacherPortal.service.js

/**
 * The Clouds Academy - Teacher Portal Unified Service
 * 
 * Teacher ke saare portal-specific functions ek hi jagah:
 * - Dashboard
 * - My Classes
 * - My Students
 * - Assignments (CRUD)
 * - Attendance
 * - Timetable
 * - Results/Grades
 * - Profile
 * - Notices
 */

import { Op } from 'sequelize';
import models from '../../models/postgres/index.js';
import { v4 as uuidv4 } from 'uuid';
import { startOfDay, endOfDay, addDays, format, startOfWeek, endOfWeek, formatDistanceToNow } from 'date-fns';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';
import { unlink } from 'fs/promises';

const { User, Timetable, Assignment, AssignmentSubmission, StudentAttendance: Attendance, Notification, Class, Section, Subject, sequelize } = models;

const normalizeAssignmentStatus = (status, isPublished = false) => {
  if (!status) return isPublished ? 'published' : 'draft';

  const normalized = String(status).toLowerCase();
  if (normalized === 'active') return 'published';
  if (normalized === 'publish') return 'published';
  if (normalized === 'unpublished') return 'draft';
  if (normalized === 'inactive') return 'archived';
  if (['draft', 'published', 'archived'].includes(normalized)) return normalized;

  return isPublished ? 'published' : 'draft';
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resolveValidSectionId = async (sectionId, instituteId, classId = null, transaction = null) => {
  if (!sectionId || !UUID_REGEX.test(String(sectionId))) return null;

  // Section model uses school_id, not institute_id
  const where = { id: sectionId, school_id: instituteId };
  if (classId && UUID_REGEX.test(String(classId))) where.class_id = classId;

  const existing = await Section.findOne({ where, attributes: ['id'], transaction });
  if (existing?.id) return existing.id;

  // Fallback: some campuses keep sections only in Class.sections JSONB.
  // If selected section exists there, materialize it into sections table.
  if (classId && UUID_REGEX.test(String(classId))) {
    const cls = await Class.findOne({
      where: { id: classId, school_id: instituteId },
      attributes: ['id', 'academic_year_id', 'sections'],
      transaction
    });

    const jsonSections = Array.isArray(cls?.sections) ? cls.sections : [];
    const matched = jsonSections.find((s) => String(s?.id || s?.section_id || '') === String(sectionId));

    if (matched && cls?.academic_year_id) {
      try {
        await Section.create({
          id: sectionId,
          school_id: instituteId,
          class_id: classId,
          academic_year_id: cls.academic_year_id,
          name: String(matched?.name || matched?.section_name || 'Section').slice(0, 10),
          capacity: Number.isFinite(Number(matched?.capacity)) ? Number(matched.capacity) : 30,
          room_number: matched?.room_no || matched?.room_number || null,
          is_active: matched?.is_active !== false
        }, { transaction });
      } catch {
        // Ignore race/duplicate and re-check below.
      }

      const hydrated = await Section.findOne({
        where: { id: sectionId, school_id: instituteId },
        attributes: ['id'],
        transaction
      });
      return hydrated?.id || null;
    }
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get complete teacher dashboard
 */
export const getTeacherDashboard = async (teacherId, instituteId) => {
  const today = new Date();
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);

  const [
    teacher,
    todaySchedule,
    myClasses,
    myStudents,
    recentAssignments,
    pendingWork,
    recentActivity,
    statistics
  ] = await Promise.all([
    getTeacherProfile(teacherId, instituteId),
    getTodaySchedule(teacherId, instituteId),
    getMyClasses(teacherId, instituteId),
    getMyStudents(teacherId, instituteId),
    getRecentAssignments(teacherId, instituteId, 5),
    getPendingWork(teacherId, instituteId),
    getRecentActivity(teacherId, instituteId),
    getTeacherStats(teacherId, instituteId)
  ]);

  return {
    teacher,
    today_schedule: todaySchedule,
    my_classes: myClasses,
    my_students: myStudents.data || [],
    recent_assignments: recentAssignments,
    pending_work: pendingWork,
    recent_activity: recentActivity,
    statistics,
    quick_actions: [
      { label: 'Mark Attendance', icon: 'CheckSquare', href: '/attendance/mark', count: todaySchedule.length },
      { label: 'Create Assignment', icon: 'FileText', href: '/assignments/create' },
      { label: 'Grade Submissions', icon: 'Award', href: '/assignments/grade', count: pendingWork.length },
      { label: 'View Timetable', icon: 'Calendar', href: '/timetable' }
    ]
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get teacher profile
 */
export const getTeacherProfile = async (teacherId, instituteId) => {
  const teacher = await User.findOne({
    where: { id: teacherId, school_id: instituteId, user_type: 'TEACHER' },
    include: [
      { model: models.Role, as: 'Role', attributes: ['id', 'name', 'permissions'] }
    ],
    attributes: { exclude: ['password_hash', 'password_reset_token'] }
  });

  if (!teacher) throw new Error('Teacher not found');

  return {
    id: teacher.id,
    first_name: teacher.first_name,
    last_name: teacher.last_name,
    email: teacher.email,
    phone: teacher.phone,
    registration_no: teacher.registration_no,
    avatar: teacher.avatar_url,
    role: teacher.Role?.name,
    details: teacher.details?.teacherDetails || {},
    documents: teacher.documents || [],
    created_at: teacher.created_at
  };
};

/**
 * Update teacher profile
 */
export const updateTeacherProfile = async (teacherId, instituteId, updateData, file = null) => {
  const teacher = await User.findOne({
    where: { id: teacherId, school_id: instituteId, user_type: 'TEACHER' }
  });

  if (!teacher) throw new Error('Teacher not found');

  let avatarUrl = teacher.avatar_url;
  let avatarPublicId = teacher.avatar_public_id;

  // Upload new avatar
  if (file) {
    try {
      const folder = `the-clouds-academy/${instituteId}/teachers/avatars`;
      const result = await uploadToCloudinary(file.path, folder, {
        transformation: [{ width: 300, height: 300, crop: 'thumb' }]
      });

      avatarUrl = result.url;
      
      if (teacher.avatar_public_id) {
        await deleteFromCloudinary(teacher.avatar_public_id).catch(() => {});
      }
      avatarPublicId = result.public_id;
    } finally {
      try { await unlink(file.path); } catch { /* ignore */ }
    }
  }

  // Update basic fields
  const updatableFields = ['first_name', 'last_name', 'phone', 'email'];
  updatableFields.forEach(field => {
    if (updateData[field] !== undefined) {
      teacher[field] = updateData[field];
    }
  });

  // Update teacher details in JSONB
  if (updateData.details) {
    teacher.details = {
      ...teacher.details,
      teacherDetails: {
        ...teacher.details?.teacherDetails,
        ...updateData.details
      }
    };
  }

  if (avatarUrl) {
    teacher.avatar_url = avatarUrl;
    teacher.avatar_public_id = avatarPublicId;
  }

  await teacher.save();
  return getTeacherProfile(teacherId, instituteId);
};

// ─────────────────────────────────────────────────────────────────────────────
// MY CLASSES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get classes taught by teacher
 */
export const getMyClasses = async (teacherId, instituteId) => {
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });

  const classesMap = new Map();
  const classIds = new Set();
  const slotAssignedClassIds = new Set();
  const sectionIds = new Set();

  timetables.forEach(timetable => {
    const slots = timetable.slots || [];
    const teacherSlots = slots.filter(slot => slot.teacher_id === teacherId);

    if (teacherSlots.length > 0) {
      const classId = timetable.entity_ids?.class_id || timetable.id;
      classIds.add(classId);
      if (timetable.entity_ids?.section_id) sectionIds.add(timetable.entity_ids.section_id);
      const className = getEntityName(timetable.entity_ids);
      
      if (!classesMap.has(classId)) {
        classesMap.set(classId, {
          id: classId,
          class_id: classId,
          timetable_id: timetable.id,
          name: className,
          class_name: className,
          type: timetable.entity_type,
          subjects: new Set(),
          schedule: [],
          student_count: 0,
          sections: new Map(),
          section_ids: new Set(),
          section_name: timetable.entity_ids?.section_name || null
        });
      }

      const classData = classesMap.get(classId);
      if (timetable.entity_ids?.section_id) {
        classData.section_ids.add(timetable.entity_ids.section_id);
        classData.sections.set(
          timetable.entity_ids.section_id,
          timetable.entity_ids?.section_name || `Section ${classData.sections.size + 1}`
        );
      }
      teacherSlots.forEach(slot => {
        if (slot.subject_name) {
          classData.subjects.add(slot.subject_name);
        }
        const [startTime, endTime] = resolveSlotTime(slot, timetable.period_config);
        classData.schedule.push({
          day: slot.day,
          time: `${startTime} - ${endTime}`,
          start_time: startTime,
          end_time: endTime,
          subject: slot.subject_name,
          room: slot.room_no
        });
      });
    }
  });

  const [classRows, sectionRows, subjectRows] = await Promise.all([
    classIds.size
      ? Class.findAll({ where: { id: { [Op.in]: Array.from(classIds) }, school_id: instituteId }, attributes: ['id', 'name', 'courses', 'sections'] })
      : [],
    classIds.size
      ? Section.findAll({
        where: {
          school_id: instituteId,
          class_id: { [Op.in]: Array.from(classIds) },
          is_active: true
        },
        attributes: ['id', 'name', 'class_id']
      })
      : [],
    classIds.size
      ? Subject.findAll({
        where: {
          school_id: instituteId,
          class_id: { [Op.in]: Array.from(classIds) },
          is_active: true,
          [Op.or]: [{ teacher_id: teacherId }, { teacher_id: null }]
        },
        attributes: ['id', 'class_id', 'name', 'code']
      })
      : []
  ]);

  const classNameMap = new Map(classRows.map((row) => [row.id, row.name]));
  const classCoursesMap = new Map(classRows.map((row) => [row.id, row.courses || []]));
  const classSectionsJsonbMap = new Map(classRows.map((row) => [row.id, row.sections || []]));
  const sectionsByClassMap = sectionRows.reduce((acc, row) => {
    if (!acc[row.class_id]) acc[row.class_id] = [];
    acc[row.class_id].push({ id: row.id, name: row.name });
    return acc;
  }, {});

  // Build section name map: first from Section table, then enrich from Class JSONB sections
  const sectionNameMap = new Map(sectionRows.map((row) => [row.id, row.name]));
  for (const row of classRows) {
    for (const s of (row.sections || [])) {
      if (s.id && s.name && !sectionNameMap.has(s.id)) {
        sectionNameMap.set(s.id, s.name);
      }
    }
  }

  const subjectsByClass = subjectRows.reduce((acc, row) => {
    if (!acc[row.class_id]) acc[row.class_id] = [];
    acc[row.class_id].push({
      id: row.id,
      name: row.name,
      code: row.code,
      syllabus: null,
      materials: []
    });
    return acc;
  }, {});

  // Get student counts
  const result = [];
  for (const [, data] of classesMap) {
    const where = {
      school_id: instituteId,
      user_type: 'STUDENT',
      is_active: true,
      'details.class_id': data.id
    };
    const sectionIds = Array.from(data.section_ids || []);
    if (sectionIds.length) {
      where['details.section_id'] = { [Op.in]: sectionIds };
    }

    const studentCount = await User.count({ where });

    const normalizedClassName = classNameMap.get(data.class_id) || data.class_name || data.name || 'Class';
    let normalizedSections = Array.from(data.sections.entries()).map(([id, fallbackName]) => ({
      id,
      name: sectionNameMap.get(id) || fallbackName || 'Section'
    }));

    // If timetable had no section_id, fall back to class's JSONB sections array
    if (normalizedSections.length === 0) {
      const dbSections = sectionsByClassMap[data.class_id] || [];
      if (dbSections.length) {
        normalizedSections = dbSections;
      }
    }

    // Final fallback when Section table doesn't have records for this class
    if (normalizedSections.length === 0) {
      const jsonbSections = classSectionsJsonbMap.get(data.class_id) || [];
      normalizedSections = jsonbSections
        .filter((s) => s.name)
        .map((s) => ({ id: s.id || null, name: s.name }));
    }

    // Build course name → syllabus/material/id lookup from Class JSONB courses
    const coursesJsonb = classCoursesMap.get(data.class_id) || [];
    const courseMetaMap = {};
    for (const c of coursesJsonb) {
      if (c.name) {
        const key = c.name.toLowerCase();
        const materials = Array.isArray(c.materials)
          ? c.materials
            .map((m) => {
              if (typeof m === 'string') return { name: m };
              if (m?.name || m?.title || m?.file_name || m?.url || m?.file_url || m?.download_url || m?.pdf_url) {
                return {
                  name: m.name || m.title || m.file_name || 'Material File',
                  type: m.type || m.mime_type || null,
                  url: m.url || m.file_url || m.download_url || m.pdf_url || null
                };
              }
              return null;
            })
            .filter(Boolean)
          : [];

        let syllabus = null;
        if (c.description) {
          syllabus = c.description;
        } else if (c.materials?.length) {
          syllabus = `${c.materials.length} material${c.materials.length !== 1 ? 's' : ''}`;
        }

        courseMetaMap[key] = { 
          id: c.id || null,
          code: c.course_code || c.code || null,
          syllabus, 
          materials 
        };
      }
    }

    const subjectDetailsFromDB = (subjectsByClass[data.class_id] || []).map((sub) => ({
      ...sub,
      syllabus: courseMetaMap[sub.name?.toLowerCase()]?.syllabus || null,
      materials: courseMetaMap[sub.name?.toLowerCase()]?.materials || []
    }));
    const fallbackSubjectDetails = Array.from(data.subjects).map((name) => {
      const meta = courseMetaMap[name?.toLowerCase()] || {};
      return {
        id: meta.id || null,
        name,
        code: meta.code || null,
        syllabus: meta.syllabus || null,
        materials: meta.materials || []
      };
    });
    const subjectDetails = subjectDetailsFromDB.length ? subjectDetailsFromDB : fallbackSubjectDetails;

    result.push({
      ...data,
      name: normalizedClassName,
      class_name: normalizedClassName,
      subjects: subjectDetails.map((s) => s.name),
      subject_details: subjectDetails,
      sections: normalizedSections,
      section_ids: sectionIds,
      student_count: studentCount,
      schedule: data.schedule.slice(0, 5)
    });
  }

  return result;
};

/**
 * Get class details by ID
 */
export const getClassDetails = async (classId, teacherId, instituteId) => {
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });

  const timetable = timetables.find((t) => {
    const isMatch = t.id === classId || t.entity_ids?.class_id === classId;
    const teacherSlot = (t.slots || []).some((s) => s.teacher_id === teacherId);
    return isMatch && teacherSlot;
  });

  if (!timetable) throw new Error('Class not found');

  // Get students in this class
  const studentWhere = {
    school_id: instituteId,
    user_type: 'STUDENT',
    is_active: true,
    'details.class_id': timetable.entity_ids?.class_id
  };
  if (timetable.entity_ids?.section_id) {
    studentWhere['details.section_id'] = timetable.entity_ids.section_id;
  }

  const students = await User.findAll({
    where: studentWhere,
    attributes: ['id', 'first_name', 'last_name', 'registration_no', 'avatar_url', 'details'],
    limit: 50
  });

  // Get subjects taught
  const subjects = [...new Set((timetable.slots || [])
    .filter(s => s.teacher_id === teacherId)
    .map(s => s.subject_name))];

  return {
    id: timetable.id,
    name: getEntityName(timetable.entity_ids),
    type: timetable.entity_type,
    subjects,
    students: students.map(s => ({
      id: s.id,
      name: `${s.first_name} ${s.last_name}`,
      registration_no: s.registration_no,
      avatar: s.avatar_url,
      roll_number: s.details?.roll_number
    })),
    schedule: (timetable.slots || [])
      .filter(s => s.teacher_id === teacherId)
      .sort((a, b) => a.day?.localeCompare(b.day || ''))
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MY STUDENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all students taught by teacher
 */
export const getMyStudents = async (teacherId, instituteId, filters = {}, pagination = {}) => {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  // Get all classes this teacher teaches
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });

  const classIds = new Set();
  const slotAssignedClassIds = new Set();
  const classSectionMap = new Map();
  const classNoSectionAccess = new Set();
  const classNameSectionMap = new Map();
  const classNameNoSectionAccess = new Set();

  // Include class/section ownership assignments (without slot dependency)
  const [ownedClasses, ownedSections] = await Promise.all([
    Class.findAll({
      where: { school_id: instituteId, class_teacher_id: teacherId, is_active: true },
      attributes: ['id']
    }),
    Section.findAll({
      where: { school_id: instituteId, section_teacher_id: teacherId, is_active: true },
      attributes: ['id', 'class_id']
    })
  ]);

  ownedClasses.forEach((cls) => {
    const classId = cls.id;
    classIds.add(classId);
    if (!classSectionMap.has(classId)) classSectionMap.set(classId, new Set());
    classNoSectionAccess.add(classId);
  });

  ownedSections.forEach((sec) => {
    const classId = sec.class_id;
    if (!classId) return;
    classIds.add(classId);
    if (!classSectionMap.has(classId)) classSectionMap.set(classId, new Set());
    classSectionMap.get(classId).add(sec.id);
  });

  timetables.forEach(timetable => {
    const slots = timetable.slots || [];
    const teacherSlots = slots.filter((slot) => String(slot.teacher_id || '') === String(teacherId));
    const timetableCreatedByTeacher = String(timetable.created_by || '') === String(teacherId);
    const hasTeacherAssignment = teacherSlots.length > 0 || timetableCreatedByTeacher;

    if (hasTeacherAssignment && timetable.entity_ids?.class_id) {
      const classId = timetable.entity_ids.class_id;
      classIds.add(classId);
      if (teacherSlots.length > 0) {
        slotAssignedClassIds.add(classId);
      }

      if (!classSectionMap.has(classId)) {
        classSectionMap.set(classId, new Set());
      }

      const sectionsForClass = classSectionMap.get(classId);
      if (timetable.entity_ids?.section_id) {
        sectionsForClass.add(timetable.entity_ids.section_id);
      }

      teacherSlots.forEach((slot) => {
        if (slot.section_id) {
          sectionsForClass.add(slot.section_id);
        }
      });

      if (sectionsForClass.size === 0) {
        classNoSectionAccess.add(classId);
      }
    }

    // Fallback for legacy/partial timetables that only store names
    const className = String(timetable.entity_ids?.class_name || '').trim().toLowerCase();
    const sectionName = String(timetable.entity_ids?.section_name || '').trim().toLowerCase();
    if (hasTeacherAssignment && className) {
      if (!classNameSectionMap.has(className)) {
        classNameSectionMap.set(className, new Set());
      }

      const sectionsForClassName = classNameSectionMap.get(className);
      if (sectionName) {
        sectionsForClassName.add(sectionName);
      }

      if (sectionsForClassName.size === 0) {
        classNameNoSectionAccess.add(className);
      }
    }
  });

  // If teacher has slot assignment in a class, include all timetable-defined sections of that class.
  // This helps when section-level timetable entries exist but one section has no explicit slot records.
  timetables.forEach((timetable) => {
    const classId = timetable.entity_ids?.class_id;
    const sectionId = timetable.entity_ids?.section_id;
    if (!classId || !sectionId) return;
    if (!slotAssignedClassIds.has(classId)) return;

    if (!classSectionMap.has(classId)) classSectionMap.set(classId, new Set());
    classSectionMap.get(classId).add(sectionId);
  });

  if (classIds.size === 0) {
    return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } };
  }

  const where = {
    school_id: instituteId,
    user_type: 'STUDENT',
    is_active: true,
  };

  if (filters.search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${filters.search}%` } },
      { last_name: { [Op.iLike]: `%${filters.search}%` } },
      { registration_no: { [Op.iLike]: `%${filters.search}%` } }
    ];
  }

  const rows = await User.findAll({
    where,
    attributes: ['id', 'first_name', 'last_name', 'registration_no', 'avatar_url', 'details'],
    order: [['first_name', 'ASC']]
  });

  // Filter by classes/sections from teacher timetable using nested studentDetails
  const filteredRows = rows.filter((student) => {
    const details = student.details?.studentDetails || {};
    const classId = details.class_id;
    const sectionId = details.section_id;
    const className = String(details.class_name || '').trim().toLowerCase();
    const sectionName = String(details.section_name || '').trim().toLowerCase();

    const inTeacherClass = classId && classIds.has(classId);
    const classSections = classSectionMap.get(classId) || new Set();
    const hasClassSectionRestriction = classSections.size > 0;
    const inTeacherSection = hasClassSectionRestriction
      ? !!sectionId && classSections.has(sectionId)
      : classNoSectionAccess.has(classId);

    const nameSections = classNameSectionMap.get(className) || new Set();
    const hasNameSectionRestriction = nameSections.size > 0;
    const inTeacherClassByName = !!className && classNameSectionMap.has(className);
    const inTeacherSectionByName = hasNameSectionRestriction
      ? !!sectionName && nameSections.has(sectionName)
      : classNameNoSectionAccess.has(className);

    const inTeacherScope = (inTeacherClass && inTeacherSection) || (inTeacherClassByName && inTeacherSectionByName);
    const classFilterOk = !filters.class_id || classId === filters.class_id;

    return inTeacherScope && classFilterOk;
  });

  const pagedRows = filteredRows.slice(offset, offset + limit);

  // Get attendance stats for each student
  const studentsWithStats = await Promise.all(
    pagedRows.map(async (student) => {
      const details = student.details?.studentDetails || {};
      const attendance = await getStudentAttendanceStats(student.id, instituteId);
      return {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        first_name: student.first_name,
        last_name: student.last_name,
        registration_no: student.registration_no,
        avatar: student.avatar_url,
        class_id: details.class_id || null,
        class: details.class_name || null,
        class_name: details.class_name || null,
        section_id: details.section_id || null,
        section: details.section_name || null,
        section_name: details.section_name || null,
        roll_no: details.roll_no || details.roll_number || null,
        roll_number: details.roll_number || details.roll_no || null,
        guardians: details.guardians || [],
        attendance_percentage: attendance.percentage,
        last_attendance: attendance.last_date
      };
    })
  );

  return {
    data: studentsWithStats,
    pagination: {
      total: filteredRows.length,
      page,
      limit,
      totalPages: Math.ceil(filteredRows.length / limit)
    }
  };
};

/**
 * Get single student details for teacher
 */
export const getStudentDetails = async (studentId, teacherId, instituteId) => {
  // Verify teacher teaches this student
  const student = await User.findOne({
    where: { id: studentId, school_id: instituteId, user_type: 'STUDENT' }
  });

  if (!student) throw new Error('Student not found');

  const studentDetails = student.details?.studentDetails || {};
  const studentClassId = studentDetails.class_id;
  const studentSectionId = studentDetails.section_id;
  const studentClassName = String(studentDetails.class_name || '').trim().toLowerCase();
  const studentSectionName = String(studentDetails.section_name || '').trim().toLowerCase();

  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });

  const [ownedClass, ownedSection] = await Promise.all([
    studentClassId
      ? Class.findOne({
        where: { id: studentClassId, school_id: instituteId, class_teacher_id: teacherId, is_active: true },
        attributes: ['id']
      })
      : null,
    studentSectionId
      ? Section.findOne({
        where: { id: studentSectionId, school_id: instituteId, section_teacher_id: teacherId, is_active: true },
        attributes: ['id']
      })
      : null
  ]);

  const teachesViaOwnership = !!ownedClass || !!ownedSection;

  const teachesViaTimetable = timetables.some((timetable) => {
    const timetableClassId = timetable.entity_ids?.class_id;
    const timetableSectionId = timetable.entity_ids?.section_id;
    const timetableClassName = String(timetable.entity_ids?.class_name || '').trim().toLowerCase();
    const timetableSectionName = String(timetable.entity_ids?.section_name || '').trim().toLowerCase();

    const idClassMatch = !!studentClassId && timetableClassId === studentClassId;
    const nameClassMatch = !!studentClassName && timetableClassName === studentClassName;
    if (!idClassMatch && !nameClassMatch) return false;

    const teacherSlots = (timetable.slots || []).filter((slot) => String(slot.teacher_id || '') === String(teacherId));
    if (teacherSlots.length === 0) return false;

    const slotSections = teacherSlots.map((slot) => slot.section_id).filter(Boolean);

    if (timetableSectionId && studentSectionId) return timetableSectionId === studentSectionId;
    if (timetableSectionName && studentSectionName) return timetableSectionName === studentSectionName;
    if (slotSections.length > 0 && studentSectionId) return slotSections.includes(studentSectionId);

    // If no section on timetable/slot, class-level access applies.
    return true;
  });

  const teachesStudent = teachesViaOwnership || teachesViaTimetable;

  if (!teachesStudent) {
    throw new Error('You do not teach this student');
  }

  // Get complete student data
  const [
    attendance,
    assignments,
    results,
    profile
  ] = await Promise.all([
    getStudentAttendanceHistory(studentId, instituteId),
    getStudentAssignments(studentId, instituteId),
    getStudentResults(studentId, instituteId),
    getStudentProfile(studentId, instituteId)
  ]);

  return {
    profile,
    attendance,
    assignments,
    results
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create assignment - FIXED for Native PDF View
 */
export const createAssignment = async (teacherId, instituteId, data, files = []) => {
  const transaction = await sequelize.transaction();

  try {
    // Upload attachments
    const attachments = [];
    if (files?.length) {
      for (const file of files) {
        // Folder structure
        const folder = `the-clouds-academy/${instituteId}/assignments/${Date.now()}`;
        
        // CRITICAL FIX: resource_type 'raw' ensures PDF stays as PDF, not Image
        const result = await uploadToCloudinary(file.path, folder, {
          resource_type: 'raw', 
          use_filename: true,
          unique_filename: true
        });

        attachments.push({
          id: uuidv4(),
          name: file.originalname,
          url: result.url,
          public_id: result.public_id,
          size: file.size,
          type: file.mimetype
        });

        try { await unlink(file.path); } catch { /* ignore */ }
      }
    }

    const validSectionId = await resolveValidSectionId(
      data.section_id,
      instituteId,
      data.class_id || null,
      transaction
    );

    if (data.section_id && !validSectionId) {
      throw new Error('Selected section is invalid for the selected class');
    }

    const normalizedTargetType = data.target_type
      || (validSectionId ? 'section' : data.class_id ? 'class' : data.student_id ? 'individual' : 'all');

    const normalizedTargetIds = Array.isArray(data.target_ids)
      ? data.target_ids
      : (validSectionId ? [validSectionId]
        : data.class_id ? [data.class_id]
        : data.student_id ? [data.student_id]
        : []);

    const isPublished = data.is_published === 'true' || data.is_published === true || data.status === 'published';

    let totalStudents = 0;
    if (normalizedTargetType === 'class' && normalizedTargetIds?.length) {
      totalStudents = await User.count({
        where: {
          school_id: instituteId,
          user_type: 'STUDENT',
          is_active: true,
          'details.class_id': { [Op.in]: normalizedTargetIds }
        }
      });
    }

    const assignmentStatus = normalizeAssignmentStatus(data.status, isPublished);

    const assignment = await Assignment.create({
      id: uuidv4(),
      institute_id: instituteId,
      teacher_id: teacherId,
      title: data.title,
      description: data.description,
      target_type: normalizedTargetType,
      target_ids: normalizedTargetIds,
      class_id: data.class_id || null,
      section_id: validSectionId,
      academic_year_id: data.academic_year_id || null,
      type: data.type || 'homework',
      subject: data.subject,
      subject_id: data.subject_id,
      due_date: data.due_date,
      due_time: data.due_time,
      total_marks: data.total_marks ? parseInt(data.total_marks) : null,
      instructions: data.instructions,
      attachments,
      is_published: isPublished,
      status: assignmentStatus,
      assigned_on: data.assigned_on || new Date(),
      published_at: isPublished ? new Date() : null,
      stats: {
        total_students: totalStudents,
        submitted: 0,
        pending: totalStudents,
        graded: 0,
        average_score: 0
      },
      created_by: teacherId
    }, { transaction });

    await transaction.commit();
    return assignment;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Update assignment - FIXED with Attachment Management
 */
export const updateAssignment = async (assignmentId, teacherId, instituteId, data, files = []) => {
  const transaction = await sequelize.transaction();

  try {
    const assignment = await Assignment.findOne({
      where: { id: assignmentId, institute_id: instituteId, teacher_id: teacherId },
      transaction
    });

    if (!assignment) throw new Error('Assignment not found');

    // --- ATTACHMENT MANAGEMENT LOGIC ---
    let currentAttachments = Array.isArray(assignment.attachments) ? [...assignment.attachments] : [];

    // 1. Delete requested attachments
    if (data.remove_attachments) {
      const idsToRemove = Array.isArray(data.remove_attachments) 
        ? data.remove_attachments 
        : JSON.parse(data.remove_attachments);

      for (const id of idsToRemove) {
        const fileToDelete = currentAttachments.find(a => a.id === id);
        if (fileToDelete && fileToDelete.public_id) {
          // Delete from Cloudinary
          await deleteFromCloudinary(fileToDelete.public_id).catch(err => console.error("Cloudinary Delete Error:", err));
        }
        // Remove from local array
        currentAttachments = currentAttachments.filter(a => a.id !== id);
      }
    }

    // 2. Upload new files (Strictly as RAW for PDF viewer)
    if (files?.length) {
      for (const file of files) {
        const folder = `the-clouds-academy/${instituteId}/assignments/${Date.now()}`;
        const result = await uploadToCloudinary(file.path, folder, {
          resource_type: 'raw', // Native viewer support
          use_filename: true,
          unique_filename: true
        });

        currentAttachments.push({
          id: uuidv4(),
          name: file.originalname,
          url: result.url,
          public_id: result.public_id,
          size: file.size,
          type: file.mimetype
        });

        try { await unlink(file.path); } catch { /* ignore */ }
      }
    }
    // ------------------------------------

    const nextClassId = data.class_id !== undefined ? (data.class_id || null) : assignment.class_id;
    const nextIsPublished = data.is_published !== undefined ? (data.is_published === 'true' || data.is_published === true) : assignment.is_published;
    const nextSectionId = data.section_id !== undefined ? await resolveValidSectionId(data.section_id, instituteId, nextClassId, transaction) : assignment.section_id;

    await assignment.update({
      title: data.title ?? assignment.title,
      description: data.description ?? assignment.description,
      subject: data.subject ?? assignment.subject,
      due_date: data.due_date ?? assignment.due_date,
      due_time: data.due_time ?? assignment.due_time,
      class_id: nextClassId,
      section_id: nextSectionId,
      is_published: nextIsPublished,
      status: normalizeAssignmentStatus(data.status ?? assignment.status, nextIsPublished),
      attachments: currentAttachments, // Updated list
      updated_at: new Date()
    }, { transaction });

    await transaction.commit();
    return assignment;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Get teacher's assignments
 */
export const getMyAssignments = async (teacherId, instituteId, filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const where = {
    institute_id: instituteId,
    teacher_id: teacherId
  };

  if (filters.type) where.type = filters.type;
  if (filters.subject) where.subject = filters.subject;
  if (filters.status === 'published') where.is_published = true;
  if (filters.status === 'draft') where.is_published = false;

  if (filters.search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${filters.search}%` } },
      { description: { [Op.iLike]: `%${filters.search}%` } }
    ];
  }

  const { count, rows } = await Assignment.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset
  });

  return {
    data: rows,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    }
  };
};


/**
 * Delete assignment and all linked submissions/files
 */
export const deleteAssignment = async (assignmentId, teacherId, instituteId) => {
  const transaction = await sequelize.transaction();

  try {
    const assignment = await Assignment.findOne({
      where: {
        id: assignmentId,
        institute_id: instituteId,
        teacher_id: teacherId
      },
      transaction
    });

    if (!assignment) throw new Error('Assignment not found');

    if (assignment.attachments?.length) {
      for (const attachment of assignment.attachments) {
        if (attachment.public_id) {
          await deleteFromCloudinary(attachment.public_id).catch(() => {});
        }
      }
    }

    const submissions = await AssignmentSubmission.findAll({
      where: { assignment_id: assignmentId },
      transaction
    });

    for (const submission of submissions) {
      if (submission.files?.length) {
        for (const file of submission.files) {
          if (file.public_id) {
            await deleteFromCloudinary(file.public_id).catch(() => {});
          }
        }
      }
    }

    await AssignmentSubmission.destroy({ where: { assignment_id: assignmentId }, transaction });
    await assignment.destroy({ transaction });
    await transaction.commit();

    return { id: assignmentId, deleted: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Get assignment with submissions
 */
export const getAssignmentWithSubmissions = async (assignmentId, teacherId, instituteId) => {
  const assignment = await Assignment.findOne({
    where: {
      id: assignmentId,
      institute_id: instituteId,
      teacher_id: teacherId
    },
    include: [
      {
        model: User,
        as: 'submissions',
        through: { attributes: ['id', 'submitted_at', 'marks', 'grade', 'feedback', 'status', 'files', 'submission_text'] },
        attributes: ['id', 'first_name', 'last_name', 'registration_no', 'avatar_url']
      }
    ]
  });

  if (!assignment) throw new Error('Assignment not found');

  return assignment;
};

/**
 * Grade submission
 */
export const gradeSubmission = async (submissionId, gradeData, teacherId) => {
  let submission = await AssignmentSubmission.findOne({
    where: { id: submissionId },
    include: [{ model: Assignment, as: 'assignment' }]
  });

  // Backward-compatible fallback: resolve using assignment + student
  // if caller passed student id instead of submission id.
  if (!submission && gradeData?.assignment_id && gradeData?.student_id) {
    submission = await AssignmentSubmission.findOne({
      where: {
        assignment_id: gradeData.assignment_id,
        student_id: gradeData.student_id
      },
      include: [{ model: Assignment, as: 'assignment' }],
      order: [['submitted_at', 'DESC']]
    });
  }

  if (!submission) throw new Error('Submission not found');
  if (submission.assignment.teacher_id !== teacherId) {
    throw new Error('You are not authorized to grade this submission');
  }

  submission.marks = gradeData.marks;
  submission.feedback = gradeData.feedback;
  submission.graded_at = new Date();
  submission.graded_by = teacherId;
  submission.status = 'graded';

  await submission.save();

  // Update assignment stats
  await updateAssignmentStats(submission.assignment_id);

  return submission;
};

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark attendance for a class
 */
export const markAttendance = async (teacherId, instituteId, data) => {
  const transaction = await sequelize.transaction();

  try {
    const { class_id, date, attendance: attendanceList } = data;

    // Verify teacher teaches this class
    const timetable = await Timetable.findOne({
      where: {
        school_id: instituteId,
        is_active: true,
        'entity_ids.class_id': class_id
      }
    });

    if (!timetable || !(timetable.slots || []).some(s => s.teacher_id === teacherId)) {
      throw new Error('You do not teach this class');
    }

    // Delete existing attendance for this date and class
    await Attendance.destroy({
      where: {
        school_id: instituteId,
        class_id,
        date
      },
      transaction
    });

    // Create new attendance records
    const attendanceRecords = attendanceList.map(a => ({
      id: uuidv4(),
      school_id: instituteId,
      class_id,
      student_id: a.student_id,
      date,
      status: a.status,
      marked_by: teacherId,
      marked_at: new Date()
    }));

    await Attendance.bulkCreate(attendanceRecords, { transaction });

    await transaction.commit();
    return { message: 'Attendance marked successfully', count: attendanceRecords.length };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Get attendance for a class on a date
 */
export const getClassAttendance = async (teacherId, instituteId, classId, date) => {
  // Verify teacher teaches this class
  const timetable = await Timetable.findOne({
    where: {
      school_id: instituteId,
      is_active: true,
      'entity_ids.class_id': classId
    }
  });

  if (!timetable || !(timetable.slots || []).some(s => s.teacher_id === teacherId)) {
    throw new Error('You do not teach this class');
  }

  const attendance = await Attendance.findAll({
    where: {
      school_id: instituteId,
      class_id: classId,
      date
    },
    include: [
      {
        model: User,
        as: 'Student',
        attributes: ['id', 'first_name', 'last_name', 'registration_no']
      }
    ]
  });

  return attendance;
};

// ─────────────────────────────────────────────────────────────────────────────
// TIMETABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get teacher's weekly timetable
 */
export const getMyTimetable = async (teacherId, instituteId, weekStart = null) => {
  const startDate = weekStart ? new Date(weekStart) : startOfWeek(new Date());
  const endDate = endOfWeek(startDate);

  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const schedule = {};
  const classIds = new Set();
  const sectionIds = new Set();

  days.forEach(day => { schedule[day] = []; });

  timetables.forEach((timetable) => {
    if (timetable.entity_ids?.class_id) classIds.add(timetable.entity_ids.class_id);
    if (timetable.entity_ids?.section_id) sectionIds.add(timetable.entity_ids.section_id);
  });

  const [classRows, sectionRows] = await Promise.all([
    classIds.size
      ? Class.findAll({ where: { id: { [Op.in]: Array.from(classIds) }, school_id: instituteId }, attributes: ['id', 'name', 'sections'] })
      : [],
    sectionIds.size
      ? Section.findAll({ where: { id: { [Op.in]: Array.from(sectionIds) }, school_id: instituteId }, attributes: ['id', 'name'] })
      : []
  ]);

  const classNameMap = new Map(classRows.map((row) => [row.id, row.name]));
  // Build section name map: first from Section table, then enrich from Class JSONB sections
  const sectionNameMap = new Map(sectionRows.map((row) => [row.id, row.name]));
  for (const row of classRows) {
    for (const s of (row.sections || [])) {
      if (s.id && s.name && !sectionNameMap.has(s.id)) {
        sectionNameMap.set(s.id, s.name);
      }
    }
  }

  timetables.forEach(timetable => {
    const slots = timetable.slots || [];
    const teacherSlots = slots.filter(slot => slot.teacher_id === teacherId);

    teacherSlots.forEach(slot => {
      if (days.includes(slot.day)) {
        const [startTime, endTime] = resolveSlotTime(slot, timetable.period_config);
        const classId = timetable.entity_ids?.class_id || null;
        const sectionId = timetable.entity_ids?.section_id || null;
        const resolvedClassName = classId ? (classNameMap.get(classId) || timetable.entity_ids?.class_name || 'Class') : getEntityName(timetable.entity_ids);
        const resolvedSectionName = sectionId ? (sectionNameMap.get(sectionId) || timetable.entity_ids?.section_name || null) : null;
        schedule[slot.day].push({
          id: slot.id,
          period: slot.period,
          start_time: startTime,
          end_time: endTime,
          subject: slot.subject_name,
          class: resolvedSectionName ? `${resolvedClassName} - ${resolvedSectionName}` : resolvedClassName,
          class_id: classId,
          section_id: sectionId,
          section_name: resolvedSectionName,
          room: slot.room_no
        });
      }
    });
  });

  // Sort each day by time
  Object.keys(schedule).forEach(day => {
    schedule[day].sort((a, b) => a.start_time?.localeCompare(b.start_time || ''));
  });

  return schedule;
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get notices for teacher
 */
export const getNotices = async (teacherId, instituteId, limit = 10) => {
  const notices = await Notification.findAll({
    where: {
      school_id: instituteId,
      [Op.or]: [{ user_id: null }, { user_id: teacherId }]
    },
    include: [
      {
        model: User,
        attributes: ['id', 'first_name', 'last_name'],
        required: false
      }
    ],
    order: [['created_at', 'DESC']],
    limit
  });

  return notices.map((notice) => ({
    id: notice.id,
    title: notice.title,
    content: notice.body,
    category: notice.type === 'exam' ? 'Exam' : 'General',
    priority: notice.type === 'alert' ? 'high' : notice.type === 'system' ? 'medium' : 'low',
    date: notice.created_at,
    author: notice.User ? `${notice.User.first_name} ${notice.User.last_name}` : 'Administration'
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const getEntityName = (entityIds) => {
  if (!entityIds) return 'Unknown';
  if (entityIds.class_name && entityIds.section_name) return `${entityIds.class_name} - ${entityIds.section_name}`;
  if (entityIds.class_name) return entityIds.class_name;
  if (entityIds.course_name) return entityIds.course_name;
  if (entityIds.program_name) return entityIds.program_name;
  return 'Class';
};

const getTodaySchedule = async (teacherId, instituteId) => {
  const today = format(new Date(), 'EEEE').toLowerCase();
  const timetables = await Timetable.findAll({
    where: { school_id: instituteId, is_active: true }
  });

  const classIds = new Set();
  const sectionIds = new Set();
  timetables.forEach((timetable) => {
    if (timetable.entity_ids?.class_id) classIds.add(timetable.entity_ids.class_id);
    if (timetable.entity_ids?.section_id) sectionIds.add(timetable.entity_ids.section_id);
  });

  const [classRows, sectionRows] = await Promise.all([
    classIds.size
      ? Class.findAll({ where: { id: { [Op.in]: Array.from(classIds) }, school_id: instituteId }, attributes: ['id', 'name', 'sections'] })
      : [],
    sectionIds.size
      ? Section.findAll({ where: { id: { [Op.in]: Array.from(sectionIds) }, school_id: instituteId }, attributes: ['id', 'name'] })
      : []
  ]);

  const classNameMap = new Map(classRows.map((row) => [row.id, row.name]));
  const sectionNameMap = new Map(sectionRows.map((row) => [row.id, row.name]));
  // Fallback: sections stored as JSONB array inside Class model
  const classSectionsJsonbMap = new Map(classRows.map((row) => [row.id, Array.isArray(row.sections) ? row.sections : []]));

  const schedule = [];
  timetables.forEach(t => {
    (t.slots || [])
      .filter(s => s.teacher_id === teacherId && s.day === today && !s.is_break)
      .forEach(s => {
        const [startTime, endTime] = resolveSlotTime(s, t.period_config);
        const classId = t.entity_ids?.class_id || null;
        const sectionId = t.entity_ids?.section_id || null;
        const resolvedClassName = classId ? (classNameMap.get(classId) || t.entity_ids?.class_name || 'Class') : getEntityName(t.entity_ids);
        const jsonbSection = sectionId && classId
          ? (classSectionsJsonbMap.get(classId) || []).find((sec) => sec.id === sectionId)
          : null;
        const resolvedSectionName = sectionId
          ? (sectionNameMap.get(sectionId) || jsonbSection?.name || t.entity_ids?.section_name || null)
          : null;
        schedule.push({
          id: s.id,
          time: `${startTime} - ${endTime}`,
          start_time: startTime,
          end_time: endTime,
          subject: s.subject_name,
          class: resolvedSectionName ? `${resolvedClassName} - ${resolvedSectionName}` : resolvedClassName,
          class_id: classId,
          section_id: sectionId,
          section_name: resolvedSectionName,
          room: s.room_no
        });
      });
  });

  return schedule.sort((a, b) => a.start_time?.localeCompare(b.start_time || ''));
};

const resolveSlotTime = (slot = {}, periodConfig = {}) => {
  const startTime = slot.start_time || slot.startTime;
  const endTime = slot.end_time || slot.endTime;

  if (startTime && endTime) {
    return [startTime, endTime];
  }

  const periods = Array.isArray(periodConfig?.periods) ? periodConfig.periods : [];
  const periodMatch = periods.find((p) => String(p.period) === String(slot.period));

  return [
    startTime || periodMatch?.start_time || '--:--',
    endTime || periodMatch?.end_time || '--:--'
  ];
};

const getRecentAssignments = async (teacherId, instituteId, limit) => {
  const assignments = await Assignment.findAll({
    where: { institute_id: instituteId, teacher_id: teacherId },
    order: [['created_at', 'DESC']],
    limit,
    attributes: [
      'id',
      'title',
      'type',
      'subject',
      'class_id',
      'section_id',
      'due_date',
      'is_published',
      'status',
      'stats',
      'created_at'
    ]
  });

  const classIds = [...new Set(assignments.map((a) => a.class_id).filter(Boolean))];
  const sectionIds = [...new Set(assignments.map((a) => a.section_id).filter(Boolean))];

  const [classRows, sectionRows] = await Promise.all([
    classIds.length
      ? Class.findAll({
        where: { id: { [Op.in]: classIds }, school_id: instituteId },
        attributes: ['id', 'name', 'sections']
      })
      : [],
    sectionIds.length
      ? Section.findAll({
        where: { id: { [Op.in]: sectionIds }, school_id: instituteId },
        attributes: ['id', 'name', 'class_id']
      })
      : []
  ]);

  const classNameMap = new Map(classRows.map((row) => [row.id, row.name]));
  const sectionNameMap = new Map(sectionRows.map((row) => [row.id, row.name]));

  // Fallback from Class JSONB sections when Section rows are missing.
  for (const cls of classRows) {
    for (const sec of (cls.sections || [])) {
      if (sec?.id && sec?.name && !sectionNameMap.has(sec.id)) {
        sectionNameMap.set(sec.id, sec.name);
      }
    }
  }

  return assignments.map((assignment) => ({
    ...assignment.toJSON(),
    class_name: assignment.class_id ? (classNameMap.get(assignment.class_id) || null) : null,
    section_name: assignment.section_id ? (sectionNameMap.get(assignment.section_id) || null) : null
  }));
};

const getPendingWork = async (teacherId, instituteId) => {
  const assignments = await Assignment.findAll({
    where: {
      institute_id: instituteId,
      teacher_id: teacherId,
      is_published: true
    },
    attributes: ['id', 'title', 'subject', 'due_date'],
    limit: 10
  });

  const assignmentIds = assignments.map((a) => a.id);
  if (!assignmentIds.length) return [];

  const submissions = await AssignmentSubmission.findAll({
    where: {
      assignment_id: { [Op.in]: assignmentIds },
      status: 'submitted'
    },
    attributes: ['assignment_id']
  });

  const pendingMap = submissions.reduce((acc, item) => {
    acc[item.assignment_id] = (acc[item.assignment_id] || 0) + 1;
    return acc;
  }, {});

  return assignments
    .filter((a) => pendingMap[a.id] > 0)
    .map(a => ({
      id: a.id,
      title: a.title,
      subject: a.subject,
      pending_count: pendingMap[a.id] || 0,
      due_date: a.due_date
    }));
};

const getRecentActivity = async (teacherId, instituteId) => {
  const [recentAssignments, recentAttendance, recentGrading] = await Promise.all([
    Assignment.findAll({
      where: { institute_id: instituteId, teacher_id: teacherId },
      order: [['created_at', 'DESC']],
      limit: 5,
      attributes: ['id', 'title', 'type', 'created_at']
    }),
    Attendance.findAll({
      where: { school_id: instituteId, marked_by: teacherId },
      order: [['date', 'DESC']],
      limit: 5,
      attributes: ['id', 'class_id', 'date']
    }),
    AssignmentSubmission.findAll({
      where: {
        graded_by: teacherId,
        graded_at: { [Op.ne]: null }
      },
      include: [
        {
          model: Assignment,
          as: 'assignment',
          attributes: ['id', 'title', 'institute_id']
        }
      ],
      order: [['graded_at', 'DESC']],
      limit: 5,
      attributes: ['id', 'assignment_id', 'graded_at', 'status']
    })
  ]);

  const classIds = [...new Set(recentAttendance.map((a) => a.class_id).filter(Boolean))];
  const classRows = classIds.length
    ? await Class.findAll({
      where: { id: { [Op.in]: classIds }, school_id: instituteId },
      attributes: ['id', 'name']
    })
    : [];
  const classNameMap = new Map(classRows.map((row) => [row.id, row.name]));

  const assignmentActivity = recentAssignments.map((item) => ({
    id: `assignment-${item.id}`,
    type: 'assignment',
    title: `Created ${item.type || 'assignment'}: ${item.title}`,
    time: formatTimeAgo(item.created_at),
    icon: 'FileText',
    created_at: item.created_at
  }));

  const attendanceActivity = recentAttendance.map((item) => {
    const className = classNameMap.get(item.class_id) || 'Class';
    return {
      id: `attendance-${item.id}`,
      type: 'attendance',
      title: `Marked attendance for ${className}`,
      time: formatTimeAgo(item.marked_at || item.date),
      icon: 'CheckSquare',
      created_at: item.marked_at || item.date
    };
  });

  const gradingActivity = recentGrading
    .filter((item) => item.assignment?.institute_id === instituteId)
    .map((item) => ({
      id: `grading-${item.id}`,
      type: 'grade',
      title: `Graded submission: ${item.assignment?.title || 'Assignment'}`,
      time: formatTimeAgo(item.graded_at),
      icon: 'Award',
      created_at: item.graded_at
    }));

  return [...assignmentActivity, ...attendanceActivity, ...gradingActivity]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8)
    .map(({ created_at, ...rest }) => rest);
};

const formatTimeAgo = (value) => {
  if (!value) return 'Just now';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Just now';
  return formatDistanceToNow(parsed, { addSuffix: true });
};

const getTeacherStats = async (teacherId, instituteId) => {
  const students = await getMyStudents(teacherId, instituteId, {}, { limit: 1000 });
  const assignments = await Assignment.count({ where: { institute_id: instituteId, teacher_id: teacherId } });
  const publishedAssignments = await Assignment.count({ 
    where: { institute_id: instituteId, teacher_id: teacherId, is_published: true } 
  });

  return {
    total_students: students.pagination.total,
    total_assignments: assignments,
    published_assignments: publishedAssignments,
    draft_assignments: assignments - publishedAssignments
  };
};

const getStudentAttendanceStats = async (studentId, instituteId) => {
  const total = await Attendance.count({
    where: { school_id: instituteId, student_id: studentId }
  });
  
  const present = await Attendance.count({
    where: { school_id: instituteId, student_id: studentId, status: 'present' }
  });

  const lastAttendance = await Attendance.findOne({
    where: { school_id: instituteId, student_id: studentId },
    order: [['date', 'DESC']]
  });

  return {
    percentage: total ? Math.round((present / total) * 100) : 0,
    last_date: lastAttendance?.date
  };
};

const getStudentAttendanceHistory = async (studentId, instituteId) => {
  const attendance = await Attendance.findAll({
    where: { school_id: instituteId, student_id: studentId },
    order: [['date', 'DESC']],
    limit: 30
  });

  const total = attendance.length;
  const present = attendance.filter(a => a.status === 'present').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const late = attendance.filter(a => a.status === 'late').length;

  return {
    summary: {
      total,
      present,
      absent,
      late,
      percentage: total ? Math.round((present / total) * 100) : 0
    },
    recent: attendance.slice(0, 10).map(a => ({
      date: format(new Date(a.date), 'dd MMM yyyy'),
      status: a.status
    }))
  };
};

const getStudentAssignments = async (studentId, instituteId) => {
  const submissions = await AssignmentSubmission.findAll({
    where: { student_id: studentId },
    include: [{ model: Assignment, as: 'assignment' }],
    order: [['submitted_at', 'DESC']],
    limit: 10
  });

  return submissions.map(s => ({
    id: s.id,
    title: s.assignment.title,
    subject: s.assignment.subject,
    submitted_at: s.submitted_at,
    marks: s.marks,
    feedback: s.feedback,
    status: s.status
  }));
};

const getStudentResults = async (studentId, instituteId) => {
  // This would query exam results
  return [
    {
      exam: 'Mid Term 2024',
      subjects: [
        { name: 'Mathematics', marks: 85, total: 100, grade: 'A' },
        { name: 'Physics', marks: 78, total: 100, grade: 'B+' }
      ],
      percentage: 81.5,
      rank: 15
    }
  ];
};

const getStudentProfile = async (studentId, instituteId) => {
  const student = await User.findOne({
    where: { id: studentId, school_id: instituteId, user_type: 'STUDENT' }
  });

  return {
    id: student.id,
    name: `${student.first_name} ${student.last_name}`,
    registration_no: student.registration_no,
    class: student.details?.class_name,
    section: student.details?.section_name,
    roll_number: student.details?.roll_number,
    avatar: student.avatar_url,
    guardian: student.details?.guardian_name
  };
};

const updateAssignmentStats = async (assignmentId) => {
  const submissions = await AssignmentSubmission.findAll({
    where: { assignment_id: assignmentId }
  });

  const graded = submissions.filter(s => s.status === 'graded');
  const averageScore = graded.length
    ? graded.reduce((sum, s) => sum + (s.marks || 0), 0) / graded.length
    : 0;

  await Assignment.update({
    stats: {
      ...(await Assignment.findByPk(assignmentId)).stats,
      submitted: submissions.length,
      graded: graded.length,
      pending_grading: submissions.length - graded.length,
      average_score: Math.round(averageScore * 100) / 100
    }
  }, { where: { id: assignmentId } });
};

// ─────────────────────────────────────────────────────────────────────────────
// EXAM MANAGEMENT (Teacher Portal)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get teacher's assigned classes, sections, and subjects from timetable
 */
export const getTeacherAssignments = async (teacherId, instituteId) => {
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });

  const assignments = {
    classes: new Map(),
    sections: new Map(),
    subjects: new Set()
  };

  timetables.forEach(timetable => {
    const slots = timetable.slots || [];
    const teacherSlots = slots.filter(slot => slot.teacher_id === teacherId);

    if (teacherSlots.length > 0) {
      const classId = timetable.entity_ids?.class_id;
      const sectionId = timetable.entity_ids?.section_id;
      const className = timetable.entity_ids?.class_name || 'Class';
      const sectionName = timetable.entity_ids?.section_name || null;

      // Add class
      if (classId) {
        if (!assignments.classes.has(classId)) {
          assignments.classes.set(classId, {
            id: classId,
            name: className,
            sections: new Map(),
            subjects: new Set()
          });
        }
      }

      // Add section
      if (sectionId && classId) {
        const classData = assignments.classes.get(classId);
        if (classData && !classData.sections.has(sectionId)) {
          classData.sections.set(sectionId, {
            id: sectionId,
            name: sectionName || `Section ${classData.sections.size + 1}`,
            subjects: new Set()
          });
        }
      }

      // Add subjects
      teacherSlots.forEach(slot => {
        if (slot.subject_name) {
          assignments.subjects.add(slot.subject_name);
          
          if (classId) {
            const classData = assignments.classes.get(classId);
            if (classData) {
              classData.subjects.add(slot.subject_name);
              
              if (sectionId && classData.sections.has(sectionId)) {
                classData.sections.get(sectionId).subjects.add(slot.subject_name);
              }
            }
          }
        }
      });
    }
  });

  // Convert Maps to Arrays
  const result = {
    classes: Array.from(assignments.classes.values()).map(cls => ({
      ...cls,
      sections: Array.from(cls.sections.values()).map(sec => ({
        ...sec,
        subjects: Array.from(sec.subjects)
      })),
      subjects: Array.from(cls.subjects)
    })),
    subjects: Array.from(assignments.subjects),
    total_classes: assignments.classes.size,
    total_subjects: assignments.subjects.size
  };

  return result;
};

/**
 * Create exam for teacher's assigned class/section/subject
 */
export const createTeacherExam = async (teacherId, instituteId, examData, options = {}) => {
  const { Exam } = models;
  const transaction = options.transaction || await sequelize.transaction();
  let shouldCommit = !options.transaction;

  try {
    // Verify teacher is assigned to this class/subject
    const assignments = await getTeacherAssignments(teacherId, instituteId);
    
    const classAssignment = assignments.classes.find(c => c.id === examData.class_id);
    if (!classAssignment) {
      throw new Error('You are not assigned to this class');
    }

    // Verify section if provided
    if (examData.section_id) {
      const sectionAssignment = classAssignment.sections.find(s => s.id === examData.section_id);
      if (!sectionAssignment) {
        throw new Error('You are not assigned to this section');
      }
    }

    // Verify all subjects are assigned to teacher
    const examSubjects = examData.subject_schedules || [];
    examSubjects.forEach(subject => {
      const hasSubject = classAssignment.subjects.find(s => s === subject.subject_name) ||
                        examSubjects.some(s => s.subject_id === subject.subject_id);
      if (!hasSubject) {
        throw new Error(`You are not assigned to subject: ${subject.subject_name}`);
      }
    });

    // Calculate total marks
    const totalMarks = examSubjects.reduce((sum, s) => sum + (parseInt(s.total_marks) || 0), 0);

    const exam = await Exam.create({
      id: uuidv4(),
      school_id: instituteId,
      class_id: examData.class_id,
      section_id: examData.section_id || null,
      academic_year_id: examData.academic_year_id,
      name: examData.name,
      type: examData.type || 'mid-term',
      code: examData.code || `${examData.type?.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      subject_schedules: examSubjects,
      start_date: examSubjects.length > 0 ? examSubjects[0].date : examData.start_date,
      end_date: examSubjects.length > 0 ? examSubjects[examSubjects.length - 1].date : examData.end_date,
      total_marks: totalMarks,
      pass_marks: Math.round((totalMarks * (examData.pass_percentage || 40)) / 100),
      pass_percentage: examData.pass_percentage || 40,
      grading_system: examData.grading_system || null,
      status: 'scheduled',
      is_published: false,
      created_by: teacherId,
      updated_by: teacherId
    }, { transaction });

    if (shouldCommit) await transaction.commit();
    return exam;
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    throw error;
  }
};

/**
 * Get teacher's exams
 */
export const getTeacherExams = async (teacherId, instituteId, filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;
  const { Exam, Class, Section } = models;

  // Get teacher's assigned classes
  const assignments = await getTeacherAssignments(teacherId, instituteId);
  const classIds = assignments.classes.map(c => c.id);

  const where = {
    school_id: instituteId,
    [Op.or]: [
      { created_by: teacherId },
      { class_id: classIds.length > 0 ? classIds : null }
    ]
  };

  // Convert 'published' status from frontend filter to is_published flag
  if (filters.status === 'published') {
    where.is_published = true;
  } else if (filters.status) {
    where.status = filters.status;
  }

  if (filters.type) where.type = filters.type;
  if (filters.class_id) where.class_id = filters.class_id;
  if (filters.is_published !== undefined) where.is_published = filters.is_published;

  const { count, rows } = await Exam.findAndCountAll({
    where,
    order: [['start_date', 'DESC']],
    include: [
      { model: Class, as: 'class', attributes: ['id', 'name'] },
      { model: Section, as: 'section', attributes: ['id', 'name'] }
    ],
    limit,
    offset
  });

  return {
    data: rows.map(exam => {
      const examData = exam.toJSON();
      
      // Filter subject schedules to only those assigned to this teacher
      let filteredSchedules = examData.subject_schedules || [];
      const classAssignment = assignments.classes.find(c => c.id === examData.class_id);
      
      if (classAssignment && examData.created_by !== teacherId) {
        // If the teacher didn't create the exam, only show subjects they are assigned to teach
        filteredSchedules = filteredSchedules.filter(schedule => 
          classAssignment.subjects.includes(schedule.subject_name)
        );
      }

      return {
        ...examData,
        subject_schedules: filteredSchedules,
        class_name: examData.class?.name || 'Class',
        section_name: examData.section?.name || 'All Sections',
        subject_count: filteredSchedules.length,
        status_display: examData.is_published ? 'Published' : 'Draft'
      };
    }),
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    }
  };
};

/**
 * Add or update exam results for teacher's students
 */
export const addTeacherExamResults = async (teacherId, instituteId, examId, results, options = {}) => {
  const { Exam, ExamResult, User } = models;
  const transaction = options.transaction || await sequelize.transaction();
  let shouldCommit = !options.transaction;

  try {
    // Verify teacher created or is assigned to this exam
    const assignments = await getTeacherAssignments(teacherId, instituteId);
    const classIds = assignments.classes.map(c => c.id);

    const exam = await Exam.findOne({
      where: { 
        id: examId, 
        school_id: instituteId,
        [Op.or]: [
          { created_by: teacherId },
          { class_id: classIds.length > 0 ? classIds : null }
        ]
      },
      transaction
    });

    if (!exam) throw new Error('Exam not found or unauthorized');

    // Get students in this exam's class/section
    const studentWhere = {
      school_id: instituteId,
      user_type: 'STUDENT',
      is_active: true,
      'details.studentDetails.class_id': exam.class_id
    };

    if (exam.section_id) {
      studentWhere['details.studentDetails.section_id'] = exam.section_id;
    }

    const allowedStudents = await User.findAll({
      where: studentWhere,
      attributes: ['id'],
      transaction
    });

    const allowedStudentIds = new Set(allowedStudents.map(s => s.id));

    const processed = [];
    const errors = [];

    for (const result of results) {
      try {
        // Verify student is in this class/section
        if (!allowedStudentIds.has(result.student_id)) {
          throw new Error('Student not in this class');
        }

        // Validate marks
        const subjectMarksMap = {};
        (result.subject_marks || []).forEach(sm => {
          subjectMarksMap[sm.subject_id] = sm.marks_obtained;
        });

        if (result.is_present !== false) {
          for (const [subjectId, marksObtained] of Object.entries(subjectMarksMap)) {
            const subjectSchedule = exam.subject_schedules.find(s => s.subject_id === subjectId);
            if (subjectSchedule && marksObtained > subjectSchedule.total_marks) {
              throw new Error(
                `Marks (${marksObtained}) exceed total marks (${subjectSchedule.total_marks})`
              );
            }
          }
        }

        // Check for existing result
        const existing = await ExamResult.findOne({
          where: { exam_id: examId, student_id: result.student_id },
          transaction
        });

        // Merge existing subject marks with the incoming ones
        let finalSubjectMarks = [...(result.subject_marks || [])];
        if (existing && existing.subject_marks) {
          const existingMarksToKeep = existing.subject_marks.filter(
            sm => !subjectMarksMap.hasOwnProperty(sm.subject_id)
          );
          finalSubjectMarks = [...finalSubjectMarks, ...existingMarksToKeep];

          // Add existing marks to our map for total calculation
          existingMarksToKeep.forEach(sm => {
            subjectMarksMap[sm.subject_id] = sm.marks_obtained;
          });
        }

        // Calculate result from exam.service logic
        const totalObtained = Object.values(subjectMarksMap).reduce((a, b) => a + (b || 0), 0);
        const totalPossible = exam.subject_schedules.reduce((a, s) => a + (s.total_marks || 0), 0);
        const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
        const status = result.is_present === false ? 'absent' 
                     : percentage >= exam.pass_percentage ? 'pass' 
                     : 'fail';

        if (existing) {
          await existing.update({
            subject_marks: finalSubjectMarks,
            total_marks_obtained: totalObtained,
            percentage,
            status,
            is_present: result.is_present !== false,
            updated_by: teacherId
          }, { transaction });
          processed.push({ student_id: result.student_id, action: 'updated' });
        } else {
          await ExamResult.create({
            id: uuidv4(),
            exam_id: examId,
            student_id: result.student_id,
            subject_marks: finalSubjectMarks,
            total_marks_obtained: totalObtained,
            total_marks: totalPossible,
            percentage,
            status,
            is_present: result.is_present !== false,
            created_by: teacherId,
            updated_by: teacherId
          }, { transaction });
          processed.push({ student_id: result.student_id, action: 'created' });
        }
      } catch (error) {
        errors.push({ student_id: result.student_id, error: error.message });
      }
    }

    if (shouldCommit) await transaction.commit();

    return {
      processed: processed.length,
      failed: errors.length,
      errors
    };
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    throw error;
  }
};

/**
 * Get exam results for teacher
 */
export const getTeacherExamResults = async (teacherId, instituteId, examId, filters = {}, pagination = {}) => {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;
  const { Exam, ExamResult, User } = models;

  // Verify teacher owns or is assigned to this exam
  const assignments = await getTeacherAssignments(teacherId, instituteId);
  const classIds = assignments.classes.map(c => c.id);

  const exam = await Exam.findOne({
    where: { 
      id: examId, 
      school_id: instituteId,
      [Op.or]: [
        { created_by: teacherId },
        { class_id: classIds.length > 0 ? classIds : null }
      ]
    },
    attributes: ['id', 'name', 'total_marks', 'subject_schedules', 'class_id', 'section_id']
  });

  if (!exam) throw new Error('Exam not found or unauthorized');

  // Get students in this exam's class/section
  const studentWhere = {
    school_id: instituteId,
    user_type: 'STUDENT',
    is_active: true,
    'details.studentDetails.class_id': exam.class_id
  };

  if (exam.section_id) {
    studentWhere['details.studentDetails.section_id'] = exam.section_id;
  }

  const students = await User.findAll({
    where: studentWhere,
    attributes: ['id', 'first_name', 'last_name', 'email', 'registration_no', 'details'],
    order: [['first_name', 'ASC']]
  });

  const studentIds = students.map(s => s.id);

  // Get results
  const existingResults = await ExamResult.findAll({
    where: {
      exam_id: examId,
      student_id: { [Op.in]: studentIds }
    }
  });

  const resultsMap = new Map(existingResults.map(r => [r.student_id, r]));

  // Build response
  const results = [];
  for (const student of students) {
    const result = resultsMap.get(student.id);
    
    results.push({
      ...(result?.dataValues || {}),
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        registration_no: student.registration_no,
        roll_number: student.details?.studentDetails?.roll_no || ''
      },
      id: result?.id || null,
      exam_id: examId,
      total_marks_obtained: result?.total_marks_obtained || 0,
      percentage: result?.percentage || 0,
      grade: result?.grade || 'N/A',
      status: result?.status || 'pending'
    });
  }

  // Pagination
  const paginatedResults = results.slice(offset, offset + limit);

  return {
    data: paginatedResults,
    pagination: {
      total: results.length,
      page,
      limit,
      totalPages: Math.ceil(results.length / limit)
    },
    exam: {
      id: exam.id,
      name: exam.name,
      total_marks: exam.total_marks,
      subjects: exam.subject_schedules || []
    }
  };
};

/**
 * Get exam details for teacher
 */
export const getTeacherExamDetails = async (teacherId, instituteId, examId) => {
  const { Exam, ExamResult } = models;

  // Verify teacher owns or is assigned to this exam
  const assignments = await getTeacherAssignments(teacherId, instituteId);
  const classIds = assignments.classes.map(c => c.id);

  const exam = await Exam.findOne({
    where: { 
      id: examId, 
      school_id: instituteId,
      [Op.or]: [
        { created_by: teacherId },
        { class_id: classIds.length > 0 ? classIds : null }
      ]
    }
  });

  if (!exam) throw new Error('Exam not found');

  const examData = exam.toJSON();

  // Filter subject schedules to only those assigned to this teacher
  let filteredSchedules = examData.subject_schedules || [];
  const classAssignment = assignments.classes.find(c => c.id === examData.class_id);
  
  if (classAssignment && examData.created_by !== teacherId) {
    filteredSchedules = filteredSchedules.filter(schedule => 
      classAssignment.subjects.includes(schedule.subject_name)
    );
  }

  examData.subject_schedules = filteredSchedules;
  // Also calculate total marks relevant to this teacher's view dynamically
  examData.total_marks = filteredSchedules.reduce((a, s) => a + (Number(s.total_marks) || 0), 0);

  // Get results summary
  const results = await ExamResult.findAll({
    where: { exam_id: examId }
  });

  const stats = {
    total_students: results.length,
    submitted: results.filter(r => r.status !== 'pending').length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    absent: results.filter(r => r.status === 'absent').length,
    average_percentage: results.length > 0
      ? results.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0) / results.length
      : 0
  };

  return {
    ...examData,
    stats,
    results: results.map(r => r.toJSON())
  };
};
/**
 * Get ALL students for exam entry (with existing results if any)
 * This returns complete student list from class/section, not just those with results
 * AND filters subjects to ONLY those taught by the teacher
 */
export const getExamEntryStudents = async (examId, teacherId, instituteId, filters = {}, pagination = {}) => {
    const { Exam, Timetable, User, ExamResult } = models;
  const { page = 1, limit = 100 } = pagination;
  const offset = (page - 1) * limit;

  // 1. Get exam with class/section info
  const exam = await Exam.findOne({
    where: { id: examId, school_id: instituteId },
    attributes: ['id', 'class_id', 'section_id', 'academic_year_id', 'subject_schedules', 'name', 'type', 'total_marks']
  });

  if (!exam) throw new Error('Exam not found');

  // 2. Get teacher's assigned subjects from timetable for this class/section
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });

  // Extract subjects that this teacher teaches in this specific class/section
  const teacherSubjects = new Set();
  let teachesClass = false;

  timetables.forEach(timetable => {
    const slots = timetable.slots || [];
    const teacherSlots = slots.filter(slot => String(slot.teacher_id || '') === String(teacherId));
    
    // Check if teacher teaches this class
    const classMatch = timetable.entity_ids?.class_id === exam.class_id;
    const sectionMatch = !exam.section_id || timetable.entity_ids?.section_id === exam.section_id;
    
    if (teacherSlots.length > 0 && classMatch && sectionMatch) {
      teachesClass = true;
      // Add subjects that this teacher teaches
      teacherSlots.forEach(slot => {
        if (slot.subject_id) {
          teacherSubjects.add(slot.subject_id);
        }
        if (slot.subject_name) {
          teacherSubjects.add(slot.subject_name);
        }
      });
    }
  });

  if (!teachesClass) {
    throw new Error('You are not authorized to enter marks for this exam');
  }

  // 3. Filter exam subjects to ONLY those taught by this teacher
  const allExamSubjects = exam.subject_schedules || [];
  const filteredSubjects = allExamSubjects.filter(subject => {
    // Match by subject_id OR subject_name
    return teacherSubjects.has(subject.subject_id) || teacherSubjects.has(subject.subject_name);
  });

  console.log(`Teacher subjects: ${Array.from(teacherSubjects).join(', ')}`);
  console.log(`Filtered subjects: ${filteredSubjects.map(s => s.subject_name).join(', ')}`);

  // Calculate total marks for filtered subjects only
  const totalPossibleMarks = filteredSubjects.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0);

  // 4. Fetch ALL students from exam's class/section
  let studentWhere = {
    school_id: instituteId,
    user_type: 'STUDENT',
    is_active: true,
    'details.studentDetails.class_id': exam.class_id
  };

  if (exam.section_id) {
    studentWhere['details.studentDetails.section_id'] = exam.section_id;
  }

  // Apply search filter
  if (filters.search) {
    studentWhere[Op.or] = [
      { first_name: { [Op.iLike]: `%${filters.search}%` } },
      { last_name: { [Op.iLike]: `%${filters.search}%` } },
      { registration_no: { [Op.iLike]: `%${filters.search}%` } }
    ];
  }

  const allStudents = await User.findAll({
    where: studentWhere,
    attributes: ['id', 'first_name', 'last_name', 'email', 'registration_no', 'avatar_url', 'details'],
    order: [['first_name', 'ASC']]
  });

  // 5. Get existing exam results for these students
  const studentIds = allStudents.map(s => s.id);
  
  let existingResultsMap = new Map();
  
  if (models.ExamResult) {
    const examResults = await models.ExamResult.findAll({
      where: {
        exam_id: examId,
        student_id: { [Op.in]: studentIds }
      }
    });
    existingResultsMap = new Map(examResults.map(r => [r.student_id, r]));
  }

  // 6. Build response with all students (filtered subjects only)
  const allStudentsWithResults = allStudents.map(student => {
    const existingResult = existingResultsMap.get(student.id);
    const studentDetails = student.details?.studentDetails || {};
    
    // Get existing subject marks for filtered subjects only
    let existingSubjectMarksMap = new Map();
    if (existingResult && existingResult.subject_marks) {
      existingResult.subject_marks.forEach(sm => {
        existingSubjectMarksMap.set(sm.subject_id, sm);
      });
    }
    
    // Build subject_marks array for filtered subjects only
    const subjectMarksArray = filteredSubjects.map(subject => {
      const existingMark = existingSubjectMarksMap.get(subject.subject_id);
      return {
        subject_id: subject.subject_id,
        subject_name: subject.subject_name,
        marks_obtained: existingMark?.marks_obtained !== undefined && existingMark?.marks_obtained !== null 
          ? existingMark.marks_obtained 
          : '',
        total_marks: subject.total_marks,
        percentage: existingMark?.percentage || 0,
        grade: existingMark?.grade || null
      };
    });
    
    // Calculate total obtained marks for filtered subjects only
    let totalObtained = 0;
    subjectMarksArray.forEach(sm => {
      if (sm.marks_obtained !== '' && sm.marks_obtained !== null && !isNaN(parseFloat(sm.marks_obtained))) {
        totalObtained += parseFloat(sm.marks_obtained);
      }
    });
    
    if (existingResult) {
      // Student has existing results - show pre-filled marks
      return {
        id: existingResult.id,
        exam_id: examId,
        student_id: student.id,
        student: {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          registration_no: student.registration_no || '',
          roll_number: studentDetails.roll_no || studentDetails.roll_number || '',
          avatar: student.avatar_url
        },
        subject_marks: subjectMarksArray,
        total_marks_obtained: totalObtained,
        total_marks: totalPossibleMarks,
        percentage: existingResult.percentage || (totalPossibleMarks > 0 ? (totalObtained / totalPossibleMarks) * 100 : 0),
        grade: existingResult.grade || null,
        status: existingResult.status || 'pending',
        is_present: existingResult.is_present !== false,
        absent_reason: existingResult.absent_reason || null,
        teacher_remarks: existingResult.teacher_remarks || null
      };
    } else {
      // Student has no results yet - empty fields
      return {
        id: null,
        exam_id: examId,
        student_id: student.id,
        student: {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          registration_no: student.registration_no || '',
          roll_number: studentDetails.roll_no || studentDetails.roll_number || '',
          avatar: student.avatar_url
        },
        subject_marks: subjectMarksArray,
        total_marks_obtained: 0,
        total_marks: totalPossibleMarks,
        percentage: 0,
        grade: null,
        status: 'pending',
        is_present: true,
        absent_reason: null,
        teacher_remarks: null
      };
    }
  });

  // Apply status filter
  let filteredStudents = allStudentsWithResults;
  if (filters.status && filters.status !== 'all') {
    filteredStudents = filteredStudents.filter(s => s.status === filters.status);
  }

  // Pagination
  const total = filteredStudents.length;
  const paginatedStudents = filteredStudents.slice(offset, offset + limit);

  // Get class name
  const classData = await Class.findOne({
    where: { id: exam.class_id, school_id: instituteId },
    attributes: ['name']
  });

  return {
    data: paginatedStudents,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    },
    exam: {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      class_name: classData?.name || 'Class',
      section_name: exam.section_id ? 'Section' : null,
      subject_schedules: filteredSubjects, // ONLY teacher's subjects
      total_marks: totalPossibleMarks
    }
  };
};

export default {
  // Assignments
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getMyAssignments,
  getAssignmentWithSubmissions,
  gradeSubmission,
  
  // Attendance
  markAttendance,
  getClassAttendance,
  
  // Timetable
  getMyTimetable,
  
  // Notices
  getNotices,
  
  // Exams
  getTeacherAssignments,
  createTeacherExam,
  getTeacherExams,
  addTeacherExamResults,
  getTeacherExamResults,
  getTeacherExamDetails,
  getExamEntryStudents
};