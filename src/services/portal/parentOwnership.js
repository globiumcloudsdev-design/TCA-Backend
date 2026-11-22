/**
 * Parent -> child ownership check shared by EVERY parent-facing endpoint
 * (portal + leave requests). A parent may only touch children listed in
 * their own details.parentDetails.student_ids and belonging to their school.
 */
import models from '../../models/postgres/index.js';
import { AppError } from '../../utils/lib/AppError.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getParentChildIds = (parent) => {
  const ids =
    parent?.details?.parentDetails?.student_ids ||
    parent?.details?.student_ids ||
    parent?.details?.children_ids ||
    [];
  return Array.isArray(ids) ? ids : [];
};

/**
 * @returns the child's User row (id only)
 * @throws AppError 403 when the child is not linked to this parent,
 *         404 when the child does not exist in the parent's school
 */
export const assertParentOwnsChild = async (parentId, childId, instituteId) => {
  if (!childId || !UUID_RE.test(String(childId))) {
    throw new AppError('Child not found', 404);
  }
  const { User } = models;
  const parent = await User.findOne({
    where: { id: parentId, ...(instituteId ? { school_id: instituteId } : {}) },
    attributes: ['id', 'details'],
  });
  if (!parent) throw new AppError('Parent not found', 404);

  if (!getParentChildIds(parent).includes(childId)) {
    throw new AppError("You are not authorized to view this child's data", 403);
  }

  const child = await User.findOne({
    where: { id: childId, user_type: 'STUDENT', ...(instituteId ? { school_id: instituteId } : {}) },
    attributes: ['id'],
  });
  if (!child) throw new AppError('Child not found', 404);
  return child;
};

export default { assertParentOwnsChild, getParentChildIds };
