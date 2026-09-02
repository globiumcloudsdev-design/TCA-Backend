/**
 * The Clouds Academy — Roles Seeder
 *
 * Seeds platform-level template roles with polymorphic JSONB permissions.
 * Permissions are keyed by userType so each role supports all user types at once.
 *
 * All permission keys follow the format: 'module.action'
 */

// ─── Platform (Master Admin) permissions ─────────────────────────────────────
const MASTER_ADMIN_PERMS = [
  // Institutes
  'institute.create', 'institute.read', 'institute.update', 'institute.delete',
  'institute.activate', 'institute.assign_role', 'institute.export', 'institute.view_stats',
  // Subscriptions
  'subscription.create', 'subscription.read', 'subscription.update',
  'subscription.cancel', 'subscription.renew', 'subscription.export',
  // Subscription templates
  'sub_template.create', 'sub_template.read', 'sub_template.update', 'sub_template.delete',
  // Platform roles (master admin user management)
  'platform_role.create', 'platform_role.read', 'platform_role.update',
  'platform_role.delete', 'platform_role.assign',
  // Platform users
  'platform_user.create', 'platform_user.read', 'platform_user.update',
  'platform_user.delete', 'platform_user.toggle',
  // Email & Notifications
  'email.send_bulk', 'email.view_history',
  'notification.broadcast', 'notification.targeted',
  // Reports
  'report.platform_overview', 'report.revenue', 'report.institute_wise', 'report.subscription',
  // Platform settings
  'platform.settings', 'platform.backup', 'platform.audit_logs', 'platform.maintenance',
  // Institute data access (read-only support tools)
  'institute_data.students', 'institute_data.users', 'institute_data.fees', 'institute_data.attendance',
];

// ─── Permission sets by plan tier ─────────────────────────────────────────────
const BASIC_ADMIN = [
  'dashboard.view',
  'students.create', 'students.read', 'students.update',
  'teachers.create', 'teachers.read', 'teachers.update',
  'parents.create', 'parents.read', 'parents.update',
  'classes.create', 'classes.read', 'classes.update',
  'sections.create', 'sections.read', 'sections.update',
  'subjects.create', 'subjects.read', 'subjects.update',
  'academic_years.create', 'academic_years.read', 'academic_years.update', 'academic_years.activate',
  'attendance.mark', 'attendance.view', 'attendance.report',
  'exams.create', 'exams.read', 'exams.update',
  'exam_results.enter', 'exam_results.view', 'exam_results.publish',
  'fee_templates.create', 'fee_templates.read', 'fee_templates.update',
  'fees.create', 'fees.read', 'fees.collect', 'fees.update', 'fees.report',
  'notices.create', 'notices.read', 'notices.update',
  'notifications.send', 'notifications.read',
  'reports.student', 'reports.attendance', 'reports.fee', 'reports.exam',
  'roles.read',
  'users.create', 'users.read', 'users.update',
  'settings.view',
  'timetable.read',
  'admissions.create', 'admissions.read',
];

const BASIC_TEACHER = [
  'dashboard.view',
  'students.read',
  'classes.read', 'sections.read', 'subjects.read',
  'attendance.mark', 'attendance.view',
  'exams.read',
  'exam_results.enter', 'exam_results.view',
  'notices.read', 'notifications.read',
  'timetable.read',
];

const BASIC_STUDENT = [
  'dashboard.view',
  'attendance.view',
  'exam_results.view',
  'fees.read',
  'notices.read', 'notifications.read',
  'timetable.read',
];

const BASIC_PARENT = [
  'dashboard.view',
  'attendance.view',
  'exam_results.view',
  'fees.read',
  'notices.read', 'notifications.read',
];

const STANDARD_ADMIN = [...new Set([
  ...BASIC_ADMIN,
  'dashboard.analytics',
  'students.delete', 'students.export',
  'teachers.delete',
  'parents.delete',
  'staff.create', 'staff.read', 'staff.update', 'staff.delete',
  'classes.delete',
  'sections.delete',
  'subjects.delete',
  'attendance.export',
  'exams.delete',
  'exam_results.update',
  'fee_templates.delete',
  'fees.delete', 'fees.discount', 'fees.export',
  'payroll.create', 'payroll.read', 'payroll.process', 'payroll.report',
  'notices.delete',
  'notifications.manage',
  'reports.analytics', 'reports.payroll',
  'roles.create', 'roles.update', 'roles.assign',
  'users.delete',
  'settings.update',
  'timetable.create', 'timetable.update',
  'admissions.update', 'admissions.approve',
])];

const STANDARD_TEACHER = [...new Set([
  ...BASIC_TEACHER,
  'attendance.report',
  'exams.create', 'exams.update',
  'exam_results.update', 'exam_results.publish',
  'notices.create', 'notices.update',
])];

const STANDARD_STUDENT = [...new Set([...BASIC_STUDENT])];

const STANDARD_PARENT = [...new Set([
  ...BASIC_PARENT,
  'fees.collect',
])];

const PREMIUM_TEACHER = [...new Set([
  ...STANDARD_TEACHER,
  'timetable.create', 'timetable.update',
  'library.access',
  'admissions.read',
])];

const PREMIUM_STUDENT = [...new Set([
  ...STANDARD_STUDENT,
  'admissions.read',
  'library.access',
])];

const PREMIUM_PARENT = [...new Set([
  ...STANDARD_PARENT,
  'reports.student',
  'reports.exam',
])];

const ENTERPRISE_STUDENT = [...new Set([
  ...PREMIUM_STUDENT,
  'reports.attendance',
])];

const ENTERPRISE_PARENT = [...new Set([
  ...PREMIUM_PARENT,
  'reports.attendance',
])];

// ─── Role definitions ──────────────────────────────────────────────────────────
const ROLE_DEFINITIONS = [
  {
    name: 'Master Admin',
    code: 'MASTER_ADMIN',
    description: 'SaaS platform super admin — full platform access, no school scope',
    is_template: true,
    permissions: { master: MASTER_ADMIN_PERMS },
  },
  {
    name: 'Testing All Access',
    code: 'TESTING_ALL_ACCESS',
    description: 'Development / QA role — all permissions for all user types (DO NOT use in production)',
    is_template: true,
    permissions: {
      instituteAdmin: ['ALL'],
      teacher: ['ALL'],
      student: ['ALL'],
      parent: ['ALL'],
    },
  },
  {
    name: 'School Basic Plan',
    code: 'SCHOOL_BASIC',
    description: 'Basic school subscription — core student, attendance and fee management',
    is_template: true,
    permissions: {
      instituteAdmin: BASIC_ADMIN,
      teacher:        BASIC_TEACHER,
      student:        BASIC_STUDENT,
      parent:         BASIC_PARENT,
    },
  },
  {
    name: 'School Standard Plan',
    code: 'SCHOOL_STANDARD',
    description: 'Standard school subscription — payroll, staff management, advanced reports',
    is_template: true,
    permissions: {
      instituteAdmin: STANDARD_ADMIN,
      teacher:        STANDARD_TEACHER,
      student:        STANDARD_STUDENT,
      parent:         STANDARD_PARENT,
    },
  },
  {
    name: 'School Premium Plan',
    code: 'SCHOOL_PREMIUM',
    description: 'Premium school subscription — full admin access, branches, library, analytics',
    is_template: true,
    permissions: {
      instituteAdmin: ['ALL'],
      teacher:        PREMIUM_TEACHER,
      student:        PREMIUM_STUDENT,
      parent:         PREMIUM_PARENT,
    },
  },
  {
    name: 'School Enterprise Plan',
    code: 'SCHOOL_ENTERPRISE',
    description: 'Enterprise subscription — unlimited scale, full teacher access, API + dedicated support',
    is_template: true,
    permissions: {
      instituteAdmin: ['ALL'],
      teacher:        ['ALL'],
      student:        ENTERPRISE_STUDENT,
      parent:         ENTERPRISE_PARENT,
    },
  },
];

// ─── Seeder function ───────────────────────────────────────────────────────────
export const seedRoles = async (models) => {
  const { Role } = models;
  let created = 0;
  let updated = 0;

  for (const roleDef of ROLE_DEFINITIONS) {
    let role = await Role.findOne({
      where: { code: roleDef.code, school_id: null },
      paranoid: false,
    });

    if (role) {
      if (role.deleted_at) {
        await role.restore();
      }
      await role.update({
        name:        roleDef.name,
        description: roleDef.description,
        permissions: roleDef.permissions,
        is_template: true,
        is_active:   true,
      });
      updated++;
    } else {
      await Role.create(roleDef);
      created++;
    }
  }

  console.log(`✅ Roles: ${created} created, ${updated} updated (total: ${ROLE_DEFINITIONS.length})`);
  return { created, updated };
};

export { ROLE_DEFINITIONS, MASTER_ADMIN_PERMS };
