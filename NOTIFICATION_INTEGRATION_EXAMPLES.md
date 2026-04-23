/**
 * PRACTICAL INTEGRATION GUIDE
 * How to add notifications to existing services
 *
 * THIS FILE SHOWS EXACT CODE YOU CAN USE IN YOUR SERVICES
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣ INTEGRATE NOTIFICATIONS IN FEE SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/*
 * FILE: src/services/fee.service.js
 * WHEN: After creating fee voucher
 */

// ADD THIS IMPORT AT THE TOP:
// import { broadcastNotification } from './notification.service.js';

// FIND THE FUNCTION WHERE YOU CREATE FEE VOUCHERS:
// export const createFeeVoucher = async (instituteId, data, userId) => {
//   // ... your existing code ...
//   const voucher = await FeeVoucher.create({...});
//
//   // ADD THIS AFTER VOUCHER CREATION:
//   try {
//     await broadcastNotification({
//       institute_id: instituteId,
//       branch_id: data.branch_id || null, // If you have branch info
//       recipient_type: 'ALL_PARENTS',
//       title: `Fee Voucher Generated - ${data.month || 'This Month'}`,
//       body: `A fee voucher of Rs. ${voucher.amount} has been generated. Due Date: ${new Date(voucher.due_date).toLocaleDateString()}`,
//       type: 'fee',
//       channel: 'in_app',
//       data: {
//         voucherId: voucher.id,
//         studentClass: data.class_name,
//         amount: voucher.amount,
//         month: data.month,
//         dueDate: voucher.due_date,
//         voucherUrl: `/portal/parent/fees/${voucher.id}`
//       },
//       emitRealtime: true
//     });
//   } catch (notificationError) {
//     console.error('Failed to send notification:', notificationError);
//     // Don't fail the voucher creation if notification fails
//   }
//
//   return voucher;
// }

// ═══════════════════════════════════════════════════════════════════════════
// 2️⃣ INTEGRATE NOTIFICATIONS IN ATTENDANCE SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/*
 * FILE: src/services/studentAttendance.service.js
 * WHEN: After marking attendance
 */

// ADD THIS IMPORT AT THE TOP:
// import { createNotification, broadcastNotification } from './notification.service.js';

// OPTION A: NOTIFY SPECIFIC PARENT
// export const markAttendance = async (studentId, status, date, instituteId) => {
//   // ... mark attendance ...
//   const record = await Attendance.create({...});
//
//   // NOTIFY PARENT
//   try {
//     const student = await User.findByPk(studentId);
//     const parent = await User.findOne({
//       where: { 
//         school_id: instituteId,
//         user_type: 'PARENT',
//         details: {/* where student_ids contains studentId */}
//       }
//     });
//
//     if (parent) {
//       await createNotification({
//         institute_id: instituteId,
//         user_id: parent.id,
//         title: `${student.first_name}'s Attendance - ${date}`,
//         body: `Attendance marked as ${status === 'present' ? '✅ Present' : status === 'absent' ? '❌ Absent' : '⏰ Late'}`,
//         type: 'attendance',
//         channel: 'in_app',
//         data: {
//           studentId,
//           studentName: `${student.first_name} ${student.last_name}`,
//           status,
//           date: new Date(date).toISOString(),
//           studentClass: student.class_name,
//           attendanceUrl: `/portal/parent/attendance`
//         },
//         emitRealtime: true
//       });
//     }
//   } catch (notificationError) {
//     console.error('Failed to send attendance notification:', notificationError);
//   }
//
//   return record;
// }

// OPTION B: BROADCAST ATTENDANCE REPORT TO ALL PARENTS (DAILY/WEEKLY)
// export const broadcastDailyAttendanceReport = async (instituteId, branchId, date) => {
//   try {
//     const attendanceStats = {
//       total: 250,
//       present: 220,
//       absent: 20,
//       late: 10,
//       date: new Date(date).toLocaleDateString()
//     };
//
//     await broadcastNotification({
//       institute_id: instituteId,
//       branch_id: branchId || null,
//       recipient_type: 'ALL_PARENTS',
//       title: `Daily Attendance Report - ${attendanceStats.date}`,
//       body: `Present: ${attendanceStats.present} | Absent: ${attendanceStats.absent} | Late: ${attendanceStats.late}`,
//       type: 'attendance',
//       channel: 'in_app',
//       data: attendanceStats,
//       emitRealtime: true
//     });
//   } catch (error) {
//     console.error('Failed to broadcast attendance report:', error);
//   }
// }

// ═══════════════════════════════════════════════════════════════════════════
// 3️⃣ INTEGRATE NOTIFICATIONS IN EXAM SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/*
 * FILE: src/services/exam.service.js
 * WHEN: After publishing results
 */

// ADD THIS IMPORT AT THE TOP:
// import { broadcastNotification } from './notification.service.js';

// WHEN MARKING EXAM AS RESULTS_PUBLISHED:
// export const publishExamResults = async (examId, instituteId) => {
//   // ... update exam status ...
//   const exam = await Exam.update(
//     { status: 'results_published' },
//     { where: { id: examId }, returning: true }
//   );
//
//   // NOTIFY ALL STUDENTS
//   try {
//     await broadcastNotification({
//       institute_id: instituteId,
//       recipient_type: 'ALL_STUDENTS',
//       title: `📊 ${exam.subject_name} Results Published`,
//       body: `Results for your ${exam.subject_name} exam are now available. Check your performance!`,
//       type: 'exam',
//       channel: 'in_app',
//       data: {
//         examId: exam.id,
//         subject: exam.subject_name,
//         totalMarks: exam.total_marks,
//         publishedDate: new Date().toISOString(),
//         resultsUrl: `/portal/student/results?exam=${examId}`
//       },
//       emitRealtime: true
//     });
//
//     // ALSO NOTIFY ALL PARENTS
//     await broadcastNotification({
//       institute_id: instituteId,
//       recipient_type: 'ALL_PARENTS',
//       title: `📊 ${exam.subject_name} Results Released`,
//       body: `Your child's exam results for ${exam.subject_name} have been released.`,
//       type: 'exam',
//       channel: 'in_app',
//       data: {
//         examId: exam.id,
//         subject: exam.subject_name,
//         resultsUrl: `/portal/parent/results`
//       },
//       emitRealtime: true
//     });
//   } catch (notificationError) {
//     console.error('Failed to send exam notification:', notificationError);
//   }
//
//   return exam;
// }

// ═══════════════════════════════════════════════════════════════════════════
// 4️⃣ INTEGRATE NOTIFICATIONS IN LEAVE REQUEST SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/*
 * FILE: src/services/leaveRequest.service.js
 * WHEN: After submitting leave request
 */

// ADD THIS IMPORT AT THE TOP:
// import { createNotification } from './notification.service.js';

// WHEN STAFF SUBMITS LEAVE REQUEST:
// export const submitLeaveRequest = async (staffId, leaveData, instituteId) => {
//   // ... create leave request ...
//   const request = await LeaveRequest.create({...});
//
//   // NOTIFY HOD/REPORTING OFFICER
//   try {
//     const staff = await User.findByPk(staffId);
//     const hod = await User.findByPk(leaveData.reporting_officer_id);
//
//     if (hod) {
//       await createNotification({
//         institute_id: instituteId,
//         user_id: hod.id,
//         title: `Leave Request from ${staff.first_name}`,
//         body: `${leaveData.days_count || 1} day(s) leave requested from ${new Date(leaveData.from_date).toLocaleDateString()}`,
//         type: 'alert',
//         channel: 'in_app',
//         data: {
//           requestId: request.id,
//           staffId,
//           staffName: `${staff.first_name} ${staff.last_name}`,
//           fromDate: leaveData.from_date,
//           toDate: leaveData.to_date,
//           leaveType: leaveData.leave_type,
//           reason: leaveData.reason,
//           reviewUrl: `/portal/admin/leave-requests/${request.id}`
//         },
//         emitRealtime: true
//       });
//     }
//   } catch (notificationError) {
//     console.error('Failed to notify HOD:', notificationError);
//   }
//
//   return request;
// }

// ═══════════════════════════════════════════════════════════════════════════
// 5️⃣ INTEGRATE NOTIFICATIONS IN PAYMENT COLLECTION
// ═══════════════════════════════════════════════════════════════════════════

/*
 * FILE: src/services/fee.service.js
 * WHEN: After collecting payment
 */

// export const collectPayment = async (voucherId, paymentData, instituteId) => {
//   // ... collect payment ...
//   const payment = await Payment.create({...});
//
//   // NOTIFY PARENT ABOUT SUCCESSFUL PAYMENT
//   try {
//     const voucher = await FeeVoucher.findByPk(voucherId, {
//       include: ['Student']
//     });
//
//     if (voucher?.Student?.parent_id) {
//       await createNotification({
//         institute_id: instituteId,
//         user_id: voucher.Student.parent_id,
//         title: `✅ Payment Received`,
//         body: `Thank you! We received Rs. ${paymentData.amount}. Receipt has been sent to your email.`,
//         type: 'fee',
//         channel: 'in_app',
//         data: {
//           paymentId: payment.id,
//           voucherId,
//           amount: paymentData.amount,
//           transactionId: paymentData.transaction_id,
//           date: new Date().toISOString(),
//           receiptUrl: `/portal/parent/fees/receipts/${payment.id}`
//         },
//         emitRealtime: true
//       });
//     }
//   } catch (notificationError) {
//     console.error('Failed to send payment notification:', notificationError);
//   }
//
//   return payment;
// }

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTANT NOTES
// ═══════════════════════════════════════════════════════════════════════════

/*
 * ✅ BEST PRACTICES:
 *
 * 1. ALWAYS wrap notifications in try-catch
 *    - Notification failure should NOT fail the main operation
 *
 * 2. ALWAYS set emitRealtime: true
 *    - Users see notifications INSTANTLY
 *
 * 3. ALWAYS include helpful data
 *    - Include IDs, URLs, and context
 *    - Makes notifications actionable
 *
 * 4. CHOOSE correct type
 *    - 'fee' for fee-related
 *    - 'attendance' for attendance
 *    - 'exam' for exam/results
 *    - 'alert' for warnings
 *    - 'general' for announcements
 *
 * 5. SET correct recipient_type
 *    - ALL_PARENTS, ALL_STUDENTS, ALL_TEACHERS, ALL_STAFF
 *    - For specific user, use createNotification instead
 *
 * 6. INCLUDE branch_id if applicable
 *    - Filters notifications to specific branch
 *    - Useful for multi-branch schools
 *
 * 7. MAKE titles and body user-friendly
 *    - Use emojis sparingly
 *    - Be concise and clear
 *    - Include relevant dates/amounts
 */

// ═══════════════════════════════════════════════════════════════════════════
// QUICK COPY-PASTE TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════

/*
 * USE THIS TEMPLATE FOR ANY SERVICE:

try {
  await broadcastNotification({
    institute_id: instituteId,
    branch_id: branchId || null,
    recipient_type: 'ALL_PARENTS', // CHANGE THIS
    title: 'Your title here',
    body: 'Your body text here',
    type: 'fee', // CHANGE THIS: fee, attendance, exam, alert, general
    channel: 'in_app',
    data: {
      // Include IDs, names, dates, amounts, URLs
      itemId: somId,
      actionUrl: '/path/to/resource'
    },
    emitRealtime: true
  });
} catch (notificationError) {
  console.error('Failed to send notification:', notificationError);
  // DO NOT FAIL THE MAIN OPERATION
}
*/

export default {};
