/**
 * The Clouds Academy - Section Controller
 */

import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/helpers/response.helper.js';
import { getInstituteId, getBranchId } from '../../utils/helpers/request.helper.js';
import * as sectionService from '../../services/section.service.js';

// POST /api/v1/classes/:classId/sections
export const createSection = catchAsync(async (req, res) => {
  const schoolId = getInstituteId(req) || req.school?.id;
  const branchId = getBranchId(req);

  const section = await sectionService.createSection(
    schoolId,
    req.params.classId,
    { ...req.body, branch_id: branchId ?? null }
  );
  sendCreated(res, section, 'Section created successfully');
});

// GET /api/v1/classes/:classId/sections
export const getSections = catchAsync(async (req, res) => {
  const schoolId = getInstituteId(req) || req.school?.id;
  const branchId = getBranchId(req);
  const { academic_year_id, is_active } = req.query;
  const filters = {};
  if (academic_year_id) filters.academic_year_id = academic_year_id;
  if (is_active !== undefined) filters.is_active = is_active === 'true';
  // Automatically scope to current branch context when set
  if (branchId) filters.branch_id = branchId;

  const sections = await sectionService.getSections(schoolId, req.params.classId, filters);
  sendSuccess(res, sections, 'Sections fetched successfully');
});

// GET /api/v1/classes/:classId/sections/:id
export const getSection = catchAsync(async (req, res) => {
  const section = await sectionService.getSectionById(
    req.school.id,
    req.params.classId,
    req.params.id
  );
  sendSuccess(res, section, 'Section fetched successfully');
});

// PUT /api/v1/classes/:classId/sections/:id
export const updateSection = catchAsync(async (req, res) => {
  const section = await sectionService.updateSection(
    req.school.id,
    req.params.classId,
    req.params.id,
    req.body
  );
  sendSuccess(res, section, 'Section updated successfully');
});

// DELETE /api/v1/classes/:classId/sections/:id
export const deleteSection = catchAsync(async (req, res) => {
  await sectionService.deleteSection(req.school.id, req.params.classId, req.params.id);
  sendNoContent(res);
});
