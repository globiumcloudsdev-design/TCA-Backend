// backend/src/routes/v1/portal/teacher.portal.routes.js

/**
 * The Clouds Academy - Teacher Portal Routes
 *
 * Teacher ke saare portal-specific routes ek hi file mein
 */

import { Router } from "express";
import { protect, isTeacher } from "../../../middlewares/auth.middleware.js";
import {
  uploadFields,
  uploadSingle,
} from "../../../middlewares/upload.middleware.js";
import { validate } from "../../../middlewares/validation.middleware.js";
import * as teacherPortal from "../../../controllers/portal/teacherPortal.controller.js";
import * as leaveRequestsPortal from "../../../controllers/portal/leaveRequests.portal.controller.js";
import * as selfAttendance from "../../../controllers/portal/teacherSelfAttendance.controller.js";
import {
  createLeaveRequestSchema,
  getMyLeaveRequestsQuerySchema,
  cancelLeaveRequestSchema,
} from "../../../validators/leaveRequest.validator.js";
import * as teacherPayroll from "../../../controllers/portal/teacherPayroll.controller.js";
import * as eventController from '../../../controllers/event.controller.js';

const router = Router();
router.use(protect);
router.use(isTeacher);

// DASHBOARD
router.get("/dashboard", teacherPortal.getDashboard);

// PROFILE
router.get("/profile", teacherPortal.getProfile);
router.put("/profile", uploadSingle("avatar"), teacherPortal.updateProfile);

// CLASSES
router.get("/classes", teacherPortal.getMyClasses);
router.get("/classes/:classId", teacherPortal.getClassDetails);

// STUDENTS
router.get("/students", teacherPortal.getMyStudents);
router.get("/students/:studentId", teacherPortal.getStudentDetails);

// ASSIGNMENTS
router.post(
  "/assignments",
  uploadFields([
    { name: "attachments", maxCount: 10 },
    { name: "files", maxCount: 10 },
  ]),
  teacherPortal.createAssignment,
);
router.get("/assignments", teacherPortal.getMyAssignments);
router.get("/assignments/:assignmentId", teacherPortal.getAssignmentDetails);
router.put(
  "/assignments/:assignmentId",
  uploadFields([
    { name: "attachments", maxCount: 10 },
    { name: "files", maxCount: 10 },
  ]),
  teacherPortal.updateAssignment,
);
router.delete("/assignments/:assignmentId", teacherPortal.deleteAssignment);
router.get(
  "/assignments/:assignmentId/submissions",
  teacherPortal.getAssignmentSubmissions,
);
router.post("/submissions/:submissionId/grade", teacherPortal.gradeSubmission);

// STUDENT ATTENDANCE (teacher marks students)
router.post("/attendance/mark", teacherPortal.markAttendance);
router.get("/attendance/class/:classId", teacherPortal.getClassAttendance);
router.get(
  "/attendance/student/:studentId",
  teacherPortal.getStudentAttendance,
);

// ─────────────────────────────────────────────────────────────────────────────
// SELF ATTENDANCE  (teacher apna check-in/out — StaffAttendance model)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/self-attendance/today", selfAttendance.getTodayStatus);
router.post("/self-attendance/check-in", selfAttendance.checkIn);
router.post("/self-attendance/check-out", selfAttendance.checkOut);
router.get("/self-attendance/history", selfAttendance.getHistory);
router.get("/self-attendance/report", selfAttendance.getReport);

// TIMETABLE
router.get("/timetable", teacherPortal.getMyTimetable);

// NOTICES
router.get("/notices", teacherPortal.getNotices);

// EXAM MANAGEMENT
router.get("/exam-assignments", teacherPortal.getAssignments);
router.get("/exams", teacherPortal.getExams);
router.post("/exams", teacherPortal.createExam);
router.get("/exams/:examId", teacherPortal.getExamDetails);
router.get("/exams/:examId/results", teacherPortal.getExamResults);
router.post("/exams/:examId/results", teacherPortal.addExamResults);
router.get("/exams/:examId/entry-students", teacherPortal.getExamEntryStudents);

// LEAVE REQUESTS (self-attendance page se "Apply Leave" yahan call hoga)
router.get(
  "/leave-requests/statistics",
  leaveRequestsPortal.getMyLeaveStatistics,
);
router.get("/leave-balance", leaveRequestsPortal.getLeaveBalance);
router.get(
  "/leave-requests/pending",
  leaveRequestsPortal.getPendingLeaveApprovals,
);
router.get(
  "/leave-requests",
  validate(getMyLeaveRequestsQuerySchema, "query"),
  leaveRequestsPortal.getMyLeaveRequests,
);
router.post(
  "/leave-requests",
  validate(createLeaveRequestSchema),
  leaveRequestsPortal.createLeaveRequest,
);
router.patch(
  "/leave-requests/:id/cancel",
  validate(cancelLeaveRequestSchema),
  leaveRequestsPortal.cancelLeaveRequest,
);

router.get("/payroll", teacherPayroll.getMyPayslips);
router.get("/payroll/years", teacherPayroll.getMyPayrollYears);
router.get("/payroll/:id", teacherPayroll.getMyPayslipById);

// EVENTS
router.get('/events', eventController.getMyEvents);

export default router;
