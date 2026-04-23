/**
 * The Clouds Academy - Role Controller
 */

import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/helpers/response.helper.js';
import {
  createRole,
  getSchoolRoles,
  getRoleById,
  updateRole,
  deleteRole,
  assignRoleToUser,
} from '../../services/role.service.js';

// ─── All permission codes (for role-builder UI checkboxes) ───────────────────
const ALL_PERMISSION_CODES = [
  // Dashboard
  'dashboard.view', 'dashboard.analytics',
  // Students
  'students.create', 'students.read', 'students.update', 'students.delete', 'students.export', 'students.import',
  // Teachers
  'teachers.create', 'teachers.read', 'teachers.update', 'teachers.delete', 'teachers.export',
  // Parents
  'parents.create', 'parents.read', 'parents.update', 'parents.delete',
  // Staff
  'staff.create', 'staff.read', 'staff.update', 'staff.delete',
  // Classes / Sections / Subjects
  'classes.create', 'classes.read', 'classes.update', 'classes.delete',
  'sections.create', 'sections.read', 'sections.update', 'sections.delete',
  'subjects.create', 'subjects.read', 'subjects.update', 'subjects.delete',
  // Academic Years
  'academic_years.create', 'academic_years.read', 'academic_years.update', 'academic_years.activate',
  // Attendance
  'attendance.mark', 'attendance.view', 'attendance.report', 'attendance.export', 'attendance.backdate',
  // Exams
  'exams.create', 'exams.read', 'exams.update', 'exams.delete',
  'exam_results.enter', 'exam_results.view', 'exam_results.update', 'exam_results.publish',
  // Fees
  'fee_templates.create', 'fee_templates.read', 'fee_templates.update', 'fee_templates.delete',
  'fees.create', 'fees.read', 'fees.collect', 'fees.update', 'fees.delete',
  'fees.discount', 'fees.waive', 'fees.report', 'fees.export',
  // Payroll
  'payroll.create', 'payroll.read', 'payroll.process', 'payroll.update', 'payroll.report',
  // Notices / Notifications
  'notices.create', 'notices.read', 'notices.update', 'notices.delete',
  'notifications.send', 'notifications.read', 'notifications.manage',
  // Reports
  'reports.student', 'reports.attendance', 'reports.fee', 'reports.exam', 'reports.payroll', 'reports.analytics',
  'reports.export', 'reports.create', 'reports.read',
  // Roles & Users
  'roles.create', 'roles.read', 'roles.update', 'roles.delete', 'roles.assign',
  'users.create', 'users.read', 'users.update', 'users.delete',
  // Settings
  'settings.view', 'settings.update', 'settings.security',
  // Timetable
  'timetable.create', 'timetable.read', 'timetable.update', 'timetable.delete',
  // Admissions
  'admissions.create', 'admissions.read', 'admissions.update', 'admissions.approve', 'admissions.reject',
  // Branches
  'branches.create', 'branches.read', 'branches.update', 'branches.delete',
  // Library
  'library.manage', 'library.access',
];

export const createRoleController = catchAsync(async (req, res) => {
  const role = await createRole(req.school.id, req.body, req.user.id);
  sendCreated(res, role, 'Role created successfully');
});

export const getRolesController = catchAsync(async (req, res) => {
  const { roles, pagination } = await getSchoolRoles(req.school.id, req.query);
  sendPaginated(res, roles, pagination, 'Roles fetched');
});

export const getRoleByIdController = catchAsync(async (req, res) => {
  const role = await getRoleById(req.params.id);
  sendSuccess(res, role, 'Role details');
});

export const updateRoleController = catchAsync(async (req, res) => {
  const role = await updateRole(req.params.id, req.body);
  sendSuccess(res, role, 'Role updated');
});

export const deleteRoleController = catchAsync(async (req, res) => {
  await deleteRole(req.params.id);
  sendNoContent(res);
});

export const assignRoleController = catchAsync(async (req, res) => {
  const { userId, roleId } = req.body;
  const user = await assignRoleToUser(userId, roleId, req.user.id);
  sendSuccess(res, user, 'Role assigned successfully');
});

/**
 * Returns the full permission catalogue for the role-builder UI.
 * Grouped by module for easy checkbox rendering.
 */
export const getAllPermissionsController = catchAsync(async (req, res) => {
  sendSuccess(res, ALL_PERMISSION_CODES, 'Available permissions');
});

export default {
  createRoleController,
  getRolesController,
  getRoleByIdController,
  updateRoleController,
  deleteRoleController,
  assignRoleController,
  getAllPermissionsController,
};
