/**
 * The Clouds Academy - School Controller
 *
 * Handles school profile management and school-level role assignment.
 */

import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendNoContent } from '../../utils/helpers/response.helper.js';
import * as schoolService from '../../services/school.service.js';

// GET /api/v1/schools/profile
// Returns the school profile for the currently authenticated school context,
// including its assigned role and that role's permissions.
export const getSchoolProfile = catchAsync(async (req, res) => {
  const schoolId = req.institute?.id || req.school?.id || req.user?.school_id;
  const school = await schoolService.getSchoolProfile(schoolId);
  sendSuccess(res, school, 'School profile fetched successfully');
});

// PATCH /api/v1/schools/assign-role
// Assigns a role to the school. The role defines which modules/permissions
// the school can access (school-level access control).
// Body: { role_id: "uuid" }
export const assignRoleToSchool = catchAsync(async (req, res) => {
  const { role_id } = req.body;
  const schoolId = req.institute?.id || req.school?.id || req.user?.school_id;
  const result = await schoolService.assignRoleToSchool(schoolId, role_id);
  sendSuccess(res, result, 'Role assigned to school successfully');
});

// DELETE /api/v1/schools/assign-role
// Removes the role from the school (sets role_id = null)
export const removeRoleFromSchool = catchAsync(async (req, res) => {
  const schoolId = req.institute?.id || req.school?.id || req.user?.school_id;
  await schoolService.removeRoleFromSchool(schoolId);
  sendNoContent(res);
});

// PATCH /api/v1/schools/settings
// Update school settings: toggle has_branches, etc.
// Body: { has_branches: true, name: "..." }
export const updateSchoolSettings = catchAsync(async (req, res) => {
  const schoolId = req.institute?.id || req.school?.id || req.user?.school_id;
  const school = await schoolService.updateSchoolSettings(schoolId, req.body);
  sendSuccess(res, school, 'School settings updated successfully');
});
