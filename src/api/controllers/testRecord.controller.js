/**
 * The Clouds Academy - Test Records Controller
 *
 * Serves BOTH:
 *   - admin routes   /api/v1/test-records                (role 'ADMIN')
 *   - teacher portal /api/v1/portal/teacher/test-records (role 'TEACHER', own tests only)
 * plus the read-only parent/student portal handlers.
 */
import catchAsync from '../../utils/lib/catchAsync.js';
import { AppError } from '../../utils/lib/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/helpers/response.helper.js';
import { getInstituteId, getBranchId } from '../../utils/helpers/request.helper.js';
import * as service from '../../services/testRecord.service.js';
import { assertParentOwnsChild } from '../../services/portal/parentOwnership.js';

const adminCtx = (req) => ({
  instituteId: getInstituteId(req),
  branchId: req.isBranchRestricted ? req.allowedBranchId : getBranchId(req),
  actorId: req.user.id,
  role: 'ADMIN',
});

const teacherCtx = (req) => ({
  instituteId: getInstituteId(req),
  branchId: null,
  actorId: req.user.id,
  role: 'TEACHER',
});

const requireInstitute = (ctx) => {
  if (!ctx.instituteId) throw new AppError('Institute context required', 400);
  return ctx;
};

const listFilters = (q) => ({
  teacher_id: q.teacher_id,
  class_id: q.class_id,
  section_id: q.section_id,
  subject_id: q.subject_id,
  subject: q.subject,
  status: q.status,
  from_date: q.from_date,
  to_date: q.to_date,
});

const handlers = (ctxOf) => ({
  list: catchAsync(async (req, res) => {
    const ctx = requireInstitute(ctxOf(req));
    const { data, pagination } = await service.listTests(ctx, listFilters(req.query), { page: req.query.page, limit: req.query.limit });
    sendPaginated(res, data, pagination, 'Test records fetched');
  }),
  create: catchAsync(async (req, res) => {
    const ctx = requireInstitute(ctxOf(req));
    const test = await service.createTest(ctx, req.body);
    sendCreated(res, test, 'Test record created');
  }),
  get: catchAsync(async (req, res) => {
    const ctx = requireInstitute(ctxOf(req));
    sendSuccess(res, await service.getTest(ctx, req.params.id), 'Test record fetched');
  }),
  update: catchAsync(async (req, res) => {
    const ctx = requireInstitute(ctxOf(req));
    sendSuccess(res, await service.updateTest(ctx, req.params.id, req.body), 'Test record updated');
  }),
  remove: catchAsync(async (req, res) => {
    const ctx = requireInstitute(ctxOf(req));
    sendSuccess(res, await service.deleteTest(ctx, req.params.id), 'Test record deleted');
  }),
  saveMarks: catchAsync(async (req, res) => {
    const ctx = requireInstitute(ctxOf(req));
    const entries = Array.isArray(req.body) ? req.body : req.body?.marks;
    sendSuccess(res, await service.saveMarks(ctx, req.params.id, entries), 'Marks saved');
  }),
});

// ── Admin ────────────────────────────────────────────────────────────────────
const admin = handlers(adminCtx);
export const adminList = admin.list;
export const adminCreate = admin.create;
export const adminGet = admin.get;
export const adminUpdate = admin.update;
export const adminRemove = admin.remove;
export const adminSaveMarks = admin.saveMarks;

export const adminOptions = catchAsync(async (req, res) => {
  const ctx = requireInstitute(adminCtx(req));
  sendSuccess(res, await service.getAdminOptions(ctx, { teacher_id: req.query.teacher_id }), 'Options fetched');
});

export const adminPublish = catchAsync(async (req, res) => {
  const ctx = requireInstitute(adminCtx(req));
  sendSuccess(res, await service.publishTest(ctx, req.params.id), 'Test record published');
});

export const adminUnpublish = catchAsync(async (req, res) => {
  const ctx = requireInstitute(adminCtx(req));
  sendSuccess(res, await service.unpublishTest(ctx, req.params.id), 'Test record unpublished');
});

// ── Teacher portal ───────────────────────────────────────────────────────────
const teacher = handlers(teacherCtx);
export const teacherList = teacher.list;
export const teacherCreate = teacher.create;
export const teacherGet = teacher.get;
export const teacherUpdate = teacher.update;
export const teacherRemove = teacher.remove;
export const teacherSaveMarks = teacher.saveMarks;

export const teacherOptions = catchAsync(async (req, res) => {
  const ctx = requireInstitute(teacherCtx(req));
  sendSuccess(res, await service.getTeacherOptions(ctx.actorId, ctx.instituteId), 'Options fetched');
});

// ── Student / Parent (read-only, published only) ─────────────────────────────
const sendStudentList = (res, result) =>
  res.status(200).json({
    success: true,
    message: 'Test records fetched',
    data: result.data,
    pagination: result.pagination,
    summary: result.summary,
    timestamp: new Date().toISOString(),
  });

const studentFilters = (q) => ({ subject: q.subject, from_date: q.from_date, to_date: q.to_date });

export const studentList = catchAsync(async (req, res) => {
  const instituteId = getInstituteId(req);
  if (!instituteId) throw new AppError('Institute context required', 400);
  const result = await service.listPublishedForStudent(
    instituteId,
    req.user.id, // a student only ever sees their own results
    studentFilters(req.query),
    { page: req.query.page, limit: req.query.limit }
  );
  sendStudentList(res, result);
});

export const parentChildList = catchAsync(async (req, res) => {
  const instituteId = getInstituteId(req);
  if (!instituteId) throw new AppError('Institute context required', 400);
  // Same ownership check as every other :childId parent endpoint (403 not your child / 404 unknown)
  await assertParentOwnsChild(req.user.id, req.params.childId, instituteId);
  const result = await service.listPublishedForStudent(
    instituteId,
    req.params.childId,
    studentFilters(req.query),
    { page: req.query.page, limit: req.query.limit }
  );
  sendStudentList(res, result);
});
