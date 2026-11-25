/**
 * Audience resolution for the admin composer and the automatic events.
 *
 * Everything is scoped to ONE institute (and one branch for branch-restricted admins).
 * Data access goes through `deps` so the rules can be unit-tested without a database.
 */
import { Op } from 'sequelize';
import models from '../../models/postgres/index.js';
import { AppError } from '../../utils/lib/AppError.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const AUDIENCE_TYPES = ['all', 'branch', 'class', 'section', 'role', 'users'];
export const AUDIENCE_ROLES = ['TEACHER', 'PARENT', 'STUDENT', 'STAFF'];
export const MAX_USER_IDS = 500;

const uuid = (v, label) => {
  if (!v || !UUID_RE.test(String(v))) throw new AppError(`${label} must be a valid id`, 400);
  return String(v);
};

/**
 * Validate + normalise the `audience` object (pure).
 * @param {object} audience
 * @param {{ restrictedBranchId?: string|null }} scope  branch-restricted admins are forced into their branch
 */
export const parseAudience = (audience, scope = {}) => {
  if (!audience || typeof audience !== 'object' || Array.isArray(audience)) throw new AppError('audience is required', 400);
  const type = String(audience.type || '').toLowerCase();
  if (!AUDIENCE_TYPES.includes(type)) throw new AppError(`audience.type must be one of: ${AUDIENCE_TYPES.join(', ')}`, 400);

  let roles = null;
  if (audience.roles !== undefined && audience.roles !== null) {
    if (!Array.isArray(audience.roles) || !audience.roles.length) throw new AppError('audience.roles must be a non-empty array', 400);
    roles = [...new Set(audience.roles.map((r) => String(r).toUpperCase()))];
    const bad = roles.filter((r) => !AUDIENCE_ROLES.includes(r));
    if (bad.length) throw new AppError(`audience.roles can only contain: ${AUDIENCE_ROLES.join(', ')}`, 400);
  }

  const out = { type, roles, branch_id: null, class_id: null, section_id: null, user_ids: [] };
  if (scope.restrictedBranchId) out.branch_id = scope.restrictedBranchId; // forced, whatever the client sent
  else if (audience.branch_id) out.branch_id = uuid(audience.branch_id, 'audience.branch_id');

  switch (type) {
    case 'all':
      out.roles = roles || ['TEACHER', 'PARENT', 'STUDENT', 'STAFF'];
      break;
    case 'branch':
      if (!out.branch_id) throw new AppError('audience.branch_id is required for a branch audience', 400);
      out.roles = roles || ['TEACHER', 'PARENT', 'STUDENT', 'STAFF'];
      break;
    case 'class':
    case 'section':
      out.class_id = uuid(audience.class_id, 'audience.class_id');
      if (type === 'section') out.section_id = uuid(audience.section_id, 'audience.section_id');
      out.roles = roles || ['STUDENT', 'PARENT'];
      if (out.roles.some((r) => r !== 'STUDENT' && r !== 'PARENT')) {
        throw new AppError('A class/section audience can only target STUDENT and PARENT', 400);
      }
      break;
    case 'role':
      if (!roles) throw new AppError('audience.roles is required for a role audience', 400);
      out.roles = roles;
      break;
    case 'users': {
      const ids = Array.isArray(audience.user_ids) ? [...new Set(audience.user_ids.map(String))] : [];
      if (!ids.length) throw new AppError('audience.user_ids is required for a users audience', 400);
      if (ids.length > MAX_USER_IDS) throw new AppError(`audience.user_ids can have at most ${MAX_USER_IDS} ids`, 400);
      ids.forEach((id) => uuid(id, 'audience.user_ids[]'));
      out.user_ids = ids;
      break;
    }
    default:
  }
  return out;
};

// ── default (database) data access ───────────────────────────────────────────
const { User, Class, Section, sequelize } = models;

export const defaultDeps = {
  /** active users of given user types in the institute (optionally one branch) */
  listUsers: async ({ instituteId, roles, branchId }) =>
    (await User.findAll({
      where: { school_id: instituteId, is_active: true, user_type: { [Op.in]: roles }, ...(branchId ? { branch_id: branchId } : {}) },
      attributes: ['id', 'user_type'],
    })).map((u) => ({ id: u.id, user_type: u.user_type })),

  listUsersByIds: async ({ instituteId, ids, branchId }) =>
    (await User.findAll({
      where: { school_id: instituteId, is_active: true, id: { [Op.in]: ids }, ...(branchId ? { branch_id: branchId } : {}) },
      attributes: ['id', 'user_type'],
    })).map((u) => ({ id: u.id, user_type: u.user_type })),

  /** active students of a class (+ section) */
  listStudents: async ({ instituteId, classId, sectionId, branchId }) =>
    (await User.findAll({
      where: {
        school_id: instituteId,
        user_type: 'STUDENT',
        is_active: true,
        'details.studentDetails.class_id': classId,
        ...(sectionId ? { 'details.studentDetails.section_id': sectionId } : {}),
        ...(branchId ? { branch_id: branchId } : {}),
      },
      attributes: ['id', 'user_type'],
    })).map((u) => ({ id: u.id, user_type: u.user_type })),

  /** active parents linked (details.parentDetails.student_ids) to any of the students */
  parentsOfStudents: async ({ instituteId, studentIds }) => {
    if (!studentIds.length) return [];
    const rows = await sequelize.query(
      `SELECT id FROM users
       WHERE school_id = :instituteId AND user_type = 'PARENT' AND is_active = true AND deleted_at IS NULL
         AND jsonb_exists_any(details->'parentDetails'->'student_ids', ARRAY[:studentIds]::text[])`,
      { replacements: { instituteId, studentIds }, type: sequelize.QueryTypes.SELECT }
    );
    return rows.map((r) => ({ id: r.id, user_type: 'PARENT' }));
  },

  classExists: async ({ instituteId, classId }) => Boolean(await Class.count({ where: { id: classId, school_id: instituteId } })),
  sectionExists: async ({ instituteId, classId, sectionId }) =>
    Boolean(await Section.count({ where: { id: sectionId, class_id: classId, school_id: instituteId } })),
};

/**
 * Resolve a parsed audience to recipients: [{ id, user_type }] (unique).
 * @throws AppError 404 when the class/section is not in this institute
 */
export const resolveAudience = async (instituteId, audience, deps = defaultDeps) => {
  const a = audience;
  const byId = new Map();
  const add = (list) => list.forEach((u) => byId.set(u.id, u));

  switch (a.type) {
    case 'all':
    case 'branch':
    case 'role':
      add(await deps.listUsers({ instituteId, roles: a.roles, branchId: a.type === 'role' ? a.branch_id : a.branch_id }));
      break;
    case 'users':
      add(await deps.listUsersByIds({ instituteId, ids: a.user_ids, branchId: a.branch_id }));
      break;
    case 'class':
    case 'section': {
      if (!(await deps.classExists({ instituteId, classId: a.class_id }))) throw new AppError('Class not found', 404);
      if (a.type === 'section' && !(await deps.sectionExists({ instituteId, classId: a.class_id, sectionId: a.section_id }))) {
        throw new AppError('Section not found in this class', 404);
      }
      const students = await deps.listStudents({ instituteId, classId: a.class_id, sectionId: a.section_id, branchId: a.branch_id });
      if (a.roles.includes('STUDENT')) add(students);
      if (a.roles.includes('PARENT')) add(await deps.parentsOfStudents({ instituteId, studentIds: students.map((s) => s.id) }));
      break;
    }
    default:
  }
  return [...byId.values()];
};

export const countByRole = (recipients) =>
  recipients.reduce((acc, r) => { acc[r.user_type] = (acc[r.user_type] || 0) + 1; return acc; }, {});

/** Students (given ids) + their parents, as plain user ids (used by automatic events) */
export const studentsAndParents = async (instituteId, studentIds, { includeStudents = true, includeParents = true } = {}, deps = defaultDeps) => {
  const ids = [...new Set((studentIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const out = new Set(includeStudents ? ids : []);
  if (includeParents) (await deps.parentsOfStudents({ instituteId, studentIds: ids })).forEach((p) => out.add(p.id));
  return [...out];
};

export default { parseAudience, resolveAudience, countByRole, studentsAndParents, AUDIENCE_TYPES, AUDIENCE_ROLES };
