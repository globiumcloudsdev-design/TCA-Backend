/**
 * The Clouds Academy - Event Service
 * CRUD for Events with smart notifications to Teachers, Staff, Students & Parents
 */

import models from '../models/postgres/index.js';
import { Op } from 'sequelize';
import logger from '../config/logger.js';
import { broadcastNotification, createNotification } from './notification.service.js';

const { Event, User, Institute, Branch, Class, Section } = models;

// ─────────────────────────────────────────────────────────────────
// ✅ CREATE EVENT
// ─────────────────────────────────────────────────────────────────

export const createEvent = async (data, createdBy) => {
  const {
    institute_id,
    branch_id,
    event_name,
    description,
    event_type,
    date,
    time,
    location,
    audience_type,
    selected_class_ids = [],
    custom_user_ids = [],
    attendance_enabled = false,
    self_attendance_allowed = false,
    send_notification = true,
    status = 'scheduled',
  } = data;

  const event = await Event.create({
    institute_id,
    branch_id: branch_id || null,
    event_name,
    description,
    event_type,
    date,
    time: time || null,
    location,
    audience_type,
    selected_class_ids: Array.isArray(selected_class_ids) ? selected_class_ids : [],
    custom_user_ids: Array.isArray(custom_user_ids) ? custom_user_ids : [],
    attendance_enabled,
    self_attendance_allowed,
    send_notification,
    status,
    created_by: createdBy,
  });

  // Send notifications if enabled
  if (send_notification) {
    try {
      await sendEventNotifications(event, 'created');
    } catch (notifErr) {
      logger.error(`❌ Event notification failed: ${notifErr.message}`);
    }
  }

  return event;
};

// ─────────────────────────────────────────────────────────────────
// ✅ GET ALL EVENTS (with filters & pagination)
// ─────────────────────────────────────────────────────────────────

export const getAllEvents = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const where = {};

  if (filters.institute_id) where.institute_id = filters.institute_id;
  if (filters.branch_id) where.branch_id = filters.branch_id;
  if (filters.event_type) where.event_type = filters.event_type;
  if (filters.status) where.status = filters.status;
  if (filters.audience_type) where.audience_type = filters.audience_type;
  if (filters.created_by) where.created_by = filters.created_by;

  // Date range filter
  if (filters.from_date && filters.to_date) {
    where.date = { [Op.between]: [filters.from_date, filters.to_date] };
  } else if (filters.from_date) {
    where.date = { [Op.gte]: filters.from_date };
  } else if (filters.to_date) {
    where.date = { [Op.lte]: filters.to_date };
  }

  // Search by event name
  if (filters.search) {
    where.event_name = { [Op.iLike]: `%${filters.search}%` };
  }

  const { count, rows } = await Event.findAndCountAll({
    where,
    include: [
      { model: Institute, as: 'institute', attributes: ['id', 'institute_name'] },
      { model: Branch, as: 'branch', attributes: ['id', 'name'] },
      { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] },
    ],
    order: [['date', 'DESC'], ['created_at', 'DESC']],
    limit,
    offset,
  });

  return {
    data: rows,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
};

// ─────────────────────────────────────────────────────────────────
// ✅ GET EVENT BY ID
// ─────────────────────────────────────────────────────────────────

export const getEventById = async (id, institute_id, branch_id = null) => {
  const where = { id };
  if (institute_id) where.institute_id = institute_id;
  if (branch_id) where.branch_id = branch_id;

  const event = await Event.findOne({
    where,
    include: [
      { model: Institute, as: 'institute', attributes: ['id', 'institute_name'] },
      { model: Branch, as: 'branch', attributes: ['id', 'name'] },
      { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'email'] },
    ],
  });

  if (!event) throw new Error('Event not found');
  return event;
};

// ─────────────────────────────────────────────────────────────────
// ✅ UPDATE EVENT
// ─────────────────────────────────────────────────────────────────

export const updateEvent = async (id, institute_id, updateData) => {
  const event = await Event.findOne({ where: { id, institute_id } });
  if (!event) throw new Error('Event not found');

  const fields = [
    'event_name', 'description', 'event_type', 'date', 'time',
    'location', 'audience_type', 'selected_class_ids', 'custom_user_ids',
    'attendance_enabled', 'self_attendance_allowed', 'send_notification', 'status',
  ];

  fields.forEach((field) => {
    if (updateData[field] !== undefined) {
      event[field] = updateData[field];
    }
  });

  await event.save();

  // Send update notification
  if (event.send_notification) {
    try {
      await sendEventNotifications(event, 'updated');
    } catch (notifErr) {
      logger.error(`❌ Event update notification failed: ${notifErr.message}`);
    }
  }

  return event;
};

// ─────────────────────────────────────────────────────────────────
// ✅ DELETE EVENT (soft delete via paranoid)
// ─────────────────────────────────────────────────────────────────

export const deleteEvent = async (id, institute_id, branch_id = null) => {
  const where = { id, institute_id };
  if (branch_id) where.branch_id = branch_id;

  const event = await Event.findOne({ where });
  if (!event) throw new Error('Event not found');

  await event.destroy();
  return { success: true, message: 'Event deleted successfully' };
};

// ─────────────────────────────────────────────────────────────────
// ✅ TOGGLE EVENT STATUS
// ─────────────────────────────────────────────────────────────────

export const toggleEventStatus = async (id, institute_id, newStatus) => {
  const event = await Event.findOne({ where: { id, institute_id } });
  if (!event) throw new Error('Event not found');

  const allowedStatuses = ['draft', 'scheduled', 'completed', 'cancelled'];
  if (!allowedStatuses.includes(newStatus)) {
    throw new Error(`Invalid status. Allowed: ${allowedStatuses.join(', ')}`);
  }

  event.status = newStatus;
  await event.save();

  // Notify on cancellation
  if (newStatus === 'cancelled' && event.send_notification) {
    try {
      await sendEventNotifications(event, 'cancelled');
    } catch (notifErr) {
      logger.error(`❌ Event cancellation notification failed: ${notifErr.message}`);
    }
  }

  return event;
};

// ─────────────────────────────────────────────────────────────────
// ✅ GET UPCOMING EVENTS
// ─────────────────────────────────────────────────────────────────

export const getUpcomingEvents = async (institute_id, branch_id, limit = 10) => {
  const today = new Date().toISOString().split('T')[0];

  const where = {
    institute_id,
    date: { [Op.gte]: today },
    status: { [Op.notIn]: ['cancelled', 'draft'] },
  };

  if (branch_id) where.branch_id = branch_id;

  const events = await Event.findAll({
    where,
    order: [['date', 'ASC']],
    limit,
    include: [
      { model: Institute, as: 'institute', attributes: ['id', 'institute_name'] },
      { model: Branch, as: 'branch', attributes: ['id', 'name'] },
    ],
  });

  return events;
};

// ─────────────────────────────────────────────────────────────────
// ✅ GET EVENTS FOR USER (based on audience type)
// ─────────────────────────────────────────────────────────────────

export const getEventsForUser = async (userId, institute_id, userType) => {
  const today = new Date().toISOString().split('T')[0];

  const where = {
    institute_id,
    date: { [Op.gte]: today },
    status: { [Op.notIn]: ['cancelled', 'draft'] },
  };

  // Build audience filter based on user type
  const audienceWhere = [];

  if (userType === 'STUDENT') {
    audienceWhere.push(
      { audience_type: 'all_students' },
      { audience_type: 'selected_classes' } // student will filter by class in app layer
    );
  } else if (userType === 'TEACHER') {
    audienceWhere.push({ audience_type: 'all_teachers' });
  } else if (userType === 'STAFF') {
    audienceWhere.push({ audience_type: 'all_staff' });
  } else if (userType === 'PARENT') {
    audienceWhere.push(
      { audience_type: 'all_students' }, // parents get notified for student events
      { audience_type: 'selected_classes' }
    );
  }

  // Always include custom_users events
  audienceWhere.push(
    { audience_type: 'custom_users', custom_user_ids: { [Op.contains]: [userId] } }
  );

  if (audienceWhere.length > 0) {
    where[Op.or] = audienceWhere;
  }

  const events = await Event.findAll({
    where,
    order: [['date', 'ASC']],
    include: [
      { model: Institute, as: 'institute', attributes: ['id', 'institute_name'] },
      { model: Branch, as: 'branch', attributes: ['id', 'name'] },
    ],
  });

  return events;
};

// ═════════════════════════════════════════════════════════════════
// 🔔 NOTIFICATION HELPERS
// ═════════════════════════════════════════════════════════════════

/**
 * Send event notifications based on audience_type
 * @param {Event} event - Event instance
 * @param {String} action - 'created' | 'updated' | 'cancelled'
 */
const sendEventNotifications = async (event, action) => {
  const { institute_id, branch_id, event_name, description, date, time, location, audience_type } = event;

  const actionTitles = {
    created: `📅 New Event: ${event_name}`,
    updated: `🔄 Event Updated: ${event_name}`,
    cancelled: `❌ Event Cancelled: ${event_name}`,
  };

  const actionBodies = {
    created: `A new ${event.event_type} event "${event_name}" is scheduled on ${date}${time ? ' at ' + time : ''} at ${location}.`,
    updated: `The event "${event_name}" has been updated. New schedule: ${date}${time ? ' at ' + time : ''} at ${location}.`,
    cancelled: `The event "${event_name}" scheduled on ${date} at ${location} has been cancelled.`,
  };

  const title = actionTitles[action] || `Event: ${event_name}`;
  const body = actionBodies[action] || description || `Event: ${event_name}`;

  // Map audience_type to notification recipient types
  const notificationPromises = [];

  switch (audience_type) {
    case 'all': {
      // Notify EVERYONE — Students, Teachers, Staff, and Parents
      notificationPromises.push(
        broadcastNotification({
          institute_id,
          branch_id,
          recipient_type: 'STUDENTS',
          title,
          body,
          type: 'event',
          data: { event_id: event.id, action, event_type: event.event_type },
        })
      );
      notificationPromises.push(
        broadcastNotification({
          institute_id,
          branch_id,
          recipient_type: 'TEACHERS',
          title,
          body,
          type: 'event',
          data: { event_id: event.id, action, event_type: event.event_type },
        })
      );
      notificationPromises.push(
        broadcastNotification({
          institute_id,
          branch_id,
          recipient_type: 'STAFF',
          title,
          body,
          type: 'event',
          data: { event_id: event.id, action, event_type: event.event_type },
        })
      );
      // Notify all parents too
      notificationPromises.push(
        notifyParentsByAudience(institute_id, branch_id, 'all', title, body, event)
      );
      break;
    }

    case 'all_students': {
      // Notify all students
      notificationPromises.push(
        broadcastNotification({
          institute_id,
          branch_id,
          recipient_type: 'STUDENTS',
          title,
          body,
          type: 'event',
          data: { event_id: event.id, action, event_type: event.event_type },
        })
      );
      // Notify all parents of students
      notificationPromises.push(
        notifyParentsByAudience(institute_id, branch_id, 'all_students', title, body, event)
      );
      break;
    }

    case 'all_teachers': {
      notificationPromises.push(
        broadcastNotification({
          institute_id,
          branch_id,
          recipient_type: 'TEACHERS',
          title,
          body,
          type: 'event',
          data: { event_id: event.id, action, event_type: event.event_type },
        })
      );
      break;
    }

    case 'all_staff': {
      notificationPromises.push(
        broadcastNotification({
          institute_id,
          branch_id,
          recipient_type: 'STAFF',
          title,
          body,
          type: 'event',
          data: { event_id: event.id, action, event_type: event.event_type },
        })
      );
      break;
    }

    case 'selected_classes': {
      // Notify students in selected classes + their parents
      const classIds = event.selected_class_ids || [];
      if (classIds.length > 0) {
        notificationPromises.push(
          notifyStudentsAndParentsByClasses(institute_id, branch_id, classIds, title, body, event)
        );
      }
      break;
    }

    case 'custom_users': {
      // Notify specific users directly
      const userIds = event.custom_user_ids || [];
      if (userIds.length > 0) {
        notificationPromises.push(
          notifyCustomUsers(institute_id, branch_id, userIds, title, body, event)
        );
      }
      break;
    }

    default:
      break;
  }

  await Promise.all(notificationPromises);
};

/**
 * Notify parents based on student audience
 */
const notifyParentsByAudience = async (institute_id, branch_id, audience, title, body, event) => {
  try {
    // Find all parents of this institute
    const where = {
      school_id: institute_id,
      user_type: 'PARENT',
      is_active: true,
    };
    if (branch_id) where.branch_id = branch_id;

    const parents = await User.findAll({
      where,
      attributes: ['id'],
      raw: true,
    });

    const parentIds = parents.map((p) => p.id);

    // Send individual notifications to each parent
    const notifPromises = parentIds.map((parentId) =>
      createNotification({
        institute_id,
        branch_id,
        user_id: parentId,
        title,
        body,
        type: 'event',
        data: { event_id: event.id, for_child: true },
      })
    );

    await Promise.all(notifPromises);
    logger.info(`📢 Event notification sent to ${parentIds.length} parents`);
  } catch (error) {
    logger.error(`❌ Parent notification failed: ${error.message}`);
  }
};

/**
 * Notify students & parents by selected classes
 */
const notifyStudentsAndParentsByClasses = async (institute_id, branch_id, classIds, title, body, event) => {
  try {
    // Find students in these classes
    const studentWhere = {
      school_id: institute_id,
      user_type: 'STUDENT',
      is_active: true,
    };
    if (branch_id) studentWhere.branch_id = branch_id;

    // Query students whose details contain the class_ids
    const students = await User.findAll({
      where: studentWhere,
      attributes: ['id', 'details'],
      raw: true,
    });

    // Filter students by class_id from their details
    const matchedStudentIds = [];
    for (const student of students) {
      const studentClassId = student.details?.studentDetails?.class_id;
      if (studentClassId && classIds.includes(studentClassId)) {
        matchedStudentIds.push(student.id);
      }
    }

    if (matchedStudentIds.length === 0) {
      logger.info('⚠️ No students found in selected classes for event notification');
      return;
    }

    // Notify matched students
    const studentNotifs = matchedStudentIds.map((studentId) =>
      createNotification({
        institute_id,
        branch_id,
        user_id: studentId,
        title,
        body,
        type: 'event',
        data: { event_id: event.id, event_type: event.event_type },
      })
    );
    await Promise.all(studentNotifs);

    // Find parents of these students and notify them
    const allParents = await User.findAll({
      where: {
        school_id: institute_id,
        user_type: 'PARENT',
        is_active: true,
      },
      attributes: ['id', 'details'],
      raw: true,
    });

    const parentIdsToNotify = [];
    for (const parent of allParents) {
      const parentStudentIds = parent.details?.parentDetails?.student_ids || [];
      const hasChildInClass = parentStudentIds.some((sid) => matchedStudentIds.includes(sid));
      if (hasChildInClass) {
        parentIdsToNotify.push(parent.id);
      }
    }

    if (parentIdsToNotify.length > 0) {
      const parentNotifs = parentIdsToNotify.map((parentId) =>
        createNotification({
          institute_id,
          branch_id,
          user_id: parentId,
          title: `👨‍👩‍👧 ${title}`,
          body: `${body} (Regarding your child)`,
          type: 'event',
          data: { event_id: event.id, for_child: true },
        })
      );
      await Promise.all(parentNotifs);
    }

    logger.info(
      `📢 Class-based event notification: ${matchedStudentIds.length} students, ${parentIdsToNotify.length} parents`
    );
  } catch (error) {
    logger.error(`❌ Class-based notification failed: ${error.message}`);
  }
};

/**
 * Notify custom selected users + their parents if they are students
 */
const notifyCustomUsers = async (institute_id, branch_id, userIds, title, body, event) => {
  try {
    const users = await User.findAll({
      where: { id: { [Op.in]: userIds }, is_active: true },
      attributes: ['id', 'user_type', 'details'],
      raw: true,
    });

    const studentUserIds = users.filter((u) => u.user_type === 'STUDENT').map((u) => u.id);

    // Notify all custom users
    const notifPromises = userIds.map((uid) =>
      createNotification({
        institute_id,
        branch_id,
        user_id: uid,
        title,
        body,
        type: 'event',
        data: { event_id: event.id, event_type: event.event_type },
      })
    );
    await Promise.all(notifPromises);

    // If any of the custom users are students, notify their parents too
    if (studentUserIds.length > 0) {
      const allParents = await User.findAll({
        where: {
          school_id: institute_id,
          user_type: 'PARENT',
          is_active: true,
        },
        attributes: ['id', 'details'],
        raw: true,
      });

      const parentIdsToNotify = [];
      for (const parent of allParents) {
        const parentStudentIds = parent.details?.parentDetails?.student_ids || [];
        const hasChildSelected = parentStudentIds.some((sid) => studentUserIds.includes(sid));
        if (hasChildSelected) {
          parentIdsToNotify.push(parent.id);
        }
      }

      if (parentIdsToNotify.length > 0) {
        const parentNotifs = parentIdsToNotify.map((parentId) =>
          createNotification({
            institute_id,
            branch_id,
            user_id: parentId,
            title: `👨‍👩‍👧 ${title}`,
            body: `${body} (Regarding your child)`,
            type: 'event',
            data: { event_id: event.id, for_child: true },
          })
        );
        await Promise.all(parentNotifs);
      }
    }

    logger.info(`📢 Custom user event notification sent to ${userIds.length} users`);
  } catch (error) {
    logger.error(`❌ Custom user notification failed: ${error.message}`);
  }
};

// ═════════════════════════════════════════════════════════════════
// 📋 EVENT ATTENDANCE
// ═════════════════════════════════════════════════════════════════

/**
 * Mark student attendance for an event
 * @param {String} eventId - Event UUID
 * @param {String} studentId - Student UUID
 * @param {String} status - present | absent | late | leave
 * @param {String} markedBy - User UUID who marked
 * @param {String} remarks - Optional remarks
 */
export const markStudentEventAttendance = async (eventId, studentId, status, markedBy, remarks = '') => {
  const event = await Event.findByPk(eventId);
  if (!event) throw new Error('Event not found');
  if (!event.attendance_enabled) throw new Error('Attendance marking is disabled for this event');

  const user = await User.findByPk(studentId);
  if (!user) throw new Error('Student not found');
  if (user.user_type !== 'STUDENT') throw new Error('User is not a student');

  const attendanceData = {
    event_id: eventId,
    student_id: studentId,
    school_id: event.institute_id,
    branch_id: event.branch_id,
    date: event.date,
    status: status.toLowerCase(),
    type: 'event',
    marked_by: markedBy,
    remarks,
  };

  // Upsert by student_id + date + event_id
  const [attendance, created] = await StudentAttendance.findOrCreate({
    where: { student_id: studentId, date: event.date, event_id: eventId },
    defaults: attendanceData,
  });

  if (!created) {
    await attendance.update(attendanceData);
  }

  // Notify student
  await createNotification({
    institute_id: event.institute_id,
    branch_id: event.branch_id,
    user_id: studentId,
    title: `📋 Attendance Marked: ${event.event_name}`,
    body: `You have been marked ${status.toUpperCase()} for ${event.event_name} on ${event.date}`,
    type: 'attendance',
    data: { event_id: eventId, status, event_name: event.event_name },
  });

  // Notify parent(s) of this student
  await notifyParentOfAttendance(event, studentId, status);

  return attendance;
};

/**
 * Mark staff attendance for an event
 * @param {String} eventId - Event UUID
 * @param {String} staffId - Staff/Teacher UUID
 * @param {String} status - PRESENT | ABSENT | LATE | LEAVE
 * @param {String} markedBy - User UUID who marked
 * @param {String} remarks - Optional remarks
 */
export const markStaffEventAttendance = async (eventId, staffId, status, markedBy, remarks = '') => {
  const event = await Event.findByPk(eventId);
  if (!event) throw new Error('Event not found');
  if (!event.attendance_enabled) throw new Error('Attendance marking is disabled for this event');

  const user = await User.findByPk(staffId);
  if (!user) throw new Error('Staff not found');
  if (!['STAFF', 'TEACHER'].includes(user.user_type)) {
    throw new Error('User is not a staff member or teacher');
  }

  const attendanceData = {
    event_id: eventId,
    staff_id: staffId,
    institute_id: event.institute_id,
    branch_id: event.branch_id,
    date: event.date,
    status: status.toUpperCase(),
    attendance_type: 'event',
    marked_by: markedBy,
    marked_at: new Date(),
    remarks,
  };

  // Upsert by staff_id + date + event_id
  const [attendance, created] = await StaffAttendance.findOrCreate({
    where: { staff_id: staffId, date: event.date, event_id: eventId },
    defaults: attendanceData,
  });

  if (!created) {
    await attendance.update(attendanceData);
  }

  // Notify staff
  await createNotification({
    institute_id: event.institute_id,
    branch_id: event.branch_id,
    user_id: staffId,
    title: `📋 Attendance Marked: ${event.event_name}`,
    body: `You have been marked ${status.toUpperCase()} for ${event.event_name} on ${event.date}`,
    type: 'attendance',
    data: { event_id: eventId, status, event_name: event.event_name },
  });

  return attendance;
};

/**
 * Notify parent when student's event attendance is marked
 */
const notifyParentOfAttendance = async (event, studentId, status) => {
  try {
    const parents = await User.findAll({
      where: {
        school_id: event.institute_id,
        user_type: 'PARENT',
        is_active: true,
      },
      attributes: ['id', 'details'],
      raw: true,
    });

    const parentIdsToNotify = [];
    for (const parent of parents) {
      const studentIds = parent.details?.parentDetails?.student_ids || [];
      if (studentIds.includes(studentId)) {
        parentIdsToNotify.push(parent.id);
      }
    }

    if (parentIdsToNotify.length === 0) return;

    const notifPromises = parentIdsToNotify.map((parentId) =>
      createNotification({
        institute_id: event.institute_id,
        branch_id: event.branch_id,
        user_id: parentId,
        title: `👨‍👩‍👧 Child Attendance: ${event.event_name}`,
        body: `Your child has been marked ${status.toUpperCase()} for ${event.event_name} on ${event.date}`,
        type: 'attendance',
        data: { event_id: event.id, status, event_name: event.event_name, for_child: true },
      })
    );

    await Promise.all(notifPromises);
    logger.info(`📢 Parent attendance notification sent to ${parentIdsToNotify.length} parents`);
  } catch (error) {
    logger.error(`❌ Parent attendance notification failed: ${error.message}`);
  }
};

/**
 * Bulk mark student attendance for an event
 */
export const bulkMarkStudentEventAttendance = async (eventId, studentIds, status, markedBy) => {
  const results = { success: [], failed: [] };
  for (const studentId of studentIds) {
    try {
      const attendance = await markStudentEventAttendance(eventId, studentId, status, markedBy);
      results.success.push({ studentId, attendanceId: attendance.id });
    } catch (err) {
      results.failed.push({ studentId, error: err.message });
    }
  }
  return results;
};

/**
 * Bulk mark staff attendance for an event
 */
export const bulkMarkStaffEventAttendance = async (eventId, staffIds, status, markedBy) => {
  const results = { success: [], failed: [] };
  for (const staffId of staffIds) {
    try {
      const attendance = await markStaffEventAttendance(eventId, staffId, status, markedBy);
      results.success.push({ staffId, attendanceId: attendance.id });
    } catch (err) {
      results.failed.push({ staffId, error: err.message });
    }
  }
  return results;
};

/**
 * Get event attendance summary (students + staff)
 */
export const getEventAttendanceSummary = async (eventId, institute_id) => {
  const event = await Event.findOne({ where: { id: eventId, institute_id } });
  if (!event) throw new Error('Event not found');

  const [studentAttendances, staffAttendances] = await Promise.all([
    StudentAttendance.findAll({
      where: { event_id: eventId },
      include: [{ model: User, as: 'Student', attributes: ['id', 'first_name', 'last_name', 'registration_no'] }],
    }),
    StaffAttendance.findAll({
      where: { event_id: eventId },
      include: [{ model: User, as: 'staff', attributes: ['id', 'first_name', 'last_name'] }],
    }),
  ]);

  const studentsPresent = studentAttendances.filter((s) => s.status === 'present').length;
  const studentsAbsent = studentAttendances.filter((s) => s.status === 'absent').length;
  const studentsLate = studentAttendances.filter((s) => s.status === 'late').length;
  const studentsLeave = studentAttendances.filter((s) => s.status === 'leave').length;

  const staffPresent = staffAttendances.filter((s) => s.status === 'PRESENT').length;
  const staffAbsent = staffAttendances.filter((s) => s.status === 'ABSENT').length;
  const staffLate = staffAttendances.filter((s) => s.status === 'LATE').length;
  const staffLeave = staffAttendances.filter((s) => s.status === 'LEAVE').length;

  return {
    event: {
      id: event.id,
      event_name: event.event_name,
      date: event.date,
      attendance_enabled: event.attendance_enabled,
    },
    summary: {
      students: {
        total: studentAttendances.length,
        present: studentsPresent,
        absent: studentsAbsent,
        late: studentsLate,
        leave: studentsLeave,
      },
      staff: {
        total: staffAttendances.length,
        present: staffPresent,
        absent: staffAbsent,
        late: staffLate,
        leave: staffLeave,
      },
    },
    students: studentAttendances.map((s) => ({
      id: s.id,
      student_id: s.student_id,
      name: s.Student ? `${s.Student.first_name} ${s.Student.last_name}`.trim() : 'Unknown',
      registration_no: s.Student?.registration_no || null,
      status: s.status,
      remarks: s.remarks,
      marked_at: s.created_at,
    })),
    staff: staffAttendances.map((s) => ({
      id: s.id,
      staff_id: s.staff_id,
      name: s.staff ? `${s.staff.first_name} ${s.staff.last_name}`.trim() : 'Unknown',
      status: s.status,
      remarks: s.remarks,
      marked_at: s.marked_at,
    })),
  };
};

export default {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  toggleEventStatus,
  getUpcomingEvents,
  getEventsForUser,
  markStudentEventAttendance,
  markStaffEventAttendance,
  bulkMarkStudentEventAttendance,
  bulkMarkStaffEventAttendance,
  getEventAttendanceSummary,
};

