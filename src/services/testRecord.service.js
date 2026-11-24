/**
 * The Clouds Academy - Test Records Service
 *
 * Class tests (quick tests), separate from formal Exams.
 *
 * Context object `ctx` used by every function:
 *   { instituteId, branchId?, actorId, role: 'ADMIN' | 'TEACHER' }
 *   - branchId  : when set, only records of that branch are visible/editable
 *   - role=TEACHER : actorId is the teacher; only own tests, only while not published
 *
 * Rules enforced here (server side):
 *   - test_date today-or-future in Asia/Karachi (create, and update when the date changes)
 *   - 0 <= passing_marks <= total_marks, total_marks > 0
 *   - marks 0..total_marks; blank != 0 (blank is "not entered", never saved)
 *   - marks only on/after test_date; per-student upsert, other rows never deleted
 *   - teachers: only assigned class/section/subject, locked once published
 *   - publish/unpublish: admin only (see routes)
 */
import { Op } from 'sequelize';
import models from '../models/postgres/index.js';
import { AppError } from '../utils/lib/AppError.js';
import { todayPkt } from '../utils/helpers/date.helper.js';
import { getStudentAcademicInfo } from '../utils/helpers/student.helper.js';

const { TestRecord, TestMark, User, Class, Section, Subject, Timetable, sequelize } = models;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MARK_ROWS = 500;

const assertUuid = (v, label = 'id') => {
  if (!v || !UUID_RE.test(String(v))) throw new AppError(`Invalid ${label}`, 400);
};
const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const num = (v) => (v === null || v === undefined ? null : Number(v));
const round2 = (n) => Math.round(n * 100) / 100;
const pct = (marks, total) => (total > 0 ? round2((marks / total) * 100) : 0);
const lc = (s) => String(s || '').trim().toLowerCase();

const isTeacher = (ctx) => ctx.role === 'TEACHER';

// ─────────────────────────────────────────────────────────────────────────────
// ROSTER
// ─────────────────────────────────────────────────────────────────────────────

const studentSort = (a, b) => {
  const ra = parseInt(a.roll_no, 10);
  const rb = parseInt(b.roll_no, 10);
  if (Number.isFinite(ra) && Number.isFinite(rb) && ra !== rb) return ra - rb;
  return String(a.name).localeCompare(String(b.name));
};

/** Active students of a class (and section, when given) in this institute */
export const getRoster = async (instituteId, classId, sectionId = null) => {
  const rows = await User.findAll({
    where: {
      school_id: instituteId,
      user_type: 'STUDENT',
      is_active: true,
      'details.studentDetails.class_id': classId,
      ...(sectionId ? { 'details.studentDetails.section_id': sectionId } : {}),
    },
    attributes: ['id', 'first_name', 'last_name', 'registration_no', 'avatar_url', 'details'],
  });
  return rows
    .map((s) => ({
      student_id: s.id,
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      registration_no: s.registration_no,
      roll_no: getStudentAcademicInfo(s).roll_no,
      avatar: s.avatar_url,
    }))
    .sort(studentSort);
};

const countRoster = async (instituteId, classId, sectionId) =>
  User.count({
    where: {
      school_id: instituteId,
      user_type: 'STUDENT',
      is_active: true,
      'details.studentDetails.class_id': classId,
      ...(sectionId ? { 'details.studentDetails.section_id': sectionId } : {}),
    },
  });

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER SCOPE (classes / sections / subjects a teacher may use)
// ─────────────────────────────────────────────────────────────────────────────

/** Flat list of { class_id, section_id|null, subject_id|null, subject_name } from active timetables */
export const getTeacherScope = async (teacherId, instituteId) => {
  const timetables = await Timetable.findAll({ where: { school_id: instituteId, is_active: true } });
  const seen = new Set();
  const entries = [];
  for (const tt of timetables) {
    const classId = tt.entity_ids?.class_id;
    if (!classId) continue;
    const ttSection = tt.entity_ids?.section_id || null;
    for (const slot of tt.slots || []) {
      if (slot.teacher_id !== teacherId || slot.is_break) continue;
      if (!slot.subject_id && !slot.subject_name) continue;
      const entry = {
        class_id: classId,
        section_id: slot.section_id || ttSection,
        subject_id: slot.subject_id || null,
        subject_name: slot.subject_name || null,
      };
      const key = `${entry.class_id}|${entry.section_id || ''}|${entry.subject_id || ''}|${lc(entry.subject_name)}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push(entry);
      }
    }
  }
  return entries;
};

const subjectMatches = (entry, subject) =>
  (subject.subject_id && entry.subject_id && entry.subject_id === subject.subject_id) ||
  (subject.subject_name && entry.subject_name && lc(entry.subject_name) === lc(subject.subject_name));

const assertTeacherMayTest = (scope, { class_id, section_id, subject_id, subject_name }) => {
  const ok = scope.some(
    (e) =>
      e.class_id === class_id &&
      // class-level timetable entries (no section) cover every section of that class
      (!e.section_id || e.section_id === (section_id || null)) &&
      subjectMatches(e, { subject_id, subject_name })
  );
  if (!ok) {
    throw new AppError('You can only create tests for the classes, sections and subjects assigned to you', 403);
  }
};

/** classes -> sections -> subjects tree for the "Add Test Record" form (teacher) */
export const getTeacherOptions = async (teacherId, instituteId) => {
  const scope = await getTeacherScope(teacherId, instituteId);
  if (!scope.length) return { classes: [] };

  const classIds = [...new Set(scope.map((e) => e.class_id))];
  const [classes, sections] = await Promise.all([
    Class.findAll({ where: { id: { [Op.in]: classIds }, school_id: instituteId }, attributes: ['id', 'name'] }),
    Section.findAll({ where: { class_id: { [Op.in]: classIds }, school_id: instituteId }, attributes: ['id', 'name', 'class_id'] }),
  ]);
  const sectionsByClass = new Map();
  sections.forEach((s) => {
    if (!sectionsByClass.has(s.class_id)) sectionsByClass.set(s.class_id, []);
    sectionsByClass.get(s.class_id).push(s);
  });

  const addSubject = (map, e) => {
    const key = e.subject_id || lc(e.subject_name);
    if (!map.has(key)) map.set(key, { id: e.subject_id, name: e.subject_name });
  };

  const out = [];
  for (const cls of classes) {
    const classSections = sectionsByClass.get(cls.id) || [];
    const entries = scope.filter((e) => e.class_id === cls.id);
    if (!classSections.length) {
      const subjects = new Map();
      entries.forEach((e) => addSubject(subjects, e));
      out.push({ id: cls.id, name: cls.name, has_sections: false, sections: [], subjects: [...subjects.values()] });
      continue;
    }
    const sectionList = [];
    for (const sec of classSections) {
      const subjects = new Map();
      entries.filter((e) => !e.section_id || e.section_id === sec.id).forEach((e) => addSubject(subjects, e));
      if (subjects.size) sectionList.push({ id: sec.id, name: sec.name, subjects: [...subjects.values()] });
    }
    if (sectionList.length) out.push({ id: cls.id, name: cls.name, has_sections: true, sections: sectionList, subjects: [] });
  }
  out.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  return { classes: out };
};

/** Admin helper: active teachers (+ optional suggested class/section/subject tree for one teacher) */
export const getAdminOptions = async (ctx, { teacher_id } = {}) => {
  const teachers = await User.findAll({
    where: {
      school_id: ctx.instituteId,
      user_type: 'TEACHER',
      is_active: true,
      ...(ctx.branchId ? { branch_id: ctx.branchId } : {}),
    },
    attributes: ['id', 'first_name', 'last_name', 'registration_no'],
    order: [['first_name', 'ASC']],
  });
  const data = {
    teachers: teachers.map((t) => ({
      id: t.id,
      name: `${t.first_name || ''} ${t.last_name || ''}`.trim(),
      registration_no: t.registration_no,
    })),
  };
  if (teacher_id) {
    assertUuid(teacher_id, 'teacher_id');
    data.teacher_assignments = (await getTeacherOptions(teacher_id, ctx.instituteId)).classes;
  }
  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const parseTestDate = (value) => {
  const d = String(value || '').slice(0, 10);
  if (!DATE_RE.test(d) || Number.isNaN(new Date(`${d}T00:00:00Z`).getTime())) {
    throw new AppError('test_date must be a valid date (YYYY-MM-DD)', 400);
  }
  return d;
};

const assertNotPast = (testDate) => {
  if (testDate < todayPkt()) {
    throw new AppError('test_date cannot be in the past (today or a future date only)', 400);
  }
};

const parseMarksConfig = (total, passing) => {
  const t = Number(total);
  const p = Number(passing);
  if (!Number.isFinite(t) || t <= 0) throw new AppError('total_marks must be greater than 0', 400);
  if (!Number.isFinite(p) || p < 0) throw new AppError('passing_marks must be 0 or more', 400);
  if (p > t) throw new AppError('passing_marks cannot be greater than total_marks', 400);
  return { total: round2(t), passing: round2(p) };
};

const defaultTitle = (subjectName, testDate) => `${subjectName} Test – ${testDate}`;

const resolveSubject = async (ctx, body, scope = null) => {
  let subject_id = body.subject_id || null;
  let subject_name = body.subject_name ? String(body.subject_name).trim() : null;
  if (subject_id) assertUuid(subject_id, 'subject_id');

  if (subject_id && !subject_name) {
    const sub = await Subject.findOne({ where: { id: subject_id, school_id: ctx.instituteId }, attributes: ['name'] });
    subject_name = sub?.name || scope?.find((e) => e.subject_id === subject_id)?.subject_name || null;
  }
  if (!subject_name) throw new AppError('subject is required (subject_id or subject_name)', 400);
  return { subject_id, subject_name: subject_name.slice(0, 100) };
};

// ─────────────────────────────────────────────────────────────────────────────
// LOADERS
// ─────────────────────────────────────────────────────────────────────────────

const baseWhere = (ctx) => ({
  institute_id: ctx.instituteId,
  ...(ctx.branchId ? { branch_id: ctx.branchId } : {}),
  ...(isTeacher(ctx) ? { teacher_id: ctx.actorId } : {}),
});

const INCLUDE_DISPLAY = [
  { model: User, as: 'teacher', attributes: ['id', 'first_name', 'last_name'], required: false },
  { model: Class, as: 'class', attributes: ['id', 'name'], required: false },
  { model: Section, as: 'section', attributes: ['id', 'name'], required: false },
];

const loadTest = async (ctx, id, options = {}) => {
  assertUuid(id, 'test record id');
  const test = await TestRecord.findOne({
    where: { id, ...baseWhere(ctx) },
    ...options,
  });
  if (!test) throw new AppError('Test record not found', 404); // 404 also for other teachers' / other branches' tests
  return test;
};

const assertTeacherCanEdit = (ctx, test) => {
  if (isTeacher(ctx) && test.status === 'published') {
    throw new AppError('This test is published and locked. Ask an admin to unpublish it before editing.', 409);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING / STATS
// ─────────────────────────────────────────────────────────────────────────────

const resultOf = (mark, test) => {
  if (!mark) return null;
  if (mark.is_absent) return 'absent';
  if (mark.marks_obtained === null || mark.marks_obtained === undefined) return null;
  return Number(mark.marks_obtained) >= Number(test.passing_marks) ? 'pass' : 'fail';
};

const isEntered = (m) => m.is_absent || (m.marks_obtained !== null && m.marks_obtained !== undefined);

const computeStats = (test, marks, totalStudents) => {
  const total = Number(test.total_marks);
  const entered = marks.filter(isEntered);
  const scored = marks.filter((m) => !m.is_absent && m.marks_obtained !== null && m.marks_obtained !== undefined);
  const values = scored.map((m) => Number(m.marks_obtained));
  const passCount = scored.filter((m) => Number(m.marks_obtained) >= Number(test.passing_marks)).length;
  const highest = values.length ? Math.max(...values) : null;
  return {
    total_students: totalStudents,
    entered_count: entered.length,
    absent_count: marks.filter((m) => m.is_absent).length,
    average_marks: values.length ? round2(values.reduce((a, b) => a + b, 0) / values.length) : null,
    average_percentage: values.length ? pct(values.reduce((a, b) => a + b, 0) / values.length, total) : null,
    pass_count: passCount,
    fail_count: scored.length - passCount,
    highest_marks: highest,
    highest_percentage: highest === null ? null : pct(highest, total),
  };
};

const formatTest = (test, stats = null) => {
  const t = test.toJSON ? test.toJSON() : test;
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    test_date: t.test_date,
    total_marks: Number(t.total_marks),
    passing_marks: Number(t.passing_marks),
    class_id: t.class_id,
    class_name: t.class?.name || null,
    section_id: t.section_id,
    section_name: t.section?.name || null,
    subject_id: t.subject_id,
    subject_name: t.subject_name,
    teacher_id: t.teacher_id,
    teacher_name: t.teacher ? `${t.teacher.first_name || ''} ${t.teacher.last_name || ''}`.trim() : null,
    branch_id: t.branch_id,
    published_at: t.published_at,
    created_at: t.created_at,
    updated_at: t.updated_at,
    ...(stats ? { stats } : {}),
  };
};

const formatMarkRow = (student, mark, test) => {
  const total = Number(test.total_marks);
  const marks = mark && mark.marks_obtained !== null && mark.marks_obtained !== undefined ? Number(mark.marks_obtained) : null;
  return {
    student_id: student.student_id,
    name: student.name,
    registration_no: student.registration_no,
    roll_no: student.roll_no,
    avatar: student.avatar,
    marks_obtained: marks,
    is_absent: !!mark?.is_absent,
    remark: mark?.remark || null,
    entered: !!mark && isEntered(mark),
    percentage: marks === null ? null : pct(marks, total),
    result: resultOf(mark, test),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const createTest = async (ctx, body = {}) => {
  // Teacher: always themselves. Admin: teacher_id required.
  const teacherId = isTeacher(ctx) ? ctx.actorId : body.teacher_id;
  if (!teacherId) throw new AppError('teacher_id is required', 400);
  assertUuid(teacherId, 'teacher_id');
  assertUuid(body.class_id, 'class_id');

  const teacher = await User.findOne({
    where: { id: teacherId, school_id: ctx.instituteId, user_type: 'TEACHER', is_active: true },
    attributes: ['id', 'branch_id'],
  });
  if (!teacher) throw new AppError('Teacher not found', 404);
  if (ctx.branchId && teacher.branch_id && teacher.branch_id !== ctx.branchId) throw new AppError('Teacher not found', 404);

  const cls = await Class.findOne({
    where: { id: body.class_id, school_id: ctx.instituteId },
    attributes: ['id', 'name', 'branch_id', 'academic_year_id'],
  });
  if (!cls || (ctx.branchId && cls.branch_id && cls.branch_id !== ctx.branchId)) throw new AppError('Class not found', 404);

  const sectionCount = await Section.count({ where: { class_id: cls.id, school_id: ctx.instituteId } });
  let sectionId = null;
  if (sectionCount > 0) {
    if (!body.section_id) throw new AppError('section_id is required for this class', 400);
    assertUuid(body.section_id, 'section_id');
    const section = await Section.findOne({ where: { id: body.section_id, class_id: cls.id, school_id: ctx.instituteId }, attributes: ['id'] });
    if (!section) throw new AppError('Section not found in this class', 404);
    sectionId = section.id;
  }

  const scope = isTeacher(ctx) ? await getTeacherScope(teacherId, ctx.instituteId) : null;
  const subject = await resolveSubject(ctx, body, scope);
  if (isTeacher(ctx)) {
    assertTeacherMayTest(scope, { class_id: cls.id, section_id: sectionId, ...subject });
  }

  const testDate = parseTestDate(body.test_date);
  assertNotPast(testDate);
  const { total, passing } = parseMarksConfig(body.total_marks, body.passing_marks);

  const title = body.title && String(body.title).trim() ? String(body.title).trim().slice(0, 200) : defaultTitle(subject.subject_name, testDate);

  const test = await TestRecord.create({
    institute_id: ctx.instituteId,
    branch_id: cls.branch_id || teacher.branch_id || ctx.branchId || null,
    academic_year_id: cls.academic_year_id || null,
    teacher_id: teacherId,
    class_id: cls.id,
    section_id: sectionId,
    subject_id: subject.subject_id,
    subject_name: subject.subject_name,
    title,
    test_date: testDate,
    total_marks: total,
    passing_marks: passing,
    status: 'draft',
    created_by: ctx.actorId,
    updated_by: ctx.actorId,
  });
  return getTest(ctx, test.id);
};

export const listTests = async (ctx, filters = {}, pagination = {}) => {
  const where = baseWhere(ctx);
  if (!isTeacher(ctx) && filters.teacher_id) {
    assertUuid(filters.teacher_id, 'teacher_id');
    where.teacher_id = filters.teacher_id;
  }
  if (filters.class_id) { assertUuid(filters.class_id, 'class_id'); where.class_id = filters.class_id; }
  if (filters.section_id) { assertUuid(filters.section_id, 'section_id'); where.section_id = filters.section_id; }
  if (filters.subject_id) { assertUuid(filters.subject_id, 'subject_id'); where.subject_id = filters.subject_id; }
  if (filters.subject) where[Op.and] = [sequelize.where(sequelize.fn('lower', sequelize.col('TestRecord.subject_name')), lc(filters.subject))];
  if (filters.status) {
    if (!['draft', 'marks_entered', 'published'].includes(filters.status)) throw new AppError('Invalid status', 400);
    where.status = filters.status;
  }
  if (filters.from_date || filters.to_date) {
    where.test_date = {};
    if (filters.from_date) where.test_date[Op.gte] = parseTestDate(filters.from_date);
    if (filters.to_date) where.test_date[Op.lte] = parseTestDate(filters.to_date);
  }

  const page = Math.max(parseInt(pagination.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(pagination.limit, 10) || 20, 1), 100);

  const { count, rows } = await TestRecord.findAndCountAll({
    where,
    include: INCLUDE_DISPLAY,
    order: [['test_date', 'DESC'], ['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });

  // Stats: one query for all marks on the page + one roster count per distinct class/section
  const ids = rows.map((r) => r.id);
  const marks = ids.length
    ? await TestMark.findAll({ where: { test_record_id: { [Op.in]: ids } }, attributes: ['test_record_id', 'marks_obtained', 'is_absent'], raw: true })
    : [];
  const marksByTest = new Map();
  marks.forEach((m) => {
    if (!marksByTest.has(m.test_record_id)) marksByTest.set(m.test_record_id, []);
    marksByTest.get(m.test_record_id).push(m);
  });
  const rosterCounts = new Map();
  for (const r of rows) {
    const key = `${r.class_id}|${r.section_id || ''}`;
    if (!rosterCounts.has(key)) rosterCounts.set(key, await countRoster(ctx.instituteId, r.class_id, r.section_id));
  }

  return {
    data: rows.map((r) => formatTest(r, computeStats(r, marksByTest.get(r.id) || [], rosterCounts.get(`${r.class_id}|${r.section_id || ''}`)))),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
  };
};

export const getTest = async (ctx, id) => {
  const test = await loadTest(ctx, id, { include: INCLUDE_DISPLAY });
  const [roster, marks] = await Promise.all([
    getRoster(ctx.instituteId, test.class_id, test.section_id),
    TestMark.findAll({ where: { test_record_id: test.id } }),
  ]);
  const byStudent = new Map(marks.map((m) => [m.student_id, m]));
  const students = roster.map((s) => formatMarkRow(s, byStudent.get(s.student_id), test));
  // Marks of students who left the class/section stay visible to admins
  const rosterIds = new Set(roster.map((s) => s.student_id));
  const orphanMarks = marks.filter((m) => !rosterIds.has(m.student_id));
  const stats = computeStats(test, marks, roster.length);
  return {
    ...formatTest(test, stats),
    students,
    orphan_marks_count: orphanMarks.length,
    can_edit: !(isTeacher(ctx) && test.status === 'published'),
    marks_entry_open: test.test_date <= todayPkt(),
  };
};

export const updateTest = async (ctx, id, body = {}) => {
  const test = await loadTest(ctx, id);
  assertTeacherCanEdit(ctx, test);

  const markCount = await TestMark.count({ where: { test_record_id: test.id } });
  const updates = {};

  if (body.title !== undefined) {
    updates.title = String(body.title || '').trim().slice(0, 200) || defaultTitle(test.subject_name, test.test_date);
  }

  if (body.test_date !== undefined) {
    const d = parseTestDate(body.test_date);
    if (d !== test.test_date) {
      assertNotPast(d);
      updates.test_date = d;
    }
  }

  // class / section / subject / teacher changes
  const touchesTarget = ['class_id', 'section_id', 'subject_id', 'subject_name', 'teacher_id'].some((k) => body[k] !== undefined);
  if (touchesTarget) {
    if (markCount > 0) throw new AppError('Class, section, subject and teacher cannot be changed after marks were entered', 409);

    const classId = body.class_id || test.class_id;
    assertUuid(classId, 'class_id');
    const cls = await Class.findOne({ where: { id: classId, school_id: ctx.instituteId }, attributes: ['id', 'branch_id', 'academic_year_id'] });
    if (!cls || (ctx.branchId && cls.branch_id && cls.branch_id !== ctx.branchId)) throw new AppError('Class not found', 404);

    const sectionCount = await Section.count({ where: { class_id: cls.id, school_id: ctx.instituteId } });
    let sectionId = null;
    if (sectionCount > 0) {
      const wanted = body.section_id !== undefined ? body.section_id : (classId === test.class_id ? test.section_id : null);
      if (!wanted) throw new AppError('section_id is required for this class', 400);
      assertUuid(wanted, 'section_id');
      const section = await Section.findOne({ where: { id: wanted, class_id: cls.id, school_id: ctx.instituteId }, attributes: ['id'] });
      if (!section) throw new AppError('Section not found in this class', 404);
      sectionId = section.id;
    }

    let teacherId = test.teacher_id;
    if (!isTeacher(ctx) && body.teacher_id !== undefined) {
      assertUuid(body.teacher_id, 'teacher_id');
      const teacher = await User.findOne({ where: { id: body.teacher_id, school_id: ctx.instituteId, user_type: 'TEACHER', is_active: true }, attributes: ['id', 'branch_id'] });
      if (!teacher || (ctx.branchId && teacher.branch_id && teacher.branch_id !== ctx.branchId)) throw new AppError('Teacher not found', 404);
      teacherId = teacher.id;
    }

    const subjectBody = body.subject_id !== undefined || body.subject_name !== undefined
      ? body
      : { subject_id: test.subject_id, subject_name: test.subject_name };
    const scope = isTeacher(ctx) ? await getTeacherScope(ctx.actorId, ctx.instituteId) : null;
    const subject = await resolveSubject(ctx, subjectBody, scope);
    if (isTeacher(ctx)) assertTeacherMayTest(scope, { class_id: cls.id, section_id: sectionId, ...subject });

    Object.assign(updates, {
      class_id: cls.id,
      section_id: sectionId,
      subject_id: subject.subject_id,
      subject_name: subject.subject_name,
      teacher_id: teacherId,
      academic_year_id: cls.academic_year_id || test.academic_year_id,
    });
  }

  if (body.total_marks !== undefined || body.passing_marks !== undefined) {
    const { total, passing } = parseMarksConfig(
      body.total_marks !== undefined ? body.total_marks : test.total_marks,
      body.passing_marks !== undefined ? body.passing_marks : test.passing_marks
    );
    if (markCount > 0 && total < Number(test.total_marks)) {
      const over = await TestMark.count({ where: { test_record_id: test.id, marks_obtained: { [Op.gt]: total } } });
      if (over > 0) throw new AppError(`Cannot lower total_marks to ${total}: ${over} student(s) already have higher marks`, 409);
    }
    updates.total_marks = total;
    updates.passing_marks = passing;
  }

  if (!Object.keys(updates).length) return getTest(ctx, id);

  // Default title follows subject/date changes only when the title was the generated one
  if (updates.title === undefined && (updates.subject_name || updates.test_date)) {
    const wasDefault = test.title === defaultTitle(test.subject_name, test.test_date);
    if (wasDefault) updates.title = defaultTitle(updates.subject_name || test.subject_name, updates.test_date || test.test_date);
  }

  updates.updated_by = ctx.actorId;
  await test.update(updates);
  return getTest(ctx, id);
};

export const deleteTest = async (ctx, id) => {
  const test = await loadTest(ctx, id);
  assertTeacherCanEdit(ctx, test);
  await test.destroy(); // soft delete (paranoid); marks rows are kept for audit
  return { id: test.id };
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKS
// ─────────────────────────────────────────────────────────────────────────────

export const saveMarks = async (ctx, id, entries) => {
  if (!Array.isArray(entries) || entries.length === 0) throw new AppError('marks must be a non-empty array', 400);
  if (entries.length > MAX_MARK_ROWS) throw new AppError(`At most ${MAX_MARK_ROWS} rows per request`, 400);

  return sequelize.transaction(async (transaction) => {
    // Row lock serializes concurrent saves (web + mobile) and the publish race
    const test = await TestRecord.findOne({
      where: { id: (assertUuid(id, 'test record id'), id), ...baseWhere(ctx) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!test) throw new AppError('Test record not found', 404);
    assertTeacherCanEdit(ctx, test);

    if (test.test_date > todayPkt()) {
      throw new AppError(`Marks can only be entered on or after the test date (${test.test_date})`, 400);
    }

    const total = Number(test.total_marks);
    const roster = await getRoster(ctx.instituteId, test.class_id, test.section_id);
    const rosterIds = new Set(roster.map((s) => s.student_id));

    // Validate everything first; one bad row rejects the whole request (nothing is half-saved)
    const seen = new Set();
    const rows = [];
    entries.forEach((e, i) => {
      const where = `marks[${i}]`;
      if (!e || !e.student_id || !UUID_RE.test(String(e.student_id))) throw new AppError(`${where}: valid student_id is required`, 400);
      if (!rosterIds.has(e.student_id)) throw new AppError(`${where}: student is not in this test's class/section`, 400);
      if (seen.has(e.student_id)) throw new AppError(`${where}: duplicate student_id`, 400);
      seen.add(e.student_id);

      const absent = e.is_absent === true || e.is_absent === 'true';
      let remark = e.remark === undefined ? undefined : (isBlank(e.remark) ? null : String(e.remark).trim());
      if (remark && remark.length > 255) throw new AppError(`${where}: remark must be 255 characters or less`, 400);

      let marks = null;
      if (!absent && !isBlank(e.marks_obtained)) {
        marks = Number(e.marks_obtained);
        if (!Number.isFinite(marks)) throw new AppError(`${where}: marks_obtained must be a number`, 400);
        if (marks < 0 || marks > total) throw new AppError(`${where}: marks_obtained must be between 0 and ${total}`, 400);
        marks = round2(marks);
      }
      rows.push({ student_id: e.student_id, absent, marks, remark, clear: e.clear === true || e.clear === 'true' });
    });

    const existing = await TestMark.findAll({
      where: { test_record_id: test.id, student_id: { [Op.in]: rows.map((r) => r.student_id) } },
      transaction,
    });
    const existingByStudent = new Map(existing.map((m) => [m.student_id, m]));

    const result = { created: 0, updated: 0, cleared: 0, skipped_blank: 0 };
    for (const r of rows) {
      const prev = existingByStudent.get(r.student_id);
      const entered = r.absent || r.marks !== null;

      if (r.clear) {
        if (prev) { await prev.destroy({ transaction }); result.cleared += 1; }
        continue;
      }
      if (!entered) {
        // Blank means "not entered yet": never stored as 0. Only a remark on an existing row may change.
        if (prev && r.remark !== undefined) {
          await prev.update({ remark: r.remark, entered_by: ctx.actorId }, { transaction });
          result.updated += 1;
        } else {
          result.skipped_blank += 1;
        }
        continue;
      }
      if (prev) {
        await prev.update({
          marks_obtained: r.absent ? null : r.marks,
          is_absent: r.absent,
          ...(r.remark !== undefined ? { remark: r.remark } : {}),
          entered_by: ctx.actorId,
        }, { transaction });
        result.updated += 1;
      } else {
        await TestMark.create({
          test_record_id: test.id,
          institute_id: ctx.instituteId,
          student_id: r.student_id,
          marks_obtained: r.absent ? null : r.marks,
          is_absent: r.absent,
          remark: r.remark ?? null,
          entered_by: ctx.actorId,
        }, { transaction });
        result.created += 1;
      }
    }

    // draft <-> marks_entered follows whether any marks exist. Published stays published.
    const enteredCount = await TestMark.count({
      where: { test_record_id: test.id, [Op.or]: [{ is_absent: true }, { marks_obtained: { [Op.ne]: null } }] },
      transaction,
    });
    let status = test.status;
    if (status !== 'published') {
      status = enteredCount > 0 ? 'marks_entered' : 'draft';
      if (status !== test.status) await test.update({ status, updated_by: ctx.actorId }, { transaction });
    }

    return { ...result, status, entered_count: enteredCount, total_students: roster.length };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLISH / UNPUBLISH (admin)
// ─────────────────────────────────────────────────────────────────────────────

export const publishTest = async (ctx, id) =>
  sequelize.transaction(async (transaction) => {
    const test = await TestRecord.findOne({
      where: { id: (assertUuid(id, 'test record id'), id), ...baseWhere(ctx) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!test) throw new AppError('Test record not found', 404);
    if (test.status === 'published') throw new AppError('Test is already published', 409);

    const entered = await TestMark.count({
      where: { test_record_id: test.id, [Op.or]: [{ is_absent: true }, { marks_obtained: { [Op.ne]: null } }] },
      transaction,
    });
    if (entered === 0) throw new AppError('Enter marks for at least one student before publishing', 409);

    await test.update({ status: 'published', published_at: new Date(), published_by: ctx.actorId, updated_by: ctx.actorId }, { transaction });
    return { id: test.id, status: 'published', published_at: test.published_at };
  });

export const unpublishTest = async (ctx, id) =>
  sequelize.transaction(async (transaction) => {
    const test = await TestRecord.findOne({
      where: { id: (assertUuid(id, 'test record id'), id), ...baseWhere(ctx) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!test) throw new AppError('Test record not found', 404);
    if (test.status !== 'published') throw new AppError('Test is not published', 409);
    await test.update({ status: 'marks_entered', published_at: null, published_by: null, updated_by: ctx.actorId }, { transaction });
    return { id: test.id, status: 'marks_entered' };
  });

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT / PARENT (read-only, published only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Published tests of ONE student (caller must already have verified ownership).
 * Only tests where the student actually has an entered result/absence are returned.
 */
export const listPublishedForStudent = async (instituteId, studentId, filters = {}, pagination = {}) => {
  const testWhere = { institute_id: instituteId, status: 'published' };
  if (filters.subject) testWhere[Op.and] = [sequelize.where(sequelize.fn('lower', sequelize.col('test.subject_name')), lc(filters.subject))];
  if (filters.from_date || filters.to_date) {
    testWhere.test_date = {};
    if (filters.from_date) testWhere.test_date[Op.gte] = parseTestDate(filters.from_date);
    if (filters.to_date) testWhere.test_date[Op.lte] = parseTestDate(filters.to_date);
  }

  const markWhere = {
    student_id: studentId,
    institute_id: instituteId,
    [Op.or]: [{ is_absent: true }, { marks_obtained: { [Op.ne]: null } }],
  };
  const include = [{
    model: TestRecord,
    as: 'test',
    where: testWhere,
    required: true,
    include: [{ model: User, as: 'teacher', attributes: ['id', 'first_name', 'last_name'], required: false }],
  }];

  const page = Math.max(parseInt(pagination.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(pagination.limit, 10) || 20, 1), 100);

  const [{ count, rows }, all] = await Promise.all([
    TestMark.findAndCountAll({
      where: markWhere,
      include,
      order: [[{ model: TestRecord, as: 'test' }, 'test_date', 'DESC'], ['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    }),
    TestMark.findAll({ where: markWhere, include: [{ model: TestRecord, as: 'test', where: testWhere, required: true, attributes: ['id', 'subject_name', 'total_marks', 'passing_marks'] }] }),
  ]);

  const toItem = (m) => {
    const t = m.test;
    const total = Number(t.total_marks);
    const marks = m.marks_obtained === null ? null : Number(m.marks_obtained);
    return {
      id: t.id,
      title: t.title,
      subject_id: t.subject_id,
      subject_name: t.subject_name,
      test_date: t.test_date,
      total_marks: total,
      passing_marks: Number(t.passing_marks),
      marks_obtained: marks,
      is_absent: m.is_absent,
      percentage: marks === null ? null : pct(marks, total),
      result: m.is_absent ? 'absent' : (marks >= Number(t.passing_marks) ? 'pass' : 'fail'),
      remark: m.remark,
      teacher_name: t.teacher ? `${t.teacher.first_name || ''} ${t.teacher.last_name || ''}`.trim() : null,
      published_at: t.published_at,
    };
  };

  // Summary over ALL matching tests (not just this page)
  const bySubject = new Map();
  const bump = (name) => {
    if (!bySubject.has(name)) bySubject.set(name, { subject_name: name, tests: 0, absent: 0, passed: 0, failed: 0, _pctSum: 0, _scored: 0 });
    return bySubject.get(name);
  };
  const overall = { tests: 0, absent: 0, passed: 0, failed: 0, _pctSum: 0, _scored: 0 };
  all.forEach((m) => {
    const t = m.test;
    const s = bump(t.subject_name);
    [s, overall].forEach((x) => { x.tests += 1; });
    if (m.is_absent) { [s, overall].forEach((x) => { x.absent += 1; }); return; }
    const marks = Number(m.marks_obtained);
    const p = pct(marks, Number(t.total_marks));
    const passed = marks >= Number(t.passing_marks);
    [s, overall].forEach((x) => { x._pctSum += p; x._scored += 1; passed ? (x.passed += 1) : (x.failed += 1); });
  });
  const finish = ({ _pctSum, _scored, ...rest }) => ({ ...rest, average_percentage: _scored ? round2(_pctSum / _scored) : null });

  return {
    data: rows.map(toItem),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
    summary: {
      overall: finish(overall),
      by_subject: [...bySubject.values()].map(finish).sort((a, b) => a.subject_name.localeCompare(b.subject_name)),
    },
  };
};

export default {
  getRoster,
  getTeacherScope,
  getTeacherOptions,
  getAdminOptions,
  createTest,
  listTests,
  getTest,
  updateTest,
  deleteTest,
  saveMarks,
  publishTest,
  unpublishTest,
  listPublishedForStudent,
};
