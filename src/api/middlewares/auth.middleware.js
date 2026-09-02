// backend/src/middlewares/auth.middleware.js

/**
 * The Clouds Academy - Complete Auth Middleware
 * 
 * Features:
 * - JWT verification
 * - Role-based access control
 * - Institute context validation
 * - Permission checking
 * - Optional auth for public routes
 */

import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import User from '../../models/postgres/User.model.js';
import Institute from '../../models/postgres/Institute.model.js';
import Branch from '../../models/postgres/Branch.model.js'; // ✅ Import Branch
import { AppError } from '../../utils/lib/AppError.js';
import catchAsync from '../../utils/lib/catchAsync.js';
import { verifyAccessToken } from '../../config/auth.js';
import { branchIsolation, branchContext } from './branchContext.middleware.js';

// ─────────────────────────────────────────────────────────────────────────────
// CORE AUTHENTICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Protect routes - JWT verification
 * Attaches user and institute to request
 */
export const protect = catchAsync(async (req, res, next) => {
  // 1. Get token from multiple sources
  let token;
  
  // From Authorization header
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // From cookie
  else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }
  // From query param (for downloads/embeds)
  else if (req.query?.token) {
    token = req.query.token;
  }

  if (!token) {
    throw new AppError('No authentication token provided. Please login.', 401);
  }

  // 2. Verify token
  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token expired. Please login again.', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token. Please login again.', 401);
    }
    throw new AppError('Authentication failed. Please login again.', 401);
  }

  // 3. Check if user exists with full details
  const user = await User.findByPk(decoded.userId, {
    attributes: { exclude: ['password_hash', 'password_reset_token', 'password_reset_expires'] },
    include: [
      {
        model: Institute,
        as: 'institute',
        attributes: ['id', 'institute_name', 'institute_code', 'is_active', 'subscription_status', 'institute_logo_url', 'institute_address', 'institute_city', 'settings']
      }
    ]
  });

  if (!user) {
    throw new AppError('User account no longer exists.', 401);
  }

  // 4. Check if user is active
  if (!user.is_active) {
    throw new AppError('Your account has been deactivated. Please contact admin.', 401);
  }

  // 5. Load branch if user has branch_id
  if (user.branch_id) {
    const branch = await Branch.findByPk(user.branch_id, {
      attributes: ['id', 'name', 'code', 'address', 'city', 'is_active', 'settings']
    });
    if (branch) {
      user.branch = branch;
      req.branch = branch;
    }
  }

  // 6. Check institute status (if not MASTER_ADMIN)
  if (user.user_type !== 'MASTER_ADMIN' && user.school_id) {
    const institute = user.institute || await Institute.findByPk(user.school_id);
    
    if (!institute) {
      throw new AppError('Associated institute not found.', 401);
    }
    
    if (!institute.is_active) {
      throw new AppError('Institute is inactive. Please contact support.', 401);
    }
    
    if (institute.subscription_status === 'expired') {
      throw new AppError('Institute subscription has expired. Please renew.', 403);
    }

    // Attach institute to request
    req.institute = institute;
  }

  // 7. Attach user and token to request
  req.user = user;
  req.token = token;

  // 8. Enforce branch isolation & inject allowedBranchId
  branchIsolation(req, res, () => {});

  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// ROLE-BASED ACCESS CONTROL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restrict to specific user types
 * Usage: restrictTo('MASTER_ADMIN', 'INSTITUTE_ADMIN')
 */
export const restrictTo = (...allowedTypes) => {
  return catchAsync(async (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    if (!allowedTypes.includes(req.user.user_type)) {
      throw new AppError(
        `Access denied. Required role: ${allowedTypes.join(' or ')}. Your role: ${req.user.user_type}`,
        403
      );
    }

    next();
  });
};

/**
 * Check if user is Master Admin
 */
export const isMasterAdmin = catchAsync(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  if (!['MASTER_ADMIN', 'SYSTEM_ADMIN', 'SUPPORT_STAFF'].includes(req.user.user_type)) {
    throw new AppError('Platform Admin access required.', 403);
  }

  next();
});

/**
 * Check if user is Institute Admin
 */
export const isInstituteAdmin = catchAsync(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  if (req.user.user_type !== 'INSTITUTE_ADMIN') {
    throw new AppError('Institute Admin access required.', 403);
  }

  next();
});

/**
 * Check if user is Branch Admin
 */
export const isBranchAdmin = catchAsync(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  if (req.user.user_type !== 'BRANCH_ADMIN') {
    throw new AppError('Branch Admin access required.', 403);
  }

  next();
});

/**
 * Check if user is Teacher
 */
export const isTeacher = catchAsync(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  if (req.user.user_type !== 'TEACHER') {
    throw new AppError('Teacher access required.', 403);
  }

  next();
});

/**
 * Check if user is Student
 */
export const isStudent = catchAsync(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  if (req.user.user_type !== 'STUDENT') {
    throw new AppError('Student access required.', 403);
  }

  next();
});

/**
 * Check if user is Parent
 */
export const isParent = catchAsync(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  if (req.user.user_type !== 'PARENT') {
    throw new AppError('Parent access required.', 403);
  }

  next();
});

/**
 * Check if user is Staff
 */
export const isStaff = catchAsync(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  if (req.user.user_type !== 'STAFF') {
    throw new AppError('Staff access required.', 403);
  }

  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// INSTITUTE CONTEXT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensure user belongs to the institute in request params
 * For routes like /institutes/:instituteId/students
 */
export const belongsToInstitute = catchAsync(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  // Master Admin can access any institute
  if (req.user.user_type === 'MASTER_ADMIN') {
    return next();
  }

  const targetInstituteId = req.params.instituteId || req.params.schoolId || req.body.institute_id;
  
  if (!targetInstituteId) {
    return next(); // No institute specified, continue
  }

  if (req.user.school_id !== targetInstituteId) {
    throw new AppError('You do not have access to this institute.', 403);
  }

  next();
});

/**
 * Ensure user belongs to the branch in request params
 */
export const belongsToBranch = catchAsync(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  // Master Admin can access any branch
  if (req.user.user_type === 'MASTER_ADMIN') {
    return next();
  }

  const targetBranchId = req.params.branchId || req.body.branch_id;
  
  if (!targetBranchId) {
    return next();
  }

  if (req.user.branch_id && req.user.branch_id !== targetBranchId) {
    throw new AppError('You do not have access to this branch.', 403);
  }

  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCE OWNERSHIP VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if user owns the resource (for student/parent self-access)
 */
export const isResourceOwner = (resourceParam = 'id') => {
  return catchAsync(async (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const resourceId = req.params[resourceParam];
    
    if (!resourceId) {
      return next();
    }

    // If user is accessing their own resource
    if (req.user.id === resourceId) {
      return next();
    }

    // Students can access their own data only
    if (req.user.user_type === 'STUDENT' && req.user.id !== resourceId) {
      throw new AppError('You can only access your own data.', 403);
    }

    // Parents can access their children's data
    if (req.user.user_type === 'PARENT') {
      // Check if resourceId is one of their children
      const isChild = await User.findOne({
        where: {
          id: resourceId,
          user_type: 'STUDENT',
          'details.parent_id': req.user.id
        }
      });
      
      if (isChild) {
        return next();
      }
    }

    next(); // For other cases, let permission middleware handle
  });
};

/**
 * Optional authentication - doesn't fail if no token
 * User will be attached if token valid, otherwise req.user = null
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password_hash'] }
    });

    req.user = user || null;
    if (req.user) {
      branchIsolation(req, res, () => {});
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// JWT REFRESH TOKEN VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify refresh token specifically
 */
export const verifyRefreshToken = catchAsync(async (req, res, next) => {
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new AppError('Refresh token required.', 401);
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      throw new AppError('User not found.', 401);
    }

    req.user = user;
    req.refreshToken = refreshToken;
    next();
  } catch (error) {
    throw new AppError('Invalid or expired refresh token.', 401);
  }
});

// Export branch context middlewares
export { branchIsolation, branchContext };

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export default {
  protect,
  branchIsolation,
  branchContext,
  restrictTo,
  isMasterAdmin,
  isInstituteAdmin,
  isBranchAdmin,
  isTeacher,
  isStudent,
  isParent,
  isStaff,
  belongsToInstitute,
  belongsToBranch,
  isResourceOwner,
  optionalAuth,
  verifyRefreshToken
};