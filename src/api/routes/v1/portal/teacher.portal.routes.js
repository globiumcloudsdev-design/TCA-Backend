// backend/src/routes/v1/portal/teacher.portal.routes.js

/**
 * The Clouds Academy - Teacher Portal Routes
 * 
 * Teacher ke saare portal-specific routes ek hi file mein
 */

import { Router } from 'express';
import { protect, isTeacher } from '../../../middlewares/auth.middleware.js';
import { uploadFields, uploadSingle } from '../../../middlewares/upload.middleware.js';
import * as teacherPortal from '../../../controllers/portal/teacherPortal.controller.js';

const router = Router();

// All routes require authentication and teacher role
router.use(protect);
router.use(isTeacher);

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', teacherPortal.getDashboard);

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', teacherPortal.getProfile);
router.put('/profile', uploadSingle('avatar'), teacherPortal.updateProfile);

// ─────────────────────────────────────────────────────────────────────────────
// CLASSES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/classes', teacherPortal.getMyClasses);
router.get('/classes/:classId', teacherPortal.getClassDetails);

// ─────────────────────────────────────────────────────────────────────────────
// STUDENTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/students', teacherPortal.getMyStudents);
router.get('/students/:studentId', teacherPortal.getStudentDetails);

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────
router.post('/assignments', uploadFields([
	{ name: 'attachments', maxCount: 10 },
	{ name: 'files', maxCount: 10 }
]), teacherPortal.createAssignment);
router.get('/assignments', teacherPortal.getMyAssignments);
router.get('/assignments/:assignmentId', teacherPortal.getAssignmentDetails);
router.put('/assignments/:assignmentId', uploadFields([
	{ name: 'attachments', maxCount: 10 },
	{ name: 'files', maxCount: 10 }
]), teacherPortal.updateAssignment);
router.delete('/assignments/:assignmentId', teacherPortal.deleteAssignment);

// Submissions
router.get('/assignments/:assignmentId/submissions', teacherPortal.getAssignmentSubmissions);
router.post('/submissions/:submissionId/grade', teacherPortal.gradeSubmission);

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────
router.post('/attendance/mark', teacherPortal.markAttendance);
router.get('/attendance/class/:classId', teacherPortal.getClassAttendance);
router.get('/attendance/student/:studentId', teacherPortal.getStudentAttendance);

// ─────────────────────────────────────────────────────────────────────────────
// TIMETABLE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/timetable', teacherPortal.getMyTimetable);

// ─────────────────────────────────────────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/notices', teacherPortal.getNotices);

// ─────────────────────────────────────────────────────────────────────────────
// EXAM MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/exam-assignments', teacherPortal.getAssignments); // Get available classes/subjects for exams
router.get('/exams', teacherPortal.getExams); // List teacher exams with filters
router.post('/exams', teacherPortal.createExam); // Create new exam
router.get('/exams/:examId', teacherPortal.getExamDetails); // Exam detail + stats
router.get('/exams/:examId/results', teacherPortal.getExamResults); // Students + results
router.post('/exams/:examId/results', teacherPortal.addExamResults); // Save marks

// EXAM MANAGEMENT - Add this new route
router.get('/exams/:examId/entry-students', teacherPortal.getExamEntryStudents); // For Enter Marks page

export default router;