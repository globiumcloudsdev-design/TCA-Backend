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

/**
 * PURE builder (no DB): merges every way a teacher is assigned into one flat scope of
 * { class_id, section_id|null, subject_id|null, subject_name }.
 *
 * Sources (all combined):
 *   1. timetable slots            -> class + section + subject                   (sources.timetable)
 *   2. Subject.teacher_id         -> class (all sections) + subject              (sources.subjectsTaught)
 *   3. Class.class_teacher_id     -> class (all sections) + the class subjects   (sources.classTeacherClasses)
 *   4. Section.section_teacher_id -> that section + the class subjects           (sources.sectionTeacherSections)
 *   5. details.teacherDetails.subjects (profile) -> those subjects in every class/section the
 *      teacher already has from sources 1-4                                      (sources.profileSubjects)
 * classSubjects: Map(classId -> [{ id, name }]) used by 3 and 4.
 */
export const buildTeacherScope = (sources = {}) => {
  const {
    timetable = [],
    subjectsTaught = [],
    classTeacherClasses = [],
    sectionTeacherSections = [],
    profileSubjects = [],
    classSubjects = new Map(),
  } = sources;

  const seen = new Set();
  const entries = [];
  const add = (class_id, section_id, subject_id, subject_name) => {
    if (!class_id || (!subject_id && !subject_name)) return;
    const key = `${class_id}|${section_id || ''}|${subject_id || ''}|${lc(subject_name)}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ class_id, section_id: section_id || null, subject_id: subject_id || null, subject_name: subject_name || null });
  };

  timetable.forEach((e) => add(e.class_id, e.section_id, e.subject_id, e.subject_name));
  subjectsTaught.forEach((s) => add(s.class_id, null, s.id, s.name));
  classTeacherClasses.forEach((c) => (classSubjects.get(c.id) || []).forEach((s) => add(c.id, null, s.id, s.name)));
  sectionTeacherSections.forEach((sec) => (classSubjects.get(sec.class_id) || []).forEach((s) => add(sec.class_id, sec.id, s.id, s.name)));

  // Profile-declared subjects apply to the class/section pairs the teacher already has
  if (profileSubjects.length) {
    const pairs = new Map();
    entries.forEach((e) => pairs.set(`${e.class_id}|${e.section_id || ''}`, e));
    classTeacherClasses.forEach((c) => pairs.set(`${c.id}|`, { class_id: c.id, section_id: null }));
    sectionTeacherSections.forEach((sec) => pairs.set(`${sec.class_id}|${sec.id}`, { class_id: sec.class_id, section_id: sec.id }));
    for (const p of pairs.values()) profileSubjects.forEach((s) => add(p.class_id, p.section_id, s.id, s.name));
  }
  return entries;
};

/** Normalise details.teacherDetails.subjects: strings (names or uuids) / { id, name } objects */
const readProfileSubjects = async (teacher, instituteId) => {
  const raw = teacher?.details?.teacherDetails?.subjects;
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  const ids = [];
  for (const item of list) {
    if (item && typeof item === 'object') {
      const validId = item.id && UUID_RE.test(String(item.id)) ? item.id : null;
      if (validId) ids.push(validId);
      if (item.name) out.push({ id: validId, name: String(item.name) });
    } else if (typeof item === 'string' && item.trim()) {
      if (UUID_RE.test(item.trim())) ids.push(item.trim());
      else out.push({ id: null, name: item.trim() });
    }
  }
  if (ids.length) {
    const rows = await Subject.findAll({ where: { id: { [Op.in]: ids }, school_id: instituteId }, attributes: ['id', 'name'] });
    rows.forEach((r) => out.push({ id: r.id, name: r.name }));
  }
  return out;
};

/** Everything a teacher is assigned to (timetable, subject/class/section teacher, profile subjects). Read-only. */
export const getTeacherScope = async (teacherId, instituteId) => {
  const [timetables, subjectsTaught, classTeacherClasses, sectionTeacherSections, teacher] = await Promise.all([
    Timetable.findAll({ where: { school_id: instituteId, is_active: true } }),
    Subject.findAll({ where: { school_id: instituteId, teacher_id: teacherId, is_active: true }, attributes: ['id', 'name', 'class_id'] }),
    Class.findAll({ where: { school_id: instituteId, class_teacher_id: teacherId }, attributes: ['id'] }),
    Section.findAll({ where: { school_id: instituteId, section_teacher_id: teacherId }, attributes: ['id', 'class_id'] }),
    User.findOne({ where: { id: teacherId, school_id: instituteId }, attributes: ['id', 'details'] }),
  ]);

  const timetable = [];
  for (const tt of timetables) {
    const classId = tt.entity_ids?.class_id;
    if (!classId) continue;
    const ttSection = tt.entity_ids?.section_id || null;
    for (const slot of tt.slots || []) {
      if (slot.teacher_id !== teacherId || slot.is_break) continue;
      timetable.push({ class_id: classId, section_id: slot.section_id || ttSection, subject_id: slot.subject_id, subject_name: slot.subject_name });
    }
  }

  // Subjects of the classes the teacher is class/section teacher of
  const headClassIds = [...new Set([...classTeacherClasses.map((c) => c.id), ...sectionTeacherSections.map((s) => s.class_id)])];
  const classSubjects = new Map();
  if (headClassIds.length) {
    const rows = await Subject.findAll({ where: { school_id: instituteId, class_id: { [Op.in]: headClassIds }, is_active: true }, attributes: ['id', 'name', 'class_id'] });
    rows.forEach((r) => {
      if (!classSubjects.has(r.class_id)) classSubjects.set(r.class_id, []);
      classSubjects.get(r.class_id).push({ id: r.id, name: r.name });
    });
  }

  return buildTeacherScope({
    timetable,
    subjectsTaught: subjectsTaught.map((s) => ({ id: s.id, name: s.name, class_id: s.class_id })),
    classTeacherClasses: classTeacherClasses.map((c) => ({ id: c.id })),
    sectionTeacherSections: sectionTeacherSections.map((s) => ({ id: s.id, class_id: s.class_id })),
    profileSubjects: await readProfileSubjects(teacher, instituteId),
    classSubjects,
  });
};

const subjectMatches = (entry, subject) =>
  (subject.subject_id && entry.subject_id && entry.subject_id === subject.subject_id) ||
  (subject.subject_name && entry.subject_name && lc(entry.subject_name) === lc(subject.subject_name));

export const assertTeacherMayTest = (scope, { class_id, section_id, subject_id, subject_name }, forAdmin = false) => {
  const ok = scope.some(
    (e) =>
      e.class_id === class_id &&
      // class-level timetable entries (no section) cover every section of that class
      (!e.section_id || e.section_id === (section_id || null)) &&
      subjectMatches(e, { subject_id, subject_name })
  );
  if (!ok) {
    throw new AppError(
      forAdmin
        ? 'The selected teacher is not assigned to this class, section and subject. Pick one of the assigned classes, sections and subjects.'
        : 'You can only create tests for the classes, sections and subjects assigned to you',
      403
    );
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

  // Same rule for admins and teachers: class/section/subject must be assigned to the (selected) teacher
  const scope = await getTeacherScope(teacherId, ctx.instituteId);
  const subject = await resolveSubject(ctx, body, scope);
  assertTeacherMayTest(scope, { class_id: cls.id, section_id: sectionId, ...subject }, !isTeacher(ctx));

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
    const scope = await getTeacherScope(teacherId, ctx.instituteId);
    const subject = await resolveSubject(ctx, subjectBody, scope);
    assertTeacherMayTest(scope, { class_id: cls.id, section_id: sectionId, ...subject }, !isTeacher(ctx));

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

/** Validate ONE marks entry against a test. Throws AppError (message has no row prefix). */
const parseMarkEntry = (e, total, rosterIds) => {
  if (!e || !e.student_id || !UUID_RE.test(String(e.student_id))) throw new AppError('valid student_id is required', 400);
  if (!rosterIds.has(e.student_id)) throw new AppError("student is not in this test's class/section", 400);

  const absent = e.is_absent === true || e.is_absent === 'true';
  const remark = e.remark === undefined ? undefined : (isBlank(e.remark) ? null : String(e.remark).trim());
  if (remark && remark.length > 255) throw new AppError('remark must be 255 characters or less', 400);

  let marks = null;
  if (!absent && !isBlank(e.marks_obtained)) {
    marks = Number(e.marks_obtained);
    if (!Number.isFinite(marks)) throw new AppError('marks_obtained must be a number', 400);
    if (marks < 0 || marks > total) throw new AppError(`marks_obtained must be between 0 and ${total}`, 400);
    marks = round2(marks);
  }
  return { student_id: e.student_id, absent, marks, remark, clear: e.clear === true || e.clear === 'true' };
};

const assertMarksEntryOpen = (ctx, test) => {
  assertTeacherCanEdit(ctx, test);
  if (test.test_date > todayPkt()) {
    throw new AppError(`Marks can only be entered on or after the test date (${test.test_date})`, 400);
  }
};

/** Upsert the validated rows of one test (never deletes rows that are not in the payload) */
const applyMarkRows = async (ctx, test, rows, transaction) => {
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
  return result;
};

/** draft <-> marks_entered follows whether any marks exist. Published stays published. */
const refreshStatus = async (ctx, test, transaction) => {
  const enteredCount = await TestMark.count({
    where: { test_record_id: test.id, [Op.or]: [{ is_absent: true }, { marks_obtained: { [Op.ne]: null } }] },
    transaction,
  });
  let status = test.status;
  if (status !== 'published') {
    status = enteredCount > 0 ? 'marks_entered' : 'draft';
    if (status !== test.status) await test.update({ status, updated_by: ctx.actorId }, { transaction });
  }
  return { status, entered_count: enteredCount };
};

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
    assertMarksEntryOpen(ctx, test);

    const total = Number(test.total_marks);
    const roster = await getRoster(ctx.instituteId, test.class_id, test.section_id);
    const rosterIds = new Set(roster.map((s) => s.student_id));

    // Validate everything first; one bad row rejects the whole request (nothing is half-saved)
    const seen = new Set();
    const rows = entries.map((e, i) => {
      try {
        const row = parseMarkEntry(e, total, rosterIds);
        if (seen.has(row.student_id)) throw new AppError('duplicate student_id', 400);
        seen.add(row.student_id);
        return row;
      } catch (err) {
        throw new AppError(`marks[${i}]: ${err.message}`, err.statusCode || 400);
      }
    });

    const result = await applyMarkRows(ctx, test, rows, transaction);
    const { status, entered_count } = await refreshStatus(ctx, test, transaction);
    return { ...result, status, entered_count, total_students: roster.length };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// MONTHLY SHEET (paper "Test Record Sheet": students x tests for one
// class + section + subject + teacher + month + year)
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MAX_SHEET_CELLS = 2000;

const parseMonthYear = (q = {}) => {
  const now = new Date(`${todayPkt()}T00:00:00Z`);
  const month = q.month === undefined || q.month === '' ? now.getUTCMonth() + 1 : parseInt(q.month, 10);
  const year = q.year === undefined || q.year === '' ? now.getUTCFullYear() : parseInt(q.year, 10);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new AppError('month must be 1-12', 400);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new AppError('year must be a valid 4-digit year', 400);
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { month, year, from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
};

/** Resolve + authorize the class/section/subject/teacher selector shared by sheet GET and publish */
const resolveSheetSelector = async (ctx, q = {}) => {
  const teacherId = isTeacher(ctx) ? ctx.actorId : q.teacher_id;
  if (!teacherId) throw new AppError('teacher_id is required', 400);
  assertUuid(teacherId, 'teacher_id');
  assertUuid(q.class_id, 'class_id');

  const cls = await Class.findOne({ where: { id: q.class_id, school_id: ctx.instituteId }, attributes: ['id', 'name', 'branch_id'] });
  if (!cls || (ctx.branchId && cls.branch_id && cls.branch_id !== ctx.branchId)) throw new AppError('Class not found', 404);

  const sectionCount = await Section.count({ where: { class_id: cls.id, school_id: ctx.instituteId } });
  let section = null;
  if (sectionCount > 0) {
    if (!q.section_id) throw new AppError('section_id is required for this class', 400);
    assertUuid(q.section_id, 'section_id');
    section = await Section.findOne({ where: { id: q.section_id, class_id: cls.id, school_id: ctx.instituteId }, attributes: ['id', 'name'] });
    if (!section) throw new AppError('Section not found in this class', 404);
  }

  const subjectId = q.subject_id || null;
  if (subjectId) assertUuid(subjectId, 'subject_id');
  const subjectName = q.subject_name || q.subject ? String(q.subject_name || q.subject).trim() : null;
  if (!subjectId && !subjectName) throw new AppError('subject is required (subject_id or subject)', 400);

  const teacher = await User.findOne({
    where: { id: teacherId, school_id: ctx.instituteId, user_type: 'TEACHER' },
    attributes: ['id', 'first_name', 'last_name', 'branch_id'],
  });
  if (!teacher || (ctx.branchId && teacher.branch_id && teacher.branch_id !== ctx.branchId)) throw new AppError('Teacher not found', 404);

  let resolvedSubjectName = subjectName;
  if (isTeacher(ctx)) {
    // A teacher may only open sheets of classes/sections/subjects assigned to them (also protects the roster)
    const scope = await getTeacherScope(teacherId, ctx.instituteId);
    if (subjectId && !resolvedSubjectName) {
      resolvedSubjectName = scope.find((e) => e.subject_id === subjectId)?.subject_name || null;
    }
    assertTeacherMayTest(scope, { class_id: cls.id, section_id: section?.id || null, subject_id: subjectId, subject_name: resolvedSubjectName });
  }
  return { cls, section, subjectId, subjectName: resolvedSubjectName, teacher };
};

const sheetTestWhere = (ctx, sel, period) => {
  const where = {
    institute_id: ctx.instituteId,
    ...(ctx.branchId ? { branch_id: ctx.branchId } : {}),
    teacher_id: sel.teacher.id,
    class_id: sel.cls.id,
    section_id: sel.section ? sel.section.id : null,
    test_date: { [Op.between]: [period.from, period.to] },
  };
  if (sel.subjectId) {
    where.subject_id = sel.subjectId;
  } else {
    where[Op.and] = [sequelize.where(sequelize.fn('lower', sequelize.col('TestRecord.subject_name')), lc(sel.subjectName))];
  }
  return where;
};

const sumSheet = (testsById, marksOfStudent) => {
  let obtained = 0;
  let possible = 0;
  let attended = 0;
  let absent = 0;
  for (const [testId, m] of Object.entries(marksOfStudent)) {
    const t = testsById.get(testId);
    if (!t) continue;
    if (m.is_absent) { absent += 1; continue; }
    if (m.marks_obtained === null) continue;
    obtained += m.marks_obtained;
    possible += Number(t.total_marks);
    attended += 1;
  }
  return {
    total_obtained: round2(obtained),
    total_possible: round2(possible),
    percentage: possible > 0 ? pct(obtained, possible) : null,
    tests_attended: attended,
    tests_absent: absent,
  };
};

export const getSheet = async (ctx, q = {}) => {
  const period = parseMonthYear(q);
  const sel = await resolveSheetSelector(ctx, q);

  const [tests, roster, institute] = await Promise.all([
    TestRecord.findAll({ where: sheetTestWhere(ctx, sel, period), order: [['test_date', 'ASC'], ['created_at', 'ASC']] }),
    getRoster(ctx.instituteId, sel.cls.id, sel.section ? sel.section.id : null),
    models.Institute.findByPk(ctx.instituteId, { attributes: ['institute_name'] }),
  ]);

  const testIds = tests.map((t) => t.id);
  const marks = testIds.length ? await TestMark.findAll({ where: { test_record_id: { [Op.in]: testIds } } }) : [];
  const marksByStudent = new Map();
  marks.forEach((m) => {
    if (!marksByStudent.has(m.student_id)) marksByStudent.set(m.student_id, {});
    marksByStudent.get(m.student_id)[m.test_record_id] = {
      marks_obtained: m.marks_obtained === null ? null : Number(m.marks_obtained),
      is_absent: m.is_absent,
      remark: m.remark || null,
    };
  });
  const testsById = new Map(tests.map((t) => [t.id, t]));

  const subjectName = tests[0]?.subject_name || sel.subjectName
    || (await Subject.findOne({ where: { id: sel.subjectId, school_id: ctx.instituteId }, attributes: ['name'] }))?.name || null;

  const students = roster.map((s, i) => {
    const cells = {};
    const own = marksByStudent.get(s.student_id) || {};
    tests.forEach((t) => { cells[t.id] = own[t.id] || { marks_obtained: null, is_absent: false, remark: null }; });
    return {
      s_no: i + 1,
      student_id: s.student_id,
      name: s.name,
      roll_number: s.roll_no,
      registration_no: s.registration_no,
      marks: cells,
      summary: sumSheet(testsById, own),
    };
  });

  const editable = (t) => !(isTeacher(ctx) && t.status === 'published');
  return {
    header: {
      school_name: institute?.institute_name || null,
      class_id: sel.cls.id, class: sel.cls.name,
      section_id: sel.section?.id || null, section: sel.section?.name || null,
      subject_id: sel.subjectId || tests[0]?.subject_id || null, subject: subjectName,
      teacher_id: sel.teacher.id, teacher: `${sel.teacher.first_name || ''} ${sel.teacher.last_name || ''}`.trim(),
      month: period.month, month_name: MONTH_NAMES[period.month - 1], year: period.year,
    },
    tests: tests.map((t) => ({
      id: t.id,
      title: t.title,
      test_date: t.test_date,
      total_marks: Number(t.total_marks),
      passing_marks: Number(t.passing_marks),
      status: t.status,
      can_edit: editable(t),
      marks_entry_open: t.test_date <= todayPkt(),
    })),
    students,
    totals: {
      tests: tests.length,
      total_marks_all_tests: round2(tests.reduce((a, t) => a + Number(t.total_marks), 0)),
      students: students.length,
    },
  };
};

/**
 * Bulk save of cells across the tests of a sheet.
 * All-or-nothing: if ANY cell is invalid nothing is saved and every bad cell is reported
 * (HTTP 422, body.errors = [{ index, test_record_id, student_id, message }]).
 */
export const saveSheetMarks = async (ctx, cells) => {
  if (!Array.isArray(cells) || cells.length === 0) throw new AppError('cells must be a non-empty array', 400);
  if (cells.length > MAX_SHEET_CELLS) throw new AppError(`At most ${MAX_SHEET_CELLS} cells per request`, 400);

  return sequelize.transaction(async (transaction) => {
    const testIds = [...new Set(cells.map((c) => c?.test_record_id).filter((v) => v && UUID_RE.test(String(v))))].sort();

    // Lock in a stable order (no deadlocks between two teachers saving the same sheet)
    const tests = testIds.length
      ? await TestRecord.findAll({
          where: { id: { [Op.in]: testIds }, ...baseWhere(ctx) },
          order: [['id', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
      : [];
    const testById = new Map(tests.map((t) => [t.id, t]));

    const errors = [];
    const rosterCache = new Map();
    const rosterIdsFor = async (test) => {
      const key = `${test.class_id}|${test.section_id || ''}`;
      if (!rosterCache.has(key)) {
        const roster = await getRoster(ctx.instituteId, test.class_id, test.section_id);
        rosterCache.set(key, new Set(roster.map((s) => s.student_id)));
      }
      return rosterCache.get(key);
    };

    const rowsByTest = new Map();
    const seen = new Set();
    const testProblem = new Map(); // test id -> message (reported once per cell)

    for (let i = 0; i < cells.length; i += 1) {
      const c = cells[i] || {};
      const fail = (message) => errors.push({ index: i, test_record_id: c.test_record_id || null, student_id: c.student_id || null, message });

      if (!c.test_record_id || !UUID_RE.test(String(c.test_record_id))) { fail('valid test_record_id is required'); continue; }
      const test = testById.get(c.test_record_id);
      if (!test) { fail('Test record not found'); continue; }

      if (!testProblem.has(test.id)) {
        try { assertMarksEntryOpen(ctx, test); testProblem.set(test.id, null); } catch (err) { testProblem.set(test.id, err.message); }
      }
      if (testProblem.get(test.id)) { fail(testProblem.get(test.id)); continue; }

      try {
        const row = parseMarkEntry(c, Number(test.total_marks), await rosterIdsFor(test));
        const key = `${test.id}|${row.student_id}`;
        if (seen.has(key)) throw new AppError('duplicate cell for this test and student', 400);
        seen.add(key);
        if (!rowsByTest.has(test.id)) rowsByTest.set(test.id, []);
        rowsByTest.get(test.id).push(row);
      } catch (err) {
        fail(err.message);
      }
    }

    if (errors.length) {
      const err = new AppError(`${errors.length} cell(s) are invalid. Nothing was saved.`, 422);
      err.errors = errors;
      throw err; // rolls the transaction back
    }

    const totals = { created: 0, updated: 0, cleared: 0, skipped_blank: 0 };
    const perTest = [];
    for (const test of tests) {
      const rows = rowsByTest.get(test.id);
      if (!rows) continue;
      const r = await applyMarkRows(ctx, test, rows, transaction);
      Object.keys(totals).forEach((k) => { totals[k] += r[k]; });
      const { status, entered_count } = await refreshStatus(ctx, test, transaction);
      perTest.push({ test_record_id: test.id, status, entered_count });
    }
    return { ...totals, tests: perTest };
  });
};

/** Admin: publish every marks_entered test of a sheet. Drafts (no marks) are skipped, not failed. */
export const publishSheet = async (ctx, body = {}) => {
  const period = parseMonthYear(body);
  const sel = await resolveSheetSelector(ctx, body);

  return sequelize.transaction(async (transaction) => {
    const tests = await TestRecord.findAll({
      where: sheetTestWhere(ctx, sel, period),
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const published = [];
    const skipped = [];
    for (const t of tests) {
      if (t.status === 'published') { skipped.push({ id: t.id, reason: 'already published' }); continue; }
      const entered = await TestMark.count({
        where: { test_record_id: t.id, [Op.or]: [{ is_absent: true }, { marks_obtained: { [Op.ne]: null } }] },
        transaction,
      });
      if (entered === 0) { skipped.push({ id: t.id, reason: 'no marks entered' }); continue; }
      await t.update({ status: 'published', published_at: new Date(), published_by: ctx.actorId, updated_by: ctx.actorId }, { transaction });
      published.push(t.id);
    }
    return { published_count: published.length, published, skipped };
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

/**
 * Parent/student monthly view: published tests of one month grouped by subject (+teacher),
 * with monthly totals. Caller must already have verified ownership of studentId.
 */
export const listMonthlyForStudent = async (instituteId, studentId, q = {}) => {
  const period = parseMonthYear(q);
  const marks = await TestMark.findAll({
    where: {
      student_id: studentId,
      institute_id: instituteId,
      [Op.or]: [{ is_absent: true }, { marks_obtained: { [Op.ne]: null } }],
    },
    include: [{
      model: TestRecord,
      as: 'test',
      required: true,
      where: { institute_id: instituteId, status: 'published', test_date: { [Op.between]: [period.from, period.to] } },
      include: [{ model: User, as: 'teacher', attributes: ['id', 'first_name', 'last_name'], required: false }],
    }],
    order: [[{ model: TestRecord, as: 'test' }, 'test_date', 'ASC']],
  });

  const groups = new Map();
  const overall = { obtained: 0, possible: 0, tests: 0, absent: 0 };
  for (const m of marks) {
    const t = m.test;
    const key = `${lc(t.subject_name)}|${t.teacher_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        subject_id: t.subject_id,
        subject_name: t.subject_name,
        teacher_id: t.teacher_id,
        teacher_name: t.teacher ? `${t.teacher.first_name || ''} ${t.teacher.last_name || ''}`.trim() : null,
        tests: [],
        _obtained: 0,
        _possible: 0,
      });
    }
    const g = groups.get(key);
    const total = Number(t.total_marks);
    const obtained = m.marks_obtained === null ? null : Number(m.marks_obtained);
    g.tests.push({
      id: t.id,
      title: t.title,
      date: t.test_date,
      total_marks: total,
      passing_marks: Number(t.passing_marks),
      marks_obtained: obtained,
      is_absent: m.is_absent,
      percentage: obtained === null ? null : pct(obtained, total),
      result: m.is_absent ? 'absent' : (obtained >= Number(t.passing_marks) ? 'pass' : 'fail'),
      remark: m.remark,
    });
    overall.tests += 1;
    if (m.is_absent) { overall.absent += 1; continue; }
    g._obtained += obtained;
    g._possible += total;
    overall.obtained += obtained;
    overall.possible += total;
  }

  return {
    month: period.month,
    month_name: MONTH_NAMES[period.month - 1],
    year: period.year,
    subjects: [...groups.values()]
      .map(({ _obtained, _possible, ...g }) => ({
        ...g,
        monthly_total_obtained: round2(_obtained),
        monthly_total_possible: round2(_possible),
        monthly_percentage: _possible > 0 ? pct(_obtained, _possible) : null,
      }))
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name)),
    overall: {
      tests: overall.tests,
      absent: overall.absent,
      total_obtained: round2(overall.obtained),
      total_possible: round2(overall.possible),
      percentage: overall.possible > 0 ? pct(overall.obtained, overall.possible) : null,
    },
  };
};

export default {
  getRoster,
  getTeacherScope,
  buildTeacherScope,
  assertTeacherMayTest,
  getTeacherOptions,
  getAdminOptions,
  createTest,
  listTests,
  getTest,
  updateTest,
  deleteTest,
  saveMarks,
  getSheet,
  saveSheetMarks,
  publishSheet,
  listMonthlyForStudent,
  publishTest,
  unpublishTest,
  listPublishedForStudent,
};
