// backend/src/services/dashboard/teacherDashboard.service.js

/**
 * The Clouds Academy - Teacher Dashboard Service
 * 
 * Teacher ke liye complete portal data:
 * - My Classes
 * - My Students
 * - Today's Schedule
 * - Upcoming Tasks
 * - Recent Activity
 * - Assignments & Homework
 */

import { Op } from 'sequelize';
import models from '../../models/postgres/index.js';
import { startOfDay, endOfDay, addDays, format } from 'date-fns';

const { User, Timetable, sequelize } = models;

/**
 * Get complete teacher dashboard data
 */
export const getTeacherDashboard = async (teacherId, instituteId) => {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const tomorrow = addDays(today, 1);

  // Parallel queries for performance
  const [
    teacher,
    todaySchedule,
    myClasses,
    myStudents,
    recentActivity,
    upcomingTasks,
    statistics
  ] = await Promise.all([
    // Teacher details with role
    getTeacherDetails(teacherId, instituteId),

    // Today's schedule
    getTodaySchedule(teacherId, instituteId, todayStart, todayEnd),

    // Classes taught by this teacher
    getTeacherClasses(teacherId, instituteId),

    // Students in teacher's classes
    getTeacherStudents(teacherId, instituteId),

    // Recent activity (last 7 days)
    getRecentActivity(teacherId, instituteId),

    // Upcoming tasks (next 7 days)
    getUpcomingTasks(teacherId, instituteId, today, tomorrow),

    // Quick statistics
    getTeacherStatistics(teacherId, instituteId)
  ]);

  const t = teacher || {};
  return {
    teacher: {
      id: t.id || teacherId,
      name: `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Teacher',
      email: t.email,
      phone: t.phone,
      avatar: t.avatar_url,
      registration_no: t.registration_no,
      role: t.Role?.name || 'Teacher',
      details: t.details?.teacherDetails || {}
    },
    today_schedule: todaySchedule || [],
    my_classes: myClasses || [],
    my_students: myStudents,
    recent_activity: recentActivity,
    upcoming_tasks: upcomingTasks,
    statistics,
    quick_actions: [
      { label: 'Mark Attendance', icon: 'CheckSquare', href: '/attendance/mark', count: todaySchedule.length },
      { label: 'Upload Grades', icon: 'Award', href: '/grades/upload' },
      { label: 'Create Assignment', icon: 'FileText', href: '/assignments/create' },
      { label: 'View Reports', icon: 'BarChart', href: '/reports' }
    ]
  };
};

/**
 * Get teacher details with role
 */
const getTeacherDetails = async (teacherId, instituteId) => {
  return await User.findOne({
    where: { 
      id: teacherId, 
      school_id: instituteId, 
      user_type: 'TEACHER' 
    },
    include: [
      { model: models.Role, as: 'Role', attributes: ['id', 'name', 'permissions'] }
    ]
  });
};

/**
 * Get today's schedule for teacher
 */
const getTodaySchedule = async (teacherId, instituteId, todayStart, todayEnd) => {
  // Get all active timetables for this institute
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });

  const schedule = [];

  // Extract teacher's slots from timetables
  timetables.forEach(timetable => {
    const slots = timetable.slots || [];
    const todaySlots = slots.filter(slot => 
      slot.teacher_id === teacherId && 
      slot.day === format(todayStart, 'EEEE').toLowerCase()
    );

    todaySlots.forEach(slot => {
      schedule.push({
        id: slot.id,
        time: `${slot.start_time} - ${slot.end_time}`,
        period: slot.period,
        subject: slot.subject_name,
        class: getEntityName(timetable.entity_ids),
        room: slot.room_no,
        type: slot.is_break ? 'break' : 'class'
      });
    });
  });

  // Sort by start time
  return schedule.sort((a, b) => a.start_time?.localeCompare(b.start_time || ''));
};

/**
 * Get classes taught by teacher
 */
const getTeacherClasses = async (teacherId, instituteId) => {
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });

  const classesMap = new Map();

  timetables.forEach(timetable => {
    const slots = timetable.slots || [];
    const teacherSlots = slots.filter(slot => slot.teacher_id === teacherId);

    if (teacherSlots.length > 0) {
      const entityName = getEntityName(timetable.entity_ids);
      const entityType = timetable.entity_type;

      if (!classesMap.has(entityName)) {
        classesMap.set(entityName, {
          id: timetable.id,
          name: entityName,
          type: entityType,
          subjects: new Set(),
          students_count: 0,
          schedule: []
        });
      }

      const classData = classesMap.get(entityName);
      teacherSlots.forEach(slot => {
        if (slot.subject_name) {
          classData.subjects.add(slot.subject_name);
        }
        classData.schedule.push({
          day: slot.day,
          time: `${slot.start_time} - ${slot.end_time}`,
          subject: slot.subject_name,
          room: slot.room_no
        });
      });
    }
  });

  // Convert to array and get student counts
  const result = [];
  for (const [name, data] of classesMap) {
    const studentCount = await getStudentCountForClass(data.id, instituteId);
    result.push({
      ...data,
      subjects: Array.from(data.subjects),
      students_count: studentCount,
      schedule: data.schedule.slice(0, 5) // Only next 5 sessions
    });
  }

  return result;
};

const getTeacherStudents = async (teacherId, instituteId) => {
  try {
    const students = await User.findAll({
      where: {
        school_id: instituteId,
        user_type: 'STUDENT',
        is_active: true,
      },
      attributes: ['id', 'first_name', 'last_name', 'registration_no', 'avatar_url', 'details'],
      limit: 20
    });

    return students.map(student => ({
      id: student.id,
      name: `${student.first_name} ${student.last_name}`,
      registration_no: student.registration_no,
      avatar: student.avatar_url,
      class: student.details?.class_name,
      section: student.details?.section_name,
      attendance_percentage: student.details?.attendance_percentage || 0
    }));
  } catch {
    return [];
  }
};

/**
 * Get recent activity (last 7 days)
 */
const getRecentActivity = async (teacherId, instituteId) => {
  // This would query activity logs, attendance marks, grade entries etc.
  // For now returning mock data structure
  return [
    {
      id: 1,
      type: 'attendance',
      title: 'Marked attendance for Class 10-A',
      time: '2 hours ago',
      icon: 'CheckSquare'
    },
    {
      id: 2,
      type: 'grade',
      title: 'Uploaded mid-term exam results',
      time: 'Yesterday',
      icon: 'Award'
    },
    {
      id: 3,
      type: 'assignment',
      title: 'Created new assignment for Mathematics',
      time: '2 days ago',
      icon: 'FileText'
    }
  ];
};

/**
 * Get upcoming tasks (next 7 days)
 */
const getUpcomingTasks = async (teacherId, instituteId, today, tomorrow) => {
  // This would query assignments, exams, meetings etc.
  return [
    {
      id: 1,
      title: 'Grade Mathematics assignments',
      due_date: format(addDays(today, 1), 'yyyy-MM-dd'),
      priority: 'high',
      subject: 'Mathematics',
      class: '10-A'
    },
    {
      id: 2,
      title: 'Prepare Physics practical exam',
      due_date: format(addDays(today, 3), 'yyyy-MM-dd'),
      priority: 'medium',
      subject: 'Physics',
      class: '12-B'
    }
  ];
};

/**
 * Get teacher statistics
 */
const getTeacherStatistics = async (teacherId, instituteId) => {
  const students = await getTeacherStudents(teacherId, instituteId);
  
  return {
    total_students: students.length,
    total_classes: (await getTeacherClasses(teacherId, instituteId)).length,
    total_subjects: 0, // Calculate from classes
    attendance_rate: 92, // Mock - calculate from actual attendance
    average_grade: 'A-', // Mock - calculate from grades
    pending_work: 5 // Mock - count pending tasks
  };
};

/**
 * Helper: Get readable entity name from entity_ids
 */
const getEntityName = (entityIds) => {
  if (!entityIds) return 'Unknown';
  
  if (entityIds.class_name) return entityIds.class_name;
  if (entityIds.course_name) return entityIds.course_name;
  if (entityIds.program_name) return entityIds.program_name;
  
  const parts = [];
  if (entityIds.class_name) parts.push(entityIds.class_name);
  if (entityIds.section_name) parts.push(entityIds.section_name);
  if (entityIds.batch_name) parts.push(entityIds.batch_name);
  
  return parts.join(' - ') || 'Class';
};

/**
 * Helper: Get student count for a class
 */
const getStudentCountForClass = async (classId, instituteId) => {
  try {
    return await User.count({
      where: {
        school_id: instituteId,
        user_type: 'STUDENT',
        is_active: true
      }
    });
  } catch {
    return 0;
  }
};

export default {
  getTeacherDashboard
};