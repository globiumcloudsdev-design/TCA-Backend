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
 * Require a single permission  — e.g. hasPermission('fee.create')
 */
export const hasPermission = (requiredPermission) =>
  catchAsync(async (req, res, next) => {
    // Master Admin bypass
    if (req.user?.user_type === 'MASTER_ADMIN') return next();

    if (!req.user?.id) throw new AppError('Unauthorized', 401);

    const perms = await resolveUserPermissions(req);

    // Check for ALL permission or specific permission
    if (perms.includes('ALL') || perms.includes(requiredPermission)) {
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

    // Check for ALL permission
    if (perms.includes('ALL')) return next();

    // Check if user has ANY of the required permissions
    const hasAny = permissions.some((p) => perms.includes(p));
    
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

    // Check for ALL permission
    if (perms.includes('ALL')) return next();

    // Check if user has ALL of the required permissions
    const hasAll = permissions.every((p) => perms.includes(p));
    
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
  
  if (perms.includes('ALL')) return true;
  
  return perms.includes(requiredPermission);
};

export default { 
  hasPermission, 
  hasAnyPermission, 
  hasAllPermissions,
  getUserPermissions,
  checkPermission
};