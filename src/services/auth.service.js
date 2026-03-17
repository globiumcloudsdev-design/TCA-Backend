// backend/src/services/auth.service.js

/**
 * The Clouds Academy - Auth Service
 * Handles login, register, token refresh, password reset
 *
 * Login supports:
 *   - Email address  → all user types
 *   - registration_no (no '@') → STUDENT / any registered by number
 *
 * Permissions are resolved from role.permissions[userTypeKey] JSONB.
 */

import crypto from 'crypto';
import User from '../models/postgres/User.model.js';
import Role from '../models/postgres/Role.model.js';
import Institute from '../models/postgres/Institute.model.js';
import InstituteType from '../models/postgres/InstituteType.model.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../config/auth.js';
import { AppError } from '../utils/lib/AppError.js';
import { hashPassword, comparePassword } from '../utils/helpers/password.helper.js';
import logger from '../config/logger.js';

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
 * Login — returns accessToken, refreshToken, user profile + permissions
 * @param {string} loginId  email address OR registration_no
 * @param {string} password plain-text password
 */
export const loginService = async (loginId, password) => {
  // ------------------------------------------------------------------
  // 1. Find user by email or registration_no
  // Use unscoped() to bypass defaultScope's password_hash exclusion
  // ------------------------------------------------------------------
  let user;
  if (loginId.includes('@')) {
    user = await User.unscoped().findOne({ where: { email: loginId } });
  } else {
    user = await User.unscoped().findOne({ where: { registration_no: loginId } });
  }

  if (!user) throw new AppError('Invalid credentials.', 401);
  if (!user.is_active) throw new AppError('Account is deactivated. Contact your administrator.', 403);

  // ------------------------------------------------------------------
  // 2. Verify password
  // ------------------------------------------------------------------
  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) throw new AppError('Invalid credentials.', 401);

  // ------------------------------------------------------------------
  // 3. Record last login
  // ------------------------------------------------------------------
  await user.update({ last_login_at: new Date() });

  // ------------------------------------------------------------------
  // 4. Resolve permissions from role JSONB or direct permissions
  // ------------------------------------------------------------------
  let roleData = null;
  let permissions = [];

  // 🔥 FIX: If user has direct permissions (branch_admin/staff with custom perms)
  if (user.permissions && user.permissions.length > 0) {
    permissions = user.permissions;
  }
  // Otherwise get from role
  else if (user.role_id) {
    const role = await Role.findByPk(user.role_id);
    if (role) {
      roleData = { id: role.id, name: role.name, code: role.code };
      
      // Get the correct permission key based on user_type
      const typeKey = USER_TYPE_TO_KEY[user.user_type] ?? 'instituteAdmin';
      const perms = role.permissions?.[typeKey] ?? [];
      
      // Expand 'ALL' flag into explicit list; keep as-is otherwise
      permissions = perms.includes('ALL') ? ['ALL'] : perms;
    }
  }

  // ------------------------------------------------------------------
  // 5. Load institute with its type (for non-master users)
  // ------------------------------------------------------------------
  let instituteData = null;
  if (user.school_id) {
    const inst = await Institute.findByPk(user.school_id, {
      include: [{ model: InstituteType, as: 'type', attributes: ['id', 'name', 'slug', 'icon'] }],
      attributes: ['id', 'institute_name', 'institute_code', 'institute_email',
                   'institute_contact', 'institute_type_id', 'is_active',
                   'subscription_status', 'settings'],
    });
    if (inst) {
      instituteData = {
        id:               inst.id,
        name:             inst.institute_name,
        code:             inst.institute_code,
        email:            inst.institute_email,
        phone:            inst.institute_contact,
        institute_type:   inst.type?.slug   ?? null,
        institute_type_name: inst.type?.name ?? null,
        institute_type_icon: inst.type?.icon ?? null,
        is_active:        inst.is_active,
        subscription_status: inst.subscription_status,
        settings:         inst.settings,
      };
    }
  }

  // ------------------------------------------------------------------
  // 6. Sign tokens
  // ------------------------------------------------------------------
  const tokenPayload = {
    userId:   user.id,
    schoolId: user.school_id,
    userType: user.user_type,
  };

  const accessToken  = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ userId: user.id });

  logger.info(`🔐 Login: ${user.email || user.registration_no} [${user.user_type}]`);

  return {
    accessToken,
    refreshToken,
    user: {
      id:             user.id,
      first_name:     user.first_name,
      last_name:      user.last_name,
      email:          user.email,
      registration_no: user.registration_no,
      user_type:      user.user_type,
      staff_type:     user.staff_type,           // ✅ Important for branch heads
      school_id:      user.school_id,
      branch_id:      user.branch_id,             // ✅ Important for branch users
      role:           roleData,
      permissions,                                 // ✅ Now properly populated
      avatar_url:     user.avatar_url,
      institute:      instituteData,
    },
  };
};

/**
 * Refresh access token using refresh token
 */
export const refreshTokenService = async (refreshToken) => {
  if (!refreshToken) throw new AppError('Refresh token required.', 401);

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401);
  }

  const user = await User.findByPk(decoded.userId);
  if (!user || !user.is_active) throw new AppError('User not found.', 401);

  const accessToken = signAccessToken({
    userId:   user.id,
    schoolId: user.school_id,
    userType: user.user_type,
  });

  return { accessToken };
};

/**
 * Generate password reset token and return it (caller sends the email)
 */
export const forgotPasswordService = async (email) => {
  const user = await User.findOne({ where: { email } });
  if (!user) return; // Silent — don't reveal if email exists

  const token   = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  await user.update({
    password_reset_token:   token,
    password_reset_expires: expires,
  });

  return { token, user };
};

/**
 * Reset password with a valid reset token
 */
export const resetPasswordService = async (token, newPassword) => {
  const user = await User.scope('withPassword').findOne({
    where: { password_reset_token: token },
  });

  if (!user || new Date() > user.password_reset_expires) {
    throw new AppError('Invalid or expired reset token.', 400);
  }

  const passwordHash = await hashPassword(newPassword);
  await user.update({
    password_hash:          passwordHash,
    email_verified:        true, // Mark email as verified on successful reset
    password_reset_token:   null,
    password_reset_expires: null,
  });

  return user;
};

export default { loginService, refreshTokenService, forgotPasswordService, resetPasswordService };