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
  const school = await schoolService.getSchoolProfile(req.school.id);
  sendSuccess(res, school, 'School profile fetched successfully');
});

// PATCH /api/v1/schools/assign-role
// Assigns a role to the school. The role defines which modules/permissions
// the school can access (school-level access control).
// Body: { role_id: "uuid" }
export const assignRoleToSchool = catchAsync(async (req, res) => {
  const { role_id } = req.body;
  const result = await schoolService.assignRoleToSchool(req.school.id, role_id);
  sendSuccess(res, result, 'Role assigned to school successfully');
});

// DELETE /api/v1/schools/assign-role
// Removes the role from the school (sets role_id = null)
export const removeRoleFromSchool = catchAsync(async (req, res) => {
  await schoolService.removeRoleFromSchool(req.school.id);
  sendNoContent(res);
});

// PATCH /api/v1/schools/settings
// Update school settings: toggle has_branches, etc.
// Body: { has_branches: true, name: "..." }
export const updateSchoolSettings = catchAsync(async (req, res) => {
  const school = await schoolService.updateSchoolSettings(req.school.id, req.body);
  sendSuccess(res, school, 'School settings updated successfully');
});
