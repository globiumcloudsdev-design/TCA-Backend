/**
 * Automatic-event notifications. Every function here is FIRE-AND-FORGET: it schedules background
 * work and returns immediately; it never throws and never delays the request/job that calls it.
 *
 * (Events that already create inbox rows through createNotification()/broadcastNotification() push
 *  via the `push` option of those functions instead; this file covers the rest.)
 */
import { Op } from 'sequelize';
import models from '../../models/postgres/index.js';
import logger from '../../config/logger.js';
import { deliver, runInBackground } from './notify.service.js';
import { studentsAndParents, defaultDeps } from './audience.service.js';

const { User, TestRecord, TestMark, Exam, Section } = models;

const fullName = (u) => `${u?.first_name || ''} ${u?.last_name || ''}`.trim();

/** Active admins who should see school-level requests for a branch: institute admins + that branch's admins */
export const adminRecipients = async (instituteId, branchId = null) => {
  const rows = await User.findAll({
    where: {
      school_id: instituteId,
      is_active: true,
      [Op.or]: [
        { user_type: { [Op.in]: ['INSTITUTE_ADMIN', 'SUPER_ADMIN'] } },
        ...(branchId ? [{ user_type: 'BRANCH_ADMIN', branch_id: branchId }] : [{ user_type: 'BRANCH_ADMIN' }]),
      ],
    },
    attributes: ['id'],
  });
  return rows.map((r) => r.id);
};

/** Students + parents of the given students */
export const notifyStudentsAndParents = ({ instituteId, studentIds, payload, options = {}, label = 'students+parents' }) =>
  runInBackground(label, async () => {
    const ids = await studentsAndParents(instituteId, studentIds, {}, defaultDeps);
    await deliver(ids, { institute_id: instituteId, ...payload }, options);
  });

/** Parents only (e.g. attendance) */
export const notifyParentsOfStudents = ({ instituteId, studentIds, payload, options = {}, label = 'parents' }) =>
  runInBackground(label, async () => {
    const ids = await studentsAndParents(instituteId, studentIds, { includeStudents: false }, defaultDeps);
    await deliver(ids, { institute_id: instituteId, ...payload }, options);
  });

/** Specific users */
export const notifyUsers = ({ instituteId, userIds, payload, options = {}, label = 'users' }) =>
  runInBackground(label, async () => {
    await deliver(userIds, { institute_id: instituteId, ...payload }, options);
  });

/** Admins of a branch */
export const notifyAdmins = ({ instituteId, branchId = null, payload, options = {}, label = 'admins' }) =>
  runInBackground(label, async () => {
    const ids = await adminRecipients(instituteId, branchId);
    await deliver(ids, { institute_id: instituteId, branch_id: branchId, ...payload }, options);
  });

/** Students of a class/section + their parents (exam results, homework) */
export const notifyClassAudience = ({ instituteId, classId, sectionId = null, payload, options = {}, label = 'class' }) =>
  runInBackground(label, async () => {
    const students = await defaultDeps.listStudents({ instituteId, classId, sectionId });
    const ids = await studentsAndParents(instituteId, students.map((s) => s.id), {}, defaultDeps);
    await deliver(ids, { institute_id: instituteId, ...payload }, options);
  });

// ── event specific wrappers ──────────────────────────────────────────────────

/** Test records published (single or whole sheet). One notification per test to the students that have a result + their parents. */
export const notifyTestRecordsPublished = (instituteId, testIds) =>
  runInBackground('test_record published', async () => {
    const tests = await TestRecord.findAll({ where: { id: { [Op.in]: testIds }, institute_id: instituteId } });
    for (const t of tests) {
      const marks = await TestMark.findAll({
        where: { test_record_id: t.id, [Op.or]: [{ is_absent: true }, { marks_obtained: { [Op.ne]: null } }] },
        attributes: ['student_id'],
      });
      const studentIds = marks.map((m) => m.student_id);
      for (const sid of studentIds) {
        // one payload per student so the parent app can pick the right child (student_id in data)
        const ids = await studentsAndParents(instituteId, [sid], {}, defaultDeps);
        await deliver(ids, {
          institute_id: instituteId,
          branch_id: t.branch_id,
          type: 'test_record',
          title: 'New test result',
          body: `${t.subject_name} test result is available (${t.test_date}).`,
          entity_id: t.id,
          data: { student_id: sid, subject_name: t.subject_name, test_date: t.test_date },
        });
      }
    }
  });

/** Exam results published */
export const notifyExamResultsPublished = (instituteId, examId) =>
  runInBackground('exam_result published', async () => {
    const exam = await Exam.findOne({ where: { id: examId, school_id: instituteId } });
    if (!exam) return;
    const students = await defaultDeps.listStudents({ instituteId, classId: exam.class_id, sectionId: exam.section_id || null });
    for (const s of students) {
      const ids = await studentsAndParents(instituteId, [s.id], {}, defaultDeps);
      await deliver(ids, {
        institute_id: instituteId,
        branch_id: exam.branch_id || null,
        type: 'exam_result',
        title: 'Exam results published',
        body: `Results for ${exam.name} are now available.`,
        entity_id: exam.id,
        data: { student_id: s.id },
      });
    }
  });

/** Homework published: students of the targeted class/section(s) (or everyone) + their parents */
export const notifyAssignmentPublished = (assignment) =>
  runInBackground('homework assigned', async () => {
    const a = assignment?.toJSON ? assignment.toJSON() : assignment;
    if (!a?.institute_id) return;
    const instituteId = a.institute_id;
    const pairs = [];
    const targetIds = Array.isArray(a.target_ids) ? a.target_ids : [];
    if (a.target_type === 'class' && targetIds.length) targetIds.forEach((c) => pairs.push({ classId: c, sectionId: null }));
    else if (a.target_type === 'section' && targetIds.length) {
      const secs = await Section.findAll({ where: { id: { [Op.in]: targetIds }, school_id: instituteId }, attributes: ['id', 'class_id'] });
      secs.forEach((s) => pairs.push({ classId: s.class_id, sectionId: s.id }));
    } else if (a.class_id) pairs.push({ classId: a.class_id, sectionId: a.section_id || null });

    let students = [];
    if (a.target_type === 'all' && !pairs.length) {
      students = await defaultDeps.listUsers({ instituteId, roles: ['STUDENT'], branchId: null });
    } else {
      for (const p of pairs) students.push(...(await defaultDeps.listStudents({ instituteId, classId: p.classId, sectionId: p.sectionId })));
    }
    const unique = [...new Map(students.map((s) => [s.id, s])).values()];
    for (const s of unique) {
      const ids = await studentsAndParents(instituteId, [s.id], {}, defaultDeps);
      await deliver(ids, {
        institute_id: instituteId,
        branch_id: a.branch_id || null,
        type: 'homework',
        title: 'New homework',
        body: `${a.subject ? a.subject + ': ' : ''}${a.title}${a.due_date ? ' (due ' + a.due_date + ')' : ''}`,
        entity_id: a.id,
        data: { event: 'assigned', student_id: s.id },
      });
    }
  });

/** Homework graded: that student + parents */
export const notifyHomeworkGraded = ({ instituteId, assignment, submission }) =>
  notifyStudentsAndParents({
    instituteId,
    studentIds: [submission.student_id],
    label: 'homework graded',
    payload: {
      type: 'homework',
      title: 'Homework graded',
      body: `${assignment?.title || 'Your homework'} has been graded${submission.marks !== undefined && submission.marks !== null ? ': ' + submission.marks + (assignment?.total_marks ? '/' + assignment.total_marks : '') : '.'}`,
      entity_id: assignment?.id || submission.assignment_id,
      data: { event: 'graded', student_id: submission.student_id, submission_id: submission.id },
    },
  });

/** Attendance: only absent / late, parents only */
export const notifyAttendanceMarked = ({ instituteId, studentId, studentName, status, date, attendanceId = null }) => {
  const st = String(status || '').toLowerCase();
  if (st !== 'absent' && st !== 'late') return;
  notifyParentsOfStudents({
    instituteId,
    studentIds: [studentId],
    label: 'attendance',
    payload: {
      type: 'attendance',
      title: st === 'absent' ? 'Marked absent' : 'Marked late',
      body: `${studentName || 'Your child'} was marked ${st} on ${date}.`,
      entity_id: attendanceId,
      data: { student_id: studentId, date, status: st },
    },
  });
};

