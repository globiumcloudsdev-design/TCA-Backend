/**
 * The Clouds Academy - Role Service
 *
 * Roles use a JSONB `permissions` field keyed by userType:
 *   { instituteAdmin: [...], teacher: [...], student: [...], parent: [...] }
 *
 * No separate Permission / RolePermission / UserRole tables.
 * Role assignment is a direct FK: user.role_id → roles.id
 */

import Role from '../models/postgres/Role.model.js';
import User from '../models/postgres/User.model.js';
import { AppError } from '../utils/lib/AppError.js';
import APIFeatures from '../utils/lib/apiFeatures.js';

// ─── Create school-level custom role ─────────────────────────────────────────
export const createRole = async (schoolId, { name, code, description, permissions = {} }, createdBy) => {
  const safeCode = code.toUpperCase();

  const existing = await Role.findOne({ where: { school_id: schoolId, code: safeCode } });
  if (existing) throw new AppError(`Role code '${safeCode}' already exists in this school.`, 409);

  const role = await Role.create({
    school_id:   schoolId,
    name,
    code:        safeCode,
    description,
    permissions, // JSONB: { instituteAdmin: [...], teacher: [...], ... }
    is_template: false,
    created_by:  createdBy,
  });

  return role;
};

// ─── List roles for a school ──────────────────────────────────────────────────
export const getSchoolRoles = async (schoolId, query = {}) => {
  const features = new APIFeatures({ school_id: schoolId }, query)
    .filter()
    .sort()
    .paginate();

  const opts = features.build();
  const { count, rows } = await Role.findAndCountAll({ ...opts });

  return { roles: rows, pagination: features.getPaginationMeta(count) };
};

// ─── Get role by ID ───────────────────────────────────────────────────────────
export const getRoleById = async (roleId) => {
  const role = await Role.findByPk(roleId);
  if (!role) throw new AppError('Role not found.', 404);
  return role;
};

// ─── Update role ──────────────────────────────────────────────────────────────
export const updateRole = async (roleId, { name, description, permissions }) => {
  const role = await Role.findByPk(roleId);
  if (!role) throw new AppError('Role not found.', 404);
  if (role.is_template) throw new AppError('Platform template roles cannot be edited here.', 400);

  const updates = {};
  if (name        !== undefined) updates.name        = name;
  if (description !== undefined) updates.description = description;
  if (permissions !== undefined) updates.permissions = permissions;

  await role.update(updates);
  return role.reload();
};

// ─── Delete role ──────────────────────────────────────────────────────────────
export const deleteRole = async (roleId) => {
  const role = await Role.findByPk(roleId);
  if (!role) throw new AppError('Role not found.', 404);
  if (role.is_template) throw new AppError('Platform template roles cannot be deleted.', 400);

  // Prevent deletion if users are still assigned
  const usersCount = await User.count({ where: { role_id: roleId, is_active: true } });
  if (usersCount > 0) {
    throw new AppError(`Cannot delete role. ${usersCount} active user(s) are assigned this role.`, 400);
  }

  await role.destroy();
  return { message: 'Role deleted successfully.' };
};

// ─── Assign role to user (sets user.role_id) ─────────────────────────────────
export const assignRoleToUser = async (userId, roleId, assignedBy) => {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('User not found.', 404);

  if (roleId) {
    const role = await Role.findByPk(roleId);
    if (!role) throw new AppError('Role not found.', 404);
  }

  await user.update({ role_id: roleId || null, updated_by: assignedBy });
  return user.reload();
};

export default { createRole, getSchoolRoles, getRoleById, updateRole, deleteRole, assignRoleToUser };

