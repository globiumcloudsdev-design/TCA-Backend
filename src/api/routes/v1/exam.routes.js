
// // backend/src/routes/v1/exam.routes.js

// /**
//  * The Clouds Academy - Exam Routes (Simple Permissions)
//  */

// import { Router } from 'express';
// import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
// import { hasPermission } from '../../middlewares/permission.middleware.js';
// import * as examController from '../../controllers/exam.controller.js';

// const router = Router();

// // Har route ke liye authentication zaroori hai
// router.use(protect);

// // ==================== STUDENT/PARENT VIEWS (PEHLE) ====================
// router.get(
//   '/my-exams',
//   restrictTo('STUDENT', 'PARENT'),
//   hasPermission('exams.view_own'),
//   examController.getMyExams
// );

// router.get(
//   '/my-results',
//   restrictTo('STUDENT', 'PARENT'),
//   hasPermission('exams.view_own'),
//   examController.getMyResults
// );

// // ==================== OPTIONS / DROPDOWN ====================
// router.get(
//   '/options',
//   hasPermission('exams.read'),
//   examController.getExamOptions
// );

// // ==================== EXAM CRUD ====================
// router.post(
//   '/',
//   restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
//   hasPermission('exams.create'),
//   examController.createExam
// );

// router.get(
//   '/',
//   hasPermission('exams.read'),
//   examController.getAllExams
// );

// router.get(
//   '/:id',
//   hasPermission('exams.read'),
//   examController.getExamById
// );

// router.put(
//   '/:id',
//   restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
//   hasPermission('exams.update'),
//   examController.updateExam
// );

// router.delete(
//   '/:id',
//   restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN'),
//   hasPermission('exams.delete'),
//   examController.deleteExam
// );

// router.patch(
//   '/:id/status',
//   restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
//   hasPermission('exams.update'),
//   examController.updateExamStatus
// );

// router.post(
//   '/:id/publish',
//   restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN'),
//   hasPermission('exam.publish'),
//   examController.publishExam
// );

// // ==================== RESULTS MANAGEMENT ====================

// router.post(
//   '/:id/results',
//   restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
//   hasPermission('exams.result.enter'),
//   examController.addExamResults
// );

// router.post(
//   '/:id/results/bulk',
//   restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
//   hasPermission('exams.result.enter'),
//   examController.bulkUploadResults
// );

// router.get(
//   '/:id/results',
//   hasPermission('exams.result.view'),
//   examController.getExamResults
// );

// router.put(
//   '/results/:resultId',
//   restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
//   hasPermission('exams.result.update'),
//   examController.updateExamResult
// );

// router.delete(
//   '/results/:resultId',
//   restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN'),
//   hasPermission('exams.result.delete'),
//   examController.deleteExamResult
// );

// router.post(
//   '/:id/publish-results',
//   restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN'),
//   hasPermission('exams.result.publish'),
//   examController.publishExamResults
// );

// // ==================== ATTENDANCE MANAGEMENT (OPTIONAL) ====================

// router.post(
//   '/:id/attendance',
//   restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
//   hasPermission('exams.attendance.mark'),
//   examController.markExamAttendance
// );

// router.get(
//   '/:id/attendance',
//   hasPermission('exams.read'),
//   examController.getExamAttendance
// );

// // ==================== ANALYTICS & REPORTS ====================

// router.get(
//   '/:id/analytics',
//   hasPermission('exams.result.view'),
//   examController.getExamAnalytics
// );

// router.get(
//   '/:id/grade-sheet',
//   hasPermission('exams.result.view'),
//   examController.generateGradeSheet
// );

// router.get(
//   '/:id/download-results',
//   hasPermission('exams.result.export'),
//   examController.downloadExamResults
// );

// export default router;




// backend/src/routes/v1/exam.routes.js

import { Router } from 'express';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import * as examController from '../../controllers/exam.controller.js';

const router = Router();

// All routes require authentication
router.use(protect);

// ==================== STUDENT/PARENT VIEWS ====================
router.get(
  '/my-exams',
  restrictTo('STUDENT', 'PARENT'),
  examController.getMyExams
);

router.get(
  '/my-results',
  restrictTo('STUDENT', 'PARENT'),
  examController.getMyResults
);

// ==================== OPTIONS / DROPDOWN ====================
router.get(
  '/options',
  examController.getExamOptions
);

// ==================== EXAM CRUD ====================
router.post(
  '/',
  restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
  examController.createExam
);

router.get(
  '/',
  examController.getAllExams
);

router.get(
  '/:id',
  examController.getExamById
);

router.put(
  '/:id',
  restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
  examController.updateExam
);

router.delete(
  '/:id',
  restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN'),
  examController.deleteExam
);

router.patch(
  '/:id/status',
  restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
  examController.updateExamStatus
);

router.post(
  '/:id/publish',
  restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN'),
  examController.publishExam
);

// ==================== RESULTS MANAGEMENT ====================
router.post(
  '/:id/results',
  restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
  examController.addExamResults
);

router.get(
  '/:id/results',
  examController.getExamResults
);

router.put(
  '/results/:resultId',
  restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
  examController.updateExamResult
);

router.delete(
  '/results/:resultId',
  restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN'),
  examController.deleteExamResult
);

router.post(
  '/:id/publish-results',
  restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN'),
  examController.publishExamResults
);

router.get(
  '/:id/download-results',
  restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN', 'TEACHER'),
  examController.downloadExamResults
);

// ==================== ANALYTICS ====================
router.get(
  '/:id/analytics',
  examController.getExamAnalytics
);

router.get(
  '/:id/grade-sheet',
  examController.generateGradeSheet
);

export default router;