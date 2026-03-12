/**
 * The Clouds Academy — All Permission Codes
 * Dynamic Role System
 *
 * Format: 'module.action'  (e.g. 'student.create')
 * These EXACTLY match the hasPermission() calls in all route files.
 * Frontend mirror: src/constants/permissions.js
 */

export const PERMISSIONS = {
  // ── Students ─────────────────────────────────────────────────────
  STUDENT_CREATE:        'student.create',
  STUDENT_READ:          'student.read',
  STUDENT_UPDATE:        'student.update',
  STUDENT_DELETE:        'student.delete',
  STUDENT_EXPORT:        'student.export',

  // ── Admissions ───────────────────────────────────────────────────
  ADMISSION_CREATE:      'admission.create',
  ADMISSION_READ:        'admission.read',
  ADMISSION_UPDATE:      'admission.update',
  ADMISSION_DELETE:      'admission.delete',
  ADMISSION_APPROVE:     'admission.approve',

  // ── Parents / Guardians ──────────────────────────────────────────
  PARENT_CREATE:         'parent.create',
  PARENT_READ:           'parent.read',
  PARENT_UPDATE:         'parent.update',
  PARENT_DELETE:         'parent.delete',

  // ── Teachers ─────────────────────────────────────────────────────
  TEACHER_CREATE:        'teacher.create',
  TEACHER_READ:          'teacher.read',
  TEACHER_UPDATE:        'teacher.update',
  TEACHER_DELETE:        'teacher.delete',

  // ── Staff ────────────────────────────────────────────────────────
  STAFF_CREATE:          'staff.create',
  STAFF_READ:            'staff.read',
  STAFF_UPDATE:          'staff.update',
  STAFF_DELETE:          'staff.delete',

  // ── Classes ──────────────────────────────────────────────────────
  CLASS_CREATE:          'class.create',
  CLASS_READ:            'class.read',
  CLASS_UPDATE:          'class.update',
  CLASS_DELETE:          'class.delete',

  // ── Sections ─────────────────────────────────────────────────────
  SECTION_CREATE:        'section.create',
  SECTION_READ:          'section.read',
  SECTION_UPDATE:        'section.update',
  SECTION_DELETE:        'section.delete',

  // ── Subjects ─────────────────────────────────────────────────────
  SUBJECT_CREATE:        'subject.create',
  SUBJECT_READ:          'subject.read',
  SUBJECT_UPDATE:        'subject.update',
  SUBJECT_DELETE:        'subject.delete',

  // ── Timetable ────────────────────────────────────────────────────
  TIMETABLE_CREATE:      'timetable.create',
  TIMETABLE_READ:        'timetable.read',
  TIMETABLE_UPDATE:      'timetable.update',
  TIMETABLE_DELETE:      'timetable.delete',

  // ── Attendance ───────────────────────────────────────────────────
  ATTENDANCE_CREATE:     'attendance.create',
  ATTENDANCE_READ:       'attendance.read',
  ATTENDANCE_UPDATE:     'attendance.update',
  ATTENDANCE_EXPORT:     'attendance.export',

  // ── Fees ─────────────────────────────────────────────────────────
  FEE_CREATE:            'fee.create',
  FEE_READ:              'fee.read',
  FEE_UPDATE:            'fee.update',
  FEE_DELETE:            'fee.delete',
  FEE_COLLECT:           'fee.collect',
  FEE_REFUND:            'fee.refund',
  FEE_EXPORT:            'fee.export',

  // ── Fee Templates ────────────────────────────────────────────────
  FEE_TEMPLATE_CREATE:   'fee_template.create',
  FEE_TEMPLATE_READ:     'fee_template.read',
  FEE_TEMPLATE_UPDATE:   'fee_template.update',
  FEE_TEMPLATE_DELETE:   'fee_template.delete',
  FEE_TEMPLATE_ASSIGN:   'fee_template.assign',

  // ── Exams ────────────────────────────────────────────────────────
  EXAM_CREATE:           'exam.create',
  EXAM_READ:             'exam.read',
  EXAM_UPDATE:           'exam.update',
  EXAM_DELETE:           'exam.delete',
  EXAM_PUBLISH:          'exam.publish',

  // ── HR & Payroll ─────────────────────────────────────────────────
  PAYROLL_CREATE:        'payroll.create',
  PAYROLL_READ:          'payroll.read',
  PAYROLL_UPDATE:        'payroll.update',
  PAYROLL_DELETE:        'payroll.delete',
  PAYROLL_GENERATE:      'payroll.generate',
  PAYROLL_EXPORT:        'payroll.export',
  LEAVE_CREATE:          'leave.create',
  LEAVE_READ:            'leave.read',
  LEAVE_APPROVE:         'leave.approve',

  // ── Communication ────────────────────────────────────────────────
  NOTICE_CREATE:         'notice.create',
  NOTICE_READ:           'notice.read',
  NOTICE_UPDATE:         'notice.update',
  NOTICE_DELETE:         'notice.delete',
  NOTIFICATION_SEND:     'notification.send',

  // ── Reports ──────────────────────────────────────────────────────
  REPORT_FINANCIAL:      'report.financial',
  REPORT_ATTENDANCE:     'report.attendance',
  REPORT_STUDENT:        'report.student',
  REPORT_EXAM:           'report.exam',
  REPORT_SALARY:         'report.salary',
  REPORT_EXPORT:         'report.export',

  // ── Roles ────────────────────────────────────────────────────────
  ROLE_CREATE:           'role.create',
  ROLE_READ:             'role.read',
  ROLE_UPDATE:           'role.update',
  ROLE_DELETE:           'role.delete',
  ROLE_ASSIGN:           'role.assign',

  // ── Users ────────────────────────────────────────────────────────
  USER_CREATE:           'user.create',
  USER_READ:             'user.read',
  USER_UPDATE:           'user.update',
  USER_DELETE:           'user.delete',

  // ── Academic Year ────────────────────────────────────────────────
  ACADEMIC_YEAR_CREATE:  'academic_year.create',
  ACADEMIC_YEAR_READ:    'academic_year.read',
  ACADEMIC_YEAR_UPDATE:  'academic_year.update',
  ACADEMIC_YEAR_DELETE:  'academic_year.delete',

  // ── School / Settings ────────────────────────────────────────────
  SCHOOL_UPDATE:         'school.update',
  SCHOOL_SETTINGS:       'school.settings',
  SCHOOL_BILLING:        'school.billing',
  SCHOOL_ASSIGN_ROLE:    'school.assign_role',

  // ── Branches ─────────────────────────────────────────────────────
  BRANCH_CREATE:         'branch.create',
  BRANCH_READ:           'branch.read',
  BRANCH_UPDATE:         'branch.update',
  BRANCH_DELETE:         'branch.delete',
  BRANCH_ASSIGN_ROLE:    'branch.assign_role',

  // ── Dashboard ────────────────────────────────────────────────────
  DASHBOARD_VIEW:        'dashboard.view',
  DASHBOARD_ANALYTICS:   'dashboard.analytics',

  // ── Library ──────────────────────────────────────────────────────
  LIBRARY_MANAGE:        'library.manage',
  LIBRARY_READ:          'library.read',

  // ── Dashboard ────────────────────────────────────────────────────
  DASHBOARD_VIEW:        'dashboard.view',
  DASHBOARD_ANALYTICS:   'dashboard.analytics',
};

// Group permissions by module — returned by GET /master-admin/roles/permissions
export const PERMISSION_GROUPS = [
  {
    label: 'Students',         icon: '🎓', perms: [
      PERMISSIONS.STUDENT_CREATE, PERMISSIONS.STUDENT_READ,
      PERMISSIONS.STUDENT_UPDATE, PERMISSIONS.STUDENT_DELETE, PERMISSIONS.STUDENT_EXPORT,
    ],
  },
  {
    label: 'Admissions',       icon: '📋', perms: [
      PERMISSIONS.ADMISSION_CREATE, PERMISSIONS.ADMISSION_READ,
      PERMISSIONS.ADMISSION_UPDATE, PERMISSIONS.ADMISSION_DELETE, PERMISSIONS.ADMISSION_APPROVE,
    ],
  },
  {
    label: 'Parents',          icon: '👨‍👩‍👧', perms: [
      PERMISSIONS.PARENT_CREATE, PERMISSIONS.PARENT_READ,
      PERMISSIONS.PARENT_UPDATE, PERMISSIONS.PARENT_DELETE,
    ],
  },
  {
    label: 'Teachers',         icon: '👩‍🏫', perms: [
      PERMISSIONS.TEACHER_CREATE, PERMISSIONS.TEACHER_READ,
      PERMISSIONS.TEACHER_UPDATE, PERMISSIONS.TEACHER_DELETE,
    ],
  },
  {
    label: 'Staff / HR',       icon: '💼', perms: [
      PERMISSIONS.STAFF_CREATE, PERMISSIONS.STAFF_READ,
      PERMISSIONS.STAFF_UPDATE, PERMISSIONS.STAFF_DELETE,
      PERMISSIONS.PAYROLL_CREATE, PERMISSIONS.PAYROLL_READ, PERMISSIONS.PAYROLL_UPDATE,
      PERMISSIONS.PAYROLL_DELETE, PERMISSIONS.PAYROLL_GENERATE, PERMISSIONS.PAYROLL_EXPORT,
      PERMISSIONS.LEAVE_CREATE, PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_APPROVE,
    ],
  },
  {
    label: 'Academics',        icon: '📚', perms: [
      PERMISSIONS.CLASS_CREATE,    PERMISSIONS.CLASS_READ,    PERMISSIONS.CLASS_UPDATE,    PERMISSIONS.CLASS_DELETE,
      PERMISSIONS.SECTION_CREATE,  PERMISSIONS.SECTION_READ,  PERMISSIONS.SECTION_UPDATE,  PERMISSIONS.SECTION_DELETE,
      PERMISSIONS.SUBJECT_CREATE,  PERMISSIONS.SUBJECT_READ,  PERMISSIONS.SUBJECT_UPDATE,  PERMISSIONS.SUBJECT_DELETE,
      PERMISSIONS.TIMETABLE_CREATE,PERMISSIONS.TIMETABLE_READ,PERMISSIONS.TIMETABLE_UPDATE,PERMISSIONS.TIMETABLE_DELETE,
      PERMISSIONS.ACADEMIC_YEAR_CREATE, PERMISSIONS.ACADEMIC_YEAR_READ,
      PERMISSIONS.ACADEMIC_YEAR_UPDATE, PERMISSIONS.ACADEMIC_YEAR_DELETE,
    ],
  },
  {
    label: 'Attendance',       icon: '✅', perms: [
      PERMISSIONS.ATTENDANCE_CREATE, PERMISSIONS.ATTENDANCE_READ,
        PERMISSIONS.ATTENDANCE_EXPORT,
    ],
  },
  {
    label: 'Finance & Fees',   icon: '💰', perms: [
      PERMISSIONS.FEE_CREATE, PERMISSIONS.FEE_READ, PERMISSIONS.FEE_UPDATE,
      PERMISSIONS.FEE_DELETE, PERMISSIONS.FEE_COLLECT, PERMISSIONS.FEE_REFUND, PERMISSIONS.FEE_EXPORT,
      PERMISSIONS.FEE_TEMPLATE_CREATE, PERMISSIONS.FEE_TEMPLATE_READ,
      PERMISSIONS.FEE_TEMPLATE_UPDATE, PERMISSIONS.FEE_TEMPLATE_DELETE, PERMISSIONS.FEE_TEMPLATE_ASSIGN,
    ],
  },
  {
    label: 'Exams & Results',  icon: '📝', perms: [
      PERMISSIONS.EXAM_CREATE, PERMISSIONS.EXAM_READ, PERMISSIONS.EXAM_UPDATE,
      PERMISSIONS.EXAM_DELETE, PERMISSIONS.EXAM_PUBLISH,
    ],
  },
  {
    label: 'Branches',  icon: '📝', perms: [
      PERMISSIONS.BRANCH_CREATE, PERMISSIONS.BRANCH_READ, PERMISSIONS.BRANCH_UPDATE,
      PERMISSIONS.BRANCH_DELETE, PERMISSIONS.BRANCH_ASSIGN_ROLE,
    ],
  },
  {
    label: 'Communication',    icon: '📣', perms: [
      PERMISSIONS.NOTICE_CREATE, PERMISSIONS.NOTICE_READ,
      PERMISSIONS.NOTICE_UPDATE, PERMISSIONS.NOTICE_DELETE,
      PERMISSIONS.NOTIFICATION_SEND,
    ],
  },
  {
    label: 'Reports',          icon: '📊', perms: [
      PERMISSIONS.REPORT_FINANCIAL, PERMISSIONS.REPORT_ATTENDANCE,
      PERMISSIONS.REPORT_STUDENT,   PERMISSIONS.REPORT_EXAM,
      PERMISSIONS.REPORT_SALARY,    PERMISSIONS.REPORT_EXPORT,
    ],
  },
  {
    label: 'Administration',   icon: '⚙️', perms: [
      PERMISSIONS.ROLE_CREATE, PERMISSIONS.ROLE_READ, PERMISSIONS.ROLE_UPDATE,
      PERMISSIONS.ROLE_DELETE, PERMISSIONS.ROLE_ASSIGN,
      PERMISSIONS.USER_CREATE, PERMISSIONS.USER_READ, PERMISSIONS.USER_UPDATE, PERMISSIONS.USER_DELETE,
      PERMISSIONS.SCHOOL_UPDATE, PERMISSIONS.SCHOOL_SETTINGS,
      PERMISSIONS.SCHOOL_BILLING, PERMISSIONS.SCHOOL_ASSIGN_ROLE,
      PERMISSIONS.BRANCH_CREATE, PERMISSIONS.BRANCH_READ,
      PERMISSIONS.BRANCH_UPDATE, PERMISSIONS.BRANCH_DELETE,
      PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.DASHBOARD_ANALYTICS,
    ],
  },
  {
    label: 'Library',          icon: '📖', perms: [
      PERMISSIONS.LIBRARY_MANAGE, PERMISSIONS.LIBRARY_READ,
    ],
  },
];

export const ALL_PERMISSION_CODES = PERMISSION_GROUPS.flatMap((g) => g.perms);

export default PERMISSIONS;
