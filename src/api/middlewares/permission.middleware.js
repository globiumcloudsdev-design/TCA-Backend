/**
 * The Clouds Academy - Dynamic Permission Middleware
 *
 * Resolves permissions from role.permissions[userTypeKey] JSONB.
 * Master Admin bypasses all checks.
 * Special value 'ALL' in the permissions array grants unrestricted access.
 */

import { AppError } from '../../utils/lib/AppError.js';
import catchAsync from '../../utils/lib/catchAsync.js';
import Role from '../../models/postgres/Role.model.js';

// Maps user_type ENUM → permissions JSONB key
const USER_TYPE_TO_KEY = {
  MASTER_ADMIN:    'master',
  INSTITUTE_ADMIN: 'instituteAdmin',
  TEACHER:         'teacher',
  STUDENT:         'student',
  PARENT:          'parent',
  STAFF:           'instituteAdmin',
};

/**
 * Loads the permission array for the current user from their role's JSONB.
 * Caches on req.userPermissions to avoid a second DB hit in the same request.
 */
const resolveUserPermissions = async (req) => {
  if (req.userPermissions) return req.userPermissions;

  const roleId = req.user?.role_id;
  if (!roleId) return [];

  const role = await Role.findByPk(roleId);
  if (!role || !role.is_active) return [];

  const typeKey = USER_TYPE_TO_KEY[req.user.user_type] ?? 'instituteAdmin';
  const perms = role.permissions?.[typeKey] ?? [];
  req.userPermissions = perms;
  return perms;
};

/**
 * Require a single permission  — e.g. hasPermission('fee.create')
 */
export const hasPermission = (requiredPermission) =>
  catchAsync(async (req, res, next) => {
    if (req.user?.user_type === 'MASTER_ADMIN') return next();

    if (!req.user?.id) throw new AppError('Unauthorized', 401);

    const perms = await resolveUserPermissions(req);

    if (perms.includes('ALL') || perms.includes(requiredPermission)) {
      return next();
    }

    throw new AppError(`Access denied. Required permission: ${requiredPermission}`, 403);
  });

/**
 * Require ANY of the given permissions (OR logic)
 */
export const hasAnyPermission = (permissions) =>
  catchAsync(async (req, res, next) => {
    if (req.user?.user_type === 'MASTER_ADMIN') return next();

    if (!req.user?.id) throw new AppError('Unauthorized', 401);

    const perms = await resolveUserPermissions(req);

    if (perms.includes('ALL') || permissions.some((p) => perms.includes(p))) {
      return next();
    }

    throw new AppError('Access denied.', 403);
  });

/**
 * Require ALL of the given permissions (AND logic)
 */
export const hasAllPermissions = (permissions) =>
  catchAsync(async (req, res, next) => {
    if (req.user?.user_type === 'MASTER_ADMIN') return next();

    if (!req.user?.id) throw new AppError('Unauthorized', 401);

    const perms = await resolveUserPermissions(req);

    if (perms.includes('ALL') || permissions.every((p) => perms.includes(p))) {
      return next();
    }

    throw new AppError('Access denied.', 403);
  });

export default { hasPermission, hasAnyPermission, hasAllPermissions };
