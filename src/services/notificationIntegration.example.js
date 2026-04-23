/**
 * The Clouds Academy - Notification Integration Guide
 *
 * This file shows how to integrate notifications into your services
 * Examples for:
 * ✅ Attendance Creation
 * ✅ Fee Voucher Creation
 * ✅ Exam Publication
 * ✅ Custom User Actions
 * ✅ Broadcast Notifications
 */

import {
  createNotification,
  broadcastNotification,
} from '../notification.service.js';

// ─────────────────────────────────────────────────────────────────────
// EXAMPLE 1: NOTIFY PARENT WHEN ATTENDANCE IS MARKED
// ─────────────────────────────────────────────────────────────────────
/*
 * In your studentAttendance.service.js or wherever attendance is created:
 */

export const markAttendanceWithNotification = async (
  studentId,
  attendanceData,
  instituteId
) => {
  // ... your attendance creation logic ...

  // After successful attendance creation, notify parent
  const student = await StudentModel.findByPk(studentId);
  const parent = await UserModel.findOne({
    where: { school_id: instituteId, user_type: 'PARENT' },
    // Could also filter by student_id if there's a relationship
  });

  if (parent) {
    await createNotification(
      {
        institute_id: instituteId,
        user_id: parent.id,
        title: `Attendance: ${student.first_name} ${student.last_name}`,
        body: `Attendance has been marked for ${attendanceData.status || 'not specified'}`,
        type: 'attendance',
        channel: 'in_app', // or 'email', 'sms', 'push'
        data: {
          studentId,
          studentName: `${student.first_name} ${student.last_name}`,
          status: attendanceData.status,
          date: attendanceData.date,
          class: student.class_name,
          section: student.section_name,
        },
      },
      true // emitRealtime
    );
  }

  return { success: true };
};

// ─────────────────────────────────────────────────────────────────────
// EXAMPLE 2: NOTIFY ALL PARENTS WHEN FEE VOUCHER IS CREATED
// ─────────────────────────────────────────────────────────────────────
/*
 * In your fee.service.js or feeVoucher.service.js:
 */

export const createFeeVoucherWithNotification = async (
  voucherData,
  instituteId,
  branchId
) => {
  // ... your fee voucher creation logic ...

  // After successful voucher creation, broadcast to all parents
  await broadcastNotification({
    institute_id: instituteId,
    branch_id: branchId || null,
    recipient_type: 'ALL_PARENTS',
    title: `New Fee Voucher Generated`,
    body: `A new fee voucher of Rs. ${voucherData.amount} has been generated for the month of ${voucherData.month}`,
    type: 'fee',
    channel: 'in_app',
    data: {
      voucherId: voucherData.id,
      amount: voucherData.amount,
      month: voucherData.month,
      dueDate: voucherData.due_date,
      studentClass: voucherData.class_name,
    },
    emitRealtime: true,
  });

  return { success: true };
};

// ─────────────────────────────────────────────────────────────────────
// EXAMPLE 3: NOTIFY STUDENTS WHEN EXAM RESULTS ARE PUBLISHED
// ─────────────────────────────────────────────────────────────────────
/*
 * In your exam.service.js:
 */

export const publishExamResultsWithNotification = async (
  examId,
  instituteId,
  branchId
) => {
  // ... your exam result publication logic ...

  // Broadcast to all students
  await broadcastNotification({
    institute_id: instituteId,
    branch_id: branchId || null,
    recipient_type: 'ALL_STUDENTS',
    title: `Exam Results Published`,
    body: `Results for the examination have been published. Check your results now!`,
    type: 'exam',
    channel: 'in_app',
    data: {
      examId,
      resultUrl: `/portal/student/results/${examId}`,
    },
    emitRealtime: true,
  });

  return { success: true };
};

// ─────────────────────────────────────────────────────────────────────
// EXAMPLE 4: NOTIFY SPECIFIC TEACHER
// ─────────────────────────────────────────────────────────────────────
/*
 * Notify a specific teacher about class assignment or leave request:
 */

export const notifyTeacherAboutLeaveRequest = async (
  teacherId,
  leaveRequestData,
  instituteId
) => {
  await createNotification(
    {
      institute_id: instituteId,
      user_id: teacherId,
      title: `Leave Request from Staff`,
      body: `A new leave request has been submitted from ${leaveRequestData.staffName} for ${leaveRequestData.dates}`,
      type: 'alert',
      channel: 'in_app',
      data: {
        requestId: leaveRequestData.id,
        staffName: leaveRequestData.staffName,
        dates: leaveRequestData.dates,
        reason: leaveRequestData.reason,
      },
    },
    true
  );
};

// ─────────────────────────────────────────────────────────────────────
// EXAMPLE 5: NOTIFY ALL STAFF ABOUT SCHOOL EVENT
// ─────────────────────────────────────────────────────────────────────
/*
 * In your event or announcement service:
 */

export const announceEventToAllStaff = async (
  eventData,
  instituteId,
  branchId
) => {
  await broadcastNotification({
    institute_id: instituteId,
    branch_id: branchId || null,
    recipient_type: 'ALL_STAFF',
    title: `New Event Announcement: ${eventData.title}`,
    body: eventData.description,
    type: 'general',
    channel: 'in_app',
    data: {
      eventId: eventData.id,
      date: eventData.date,
      time: eventData.time,
      location: eventData.location,
    },
    emitRealtime: true,
  });
};

// ─────────────────────────────────────────────────────────────────────
// EXAMPLE 6: NOTIFY PARENTS ABOUT UPCOMING EXAM
// ─────────────────────────────────────────────────────────────────────

export const notifyParentsAboutExam = async (
  examData,
  instituteId,
  branchId
) => {
  await broadcastNotification({
    institute_id: instituteId,
    branch_id: branchId || null,
    recipient_type: 'ALL_PARENTS',
    title: `Upcoming Exam: ${examData.subject}`,
    body: `Exam scheduled on ${examData.date} at ${examData.time}. Total marks: ${examData.totalMarks}`,
    type: 'exam',
    channel: 'in_app',
    data: {
      examId: examData.id,
      subject: examData.subject,
      date: examData.date,
      time: examData.time,
      totalMarks: examData.totalMarks,
      examUrl: `/portal/parent/results?exam=${examData.id}`,
    },
    emitRealtime: true,
  });
};

// ─────────────────────────────────────────────────────────────────────
// EXAMPLE 7: NOTIFY ADMIN ABOUT SYSTEM EVENTS
// ─────────────────────────────────────────────────────────────────────

export const notifyAdminAboutSystemEvent = async (
  eventType,
  message,
  instituteId
) => {
  await broadcastNotification({
    institute_id: instituteId,
    recipient_type: 'ALL_ADMINS',
    title: `System Alert: ${eventType}`,
    body: message,
    type: eventType === 'ERROR' ? 'alert' : 'system',
    channel: 'in_app',
    data: {
      eventType,
      timestamp: new Date().toISOString(),
    },
    emitRealtime: true,
  });
};

// ─────────────────────────────────────────────────────────────────────
// RECIPIENT TYPES REFERENCE
// ─────────────────────────────────────────────────────────────────────
/*
 * Use these values in broadcastNotification():
 *
 * ✅ ALL_PARENTS / PARENTS
 * ✅ ALL_STUDENTS / STUDENTS
 * ✅ ALL_TEACHERS / TEACHERS
 * ✅ ALL_STAFF / STAFF
 * ✅ ALL_ADMINS / ADMINS (Institute Admins)
 * ✅ ALL_BRANCH_ADMINS / BRANCH_ADMINS
 *
 * Example:
 * await broadcastNotification({
 *   ...
 *   recipient_type: 'ALL_PARENTS',
 *   ...
 * });
 */

// ─────────────────────────────────────────────────────────────────────
// NOTIFICATION TYPES REFERENCE
// ─────────────────────────────────────────────────────────────────────
/*
 * Available notification types:
 *
 * ✅ 'fee' - Fee-related notifications
 * ✅ 'attendance' - Attendance-related notifications
 * ✅ 'exam' - Exam and result-related notifications
 * ✅ 'general' - General announcements and info
 * ✅ 'alert' - Important alerts and warnings
 * ✅ 'system' - System-level notifications
 *
 * Example:
 * type: 'fee', // Changes badge color to green
 * type: 'exam', // Changes badge color to purple
 * type: 'alert', // Changes badge color to red
 */

// ─────────────────────────────────────────────────────────────────────
// CHANNELS REFERENCE
// ─────────────────────────────────────────────────────────────────────
/*
 * Available notification channels:
 *
 * ✅ 'in_app' - In-app notification (default)
 * ✅ 'email' - Email notification (requires email service)
 * ✅ 'sms' - SMS notification (requires SMS service)
 * ✅ 'push' - Push notification (requires push service)
 *
 * You can send through multiple channels if needed.
 *
 * Example:
 * channel: 'in_app', // Only in-app
 * channel: 'email', // Send email
 * channel: 'sms', // Send SMS
 */

export default {
  markAttendanceWithNotification,
  createFeeVoucherWithNotification,
  publishExamResultsWithNotification,
  notifyTeacherAboutLeaveRequest,
  announceEventToAllStaff,
  notifyParentsAboutExam,
  notifyAdminAboutSystemEvent,
};
