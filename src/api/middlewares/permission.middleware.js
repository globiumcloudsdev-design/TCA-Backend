/**
 * The Clouds Academy - Dynamic Permission Middleware
 *
 * Resolves permissions from:
 *   1. Direct user.permissions (for custom permissions like branch admins/staff)
 *   2. role.permissions[userTypeKey] JSONB (for role-based users)
 *
 * Master Admin bypasses all checks.
 * Special value 'ALL' in the permissions array grants unrestricted access.
 */

import { AppError } from '../../utils/lib/AppError.js';
import catchAsync from '../../utils/lib/catchAsync.js';
import Role from '../../models/postgres/Role.model.js';

// Maps user_type ENUM → permissions JSONB key in role
const USER_TYPE_TO_KEY = {
  MASTER_ADMIN:    'master',
  INSTITUTE_ADMIN: 'instituteAdmin',
  BRANCH_ADMIN:    'branchAdmin',      // ✅ Added for branch admins
  TEACHER:         'teacher',
  STUDENT:         'student',
  PARENT:          'parent',
  STAFF:           'staff',            // ✅ Added for staff members
};

/**
 * Loads the permission array for the current user.
 * First checks direct user.permissions (for custom permissions)
 * Then falls back to role-based permissions.
 * Caches on req.userPermissions to avoid a second DB hit in the same request.
 */
const resolveUserPermissions = async (req) => {
  // Return cached permissions if available
  if (req.userPermissions) return req.userPermissions;

  const user = req.user;
  if (!user) return [];

  // 🔥 FIX 1: First check direct permissions from user object
  // This is important for branch admins, staff with custom permissions
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
    req.userPermissions = user.permissions;
    return user.permissions;
  }

  // 🔥 FIX 2: If no direct permissions, try role-based permissions
  const roleId = user.role_id;
  if (!roleId) return [];

  const role = await Role.findByPk(roleId);
  if (!role || !role.is_active) return [];

  // Get the correct permission key based on user_type
  const typeKey = USER_TYPE_TO_KEY[user.user_type] ?? 'instituteAdmin';
  const perms = role.permissions?.[typeKey] ?? [];
  
  req.userPermissions = perms;
  return perms;
};

/**
 * Generate semantic variants for a permission check
 * Handles singular/plural module names (fee/fees, student/students),
 * action aliases (read/view, mark/create), and report inversions (reports.student <-> student.report).
 */
const getPermissionVariants = (perm) => {
  if (!perm || typeof perm !== 'string') return [];
  const variants = new Set([perm]);
  const parts = perm.split('.');
  if (parts.length === 2) {
    const [mod, action] = parts;
    const altMod = mod.endsWith('s') ? mod.slice(0, -1) : `${mod}s`;
    variants.add(`${altMod}.${action}`);

    // Action aliases
    const actionAliases = {
      read: ['view', 'read'],
      view: ['read', 'view'],
      mark: ['create', 'mark'],
      enter: ['create', 'enter'],
      list: ['read', 'view', 'list'],
      delete: ['delete', 'remove', 'destroy', 'bulk_actions'],
    };

    const actionsToCheck = [action, ...(actionAliases[action] || [])];
    const modsToCheck = [mod, altMod];

    for (const m of modsToCheck) {
      for (const a of actionsToCheck) {
        variants.add(`${m}.${a}`);
      }
      variants.add(`${m}.*`);
      variants.add(`${m}.ALL`);
      variants.add(`${m}.manage`);
    }

    // Report inverses
    if (mod === 'reports' || mod === 'report') {
      variants.add(`${action}.report`);
      variants.add(`${action}.reports`);
      const altAction = action.endsWith('s') ? action.slice(0, -1) : `${action}s`;
      variants.add(`${altAction}.report`);
      variants.add(`${altAction}.reports`);
    } else if (action === 'report' || action === 'reports') {
      variants.add(`reports.${mod}`);
      variants.add(`reports.${altMod}`);
    }
  }
  return Array.from(variants);
};

const hasMatchingPermission = (userPerms, requiredPermission) => {
  if (!Array.isArray(userPerms)) return false;
  if (userPerms.includes('ALL') || userPerms.includes('*')) return true;
  if (userPerms.includes(requiredPermission)) return true;
  const variants = getPermissionVariants(requiredPermission);
  return variants.some((v) => userPerms.includes(v));
};

/**
 * Require a single permission  — e.g. hasPermission('fee.create')
 */
export const hasPermission = (requiredPermission) =>
  catchAsync(async (req, res, next) => {
    // Master Admin bypass
    if (req.user?.user_type === 'MASTER_ADMIN') return next();

    if (!req.user?.id) throw new AppError('Unauthorized', 401);

    const perms = await resolveUserPermissions(req);

    // Check for ALL permission or specific / variant permission
    if (hasMatchingPermission(perms, requiredPermission)) {
      return next();
    }

    throw new AppError(`Access denied. Required permission: ${requiredPermission}`, 403);
  });

/**
 * Require ANY of the given permissions (OR logic)
 */
export const hasAnyPermission = (permissions = []) =>
  catchAsync(async (req, res, next) => {
    // Master Admin bypass
    if (req.user?.user_type === 'MASTER_ADMIN') return next();

    if (!req.user?.id) throw new AppError('Unauthorized', 401);

    const perms = await resolveUserPermissions(req);

    // Check for ALL permission or any matching permission
    const hasAny = permissions.some((p) => hasMatchingPermission(perms, p));
    
    if (hasAny) return next();

    throw new AppError('Access denied. You need at least one of the required permissions.', 403);
  });

/**
 * Require ALL of the given permissions (AND logic)
 */
export const hasAllPermissions = (permissions = []) =>
  catchAsync(async (req, res, next) => {
    // Master Admin bypass
    if (req.user?.user_type === 'MASTER_ADMIN') return next();

    if (!req.user?.id) throw new AppError('Unauthorized', 401);

    const perms = await resolveUserPermissions(req);

    // Check if user has ALL of the required permissions
    const hasAll = permissions.every((p) => hasMatchingPermission(perms, p));
    
    if (hasAll) return next();

    throw new AppError('Access denied. You need all of the required permissions.', 403);
  });

/**
 * 🔥 NEW: Get current user's permissions (useful for sending to frontend)
 */
export const getUserPermissions = catchAsync(async (req, res, next) => {
  const perms = await resolveUserPermissions(req);
  
  res.json({
    success: true,
    data: {
      permissions: perms,
      user_type: req.user?.user_type,
      has_all: perms.includes('ALL')
    }
  });
});

/**
 * 🔥 NEW: Check if user has a specific permission without throwing error
 * Useful for conditional logic in controllers
 */
export const checkPermission = async (req, requiredPermission) => {
  if (req.user?.user_type === 'MASTER_ADMIN') return true;
  
  const perms = await resolveUserPermissions(req);
  return hasMatchingPermission(perms, requiredPermission);
};

export default { 
  hasPermission, 
  hasAnyPermission, 
  hasAllPermissions,
  getUserPermissions,
  checkPermission
};