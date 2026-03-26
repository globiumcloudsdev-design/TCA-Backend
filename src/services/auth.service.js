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
import Branch from '../models/postgres/Branch.model.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../config/auth.js';
import { AppError } from '../utils/lib/AppError.js';
import { hashPassword, comparePassword } from '../utils/helpers/password.helper.js';
import logger from '../config/logger.js';

// Maps user_type ENUM → permissions JSONB key in role
const USER_TYPE_TO_KEY = {
  MASTER_ADMIN:    'master',
  INSTITUTE_ADMIN: 'instituteAdmin',
  BRANCH_ADMIN:    'branchAdmin',
  TEACHER:         'teacher',
  STUDENT:         'student',
  PARENT:          'parent',
  STAFF:           'staff',
};

/**
 * Helper function to normalize settings (parse if string)
 */
const normalizeSettings = (settings) => {
  if (!settings) {
    return {
      has_branches: false,
      enable_parent_portal: true,
      enable_teacher_portal: true,
      enable_student_portal: true,
      enable_sms_notifications: false
    };
  }
  
  // If settings is a string, parse it
  if (typeof settings === 'string') {
    try {
      const parsed = JSON.parse(settings);
      logger.debug('Parsed settings from string:', parsed);
      return parsed;
    } catch (e) {
      logger.error('Error parsing settings JSON:', e);
      return {
        has_branches: false,
        enable_parent_portal: true,
        enable_teacher_portal: true,
        enable_student_portal: true,
        enable_sms_notifications: false
      };
    }
  }
  
  // Already an object, return as is
  return settings;
};

/**
 * Login — returns accessToken, refreshToken, user profile + permissions
 * @param {string} loginId  email address OR registration_no
 * @param {string} password plain-text password
 */
/**
 * Login — Returns ALL accounts with this email/registration_no
 * Frontend will show selection modal if multiple accounts
 */
export const loginService = async (loginId, password) => {
  // 1. Find ALL users with this email OR registration_no
  let users;
  if (loginId.includes('@')) {
    users = await User.unscoped().findAll({ 
      where: { email: loginId },
      include: [
        { model: Role, as: 'Role' },
        { model: Institute, as: 'institute', include: [{ model: InstituteType, as: 'type' }] },
        { model: Branch, as: 'branch' }
      ]
    });
  } else {
    users = await User.unscoped().findAll({ 
      where: { registration_no: loginId },
      include: [
        { model: Role, as: 'Role' },
        { model: Institute, as: 'institute', include: [{ model: InstituteType, as: 'type' }] },
        { model: Branch, as: 'branch' }
      ]
    });
  }

  if (!users || users.length === 0) {
    throw new AppError('No account found with these credentials.', 401);
  }

  // 2. Verify password for each account
  const validAccounts = [];
  
  for (const user of users) {
    if (!user.is_active) continue;
    
    const isMatch = await comparePassword(password, user.password_hash);
    if (isMatch) {
      // Get permissions for this account
      let permissions = [];
      if (user.permissions && user.permissions.length > 0) {
        permissions = user.permissions;
      } else if (user.role_id) {
        const role = await Role.findByPk(user.role_id);
        if (role) {
          const typeKey = USER_TYPE_TO_KEY[user.user_type] ?? 'instituteAdmin';
          const perms = role.permissions?.[typeKey] ?? [];
          permissions = perms.includes('ALL') ? ['ALL'] : perms;
        }
      }
      
      // Get institute data
      let instituteData = null;
      if (user.institute) {
        instituteData = {
          id: user.institute.id,
          name: user.institute.institute_name,
          code: user.institute.institute_code,
          logo_url: user.institute.institute_logo_url,
          institute_type: user.institute.type?.slug || null,
          settings: normalizeSettings(user.institute.settings)
        };
      }
      
      validAccounts.push({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        registration_no: user.registration_no,
        user_type: user.user_type,
        staff_type: user.staff_type,
        school_id: user.school_id,
        branch_id: user.branch_id,
        avatar_url: user.avatar_url,
        permissions: permissions,
        institute: instituteData,
        role: user.Role ? {
          id: user.Role.id,
          name: user.Role.name,
          code: user.Role.code
        } : null,
        // Display info for selection UI
        display_name: `${user.first_name} ${user.last_name}`,
        display_role: getUserTypeDisplay(user.user_type, user.staff_type),
        display_icon: getUserTypeIcon(user.user_type),
        is_active: user.is_active,
        last_login_at: user.last_login_at
      });
    }
  }

  if (validAccounts.length === 0) {
    throw new AppError('Invalid credentials.', 401);
  }

  // 3. If ONLY ONE account, login directly
  if (validAccounts.length === 1) {
    const user = users.find(u => u.id === validAccounts[0].id);
    await user.update({ last_login_at: new Date() });
    
    const tokenPayload = {
      userId: user.id,
      schoolId: user.school_id,
      userType: user.user_type,
      branchId: user.branch_id,
    };
    
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken({ userId: user.id });
    
    // Get full user profile
    const userProfile = await getUserProfile(user.id);
    
    return {
      accessToken,
      refreshToken,
      user: userProfile,
      accounts: validAccounts,
      hasMultipleAccounts: false
    };
  }
  
  // 4. If MULTIPLE accounts, return accounts list for selection
  logger.info(`🔐 Multiple accounts found for ${loginId}: ${validAccounts.map(a => `${a.user_type} (${a.id})`).join(', ')}`);
  
  return {
    accounts: validAccounts,
    hasMultipleAccounts: true,
    message: 'Multiple accounts found. Please select which account to use.'
  };
};

/**
 * Select specific account after login
 */
export const selectAccountService = async (accountId, email, registrationNo) => {
  // Find the selected account
  const user = await User.unscoped().findByPk(accountId, {
    include: [
      { model: Role, as: 'Role' },
      { model: Institute, as: 'institute', include: [{ model: InstituteType, as: 'type' }] },
      { model: Branch, as: 'branch' }
    ]
  });
  
  if (!user) {
    throw new AppError('Account not found.', 404);
  }
  
  // Verify this email/reg_no matches the selected account
  let isValid = false;
  if (email && user.email === email) isValid = true;
  if (registrationNo && user.registration_no === registrationNo) isValid = true;
  
  // Also check if any other account with same email exists (for security)
  if (!isValid) {
    const otherAccounts = await User.findAll({
      where: {
        [Op.or]: [
          { email: email },
          { registration_no: registrationNo }
        ]
      }
    });
    
    const isLinked = otherAccounts.some(acc => acc.id === user.id);
    if (!isLinked) {
      throw new AppError('Account not linked to this email/registration number.', 403);
    }
  }
  
  if (!user.is_active) {
    throw new AppError('Account is deactivated. Contact administrator.', 403);
  }
  
  // Update last login
  await user.update({ last_login_at: new Date() });
  
  // Generate tokens for selected account
  const tokenPayload = {
    userId: user.id,
    schoolId: user.school_id,
    userType: user.user_type,
    branchId: user.branch_id,
  };
  
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ userId: user.id });
  
  const userProfile = await getUserProfile(user.id);
  
  return {
    accessToken,
    refreshToken,
    user: userProfile
  };
};

/**
 * Helper: Get user permissions
 */
const getUserPermissions = async (user) => {
  let permissions = [];
  
  if (user.permissions && user.permissions.length > 0) {
    permissions = user.permissions;
  } else if (user.role_id) {
    const role = await Role.findByPk(user.role_id);
    if (role) {
      const typeKey = USER_TYPE_TO_KEY[user.user_type] ?? 'instituteAdmin';
      const perms = role.permissions?.[typeKey] ?? [];
      permissions = perms.includes('ALL') ? ['ALL'] : perms;
    }
  }
  
  return permissions;
};

/**
 * Helper: Get user display name for role
 */
const getUserTypeDisplay = (userType, staffType = null) => {
  const typeMap = {
    MASTER_ADMIN: 'Master Admin',
    INSTITUTE_ADMIN: 'Institute Admin',
    BRANCH_ADMIN: 'Branch Admin',
    TEACHER: 'Teacher',
    STUDENT: 'Student',
    PARENT: 'Parent',
    STAFF: staffType || 'Staff'
  };
  return typeMap[userType] || userType;
};

/**
 * Helper: Get user type icon
 */
const getUserTypeIcon = (userType) => {
  const iconMap = {
    MASTER_ADMIN: '👑',
    INSTITUTE_ADMIN: '🏢',
    BRANCH_ADMIN: '🌿',
    TEACHER: '👨‍🏫',
    STUDENT: '👨‍🎓',
    PARENT: '👪',
    STAFF: '👔'
  };
  return iconMap[userType] || '👤';
};

/**
 * Helper: Get full user profile
 */
const getUserProfile = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [
      { model: Role, as: 'Role' },
      { model: Institute, as: 'institute', include: [{ model: InstituteType, as: 'type' }] },
      { model: Branch, as: 'branch' }
    ]
  });
  
  if (!user) return null;
  
  const permissions = await getUserPermissions(user);
  
  let instituteData = null;
  if (user.institute) {
    instituteData = {
      id: user.institute.id,
      name: user.institute.institute_name,
      code: user.institute.institute_code,
      logo_url: user.institute.institute_logo_url,
      institute_type: user.institute.type?.slug || null,
      settings: normalizeSettings(user.institute.settings)
    };
  }
  
  let branchData = null;
  if (user.branch) {
    branchData = {
      id: user.branch.id,
      name: user.branch.branch_name,
      code: user.branch.branch_code
    };
  }
  
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    registration_no: user.registration_no,
    user_type: user.user_type,
    staff_type: user.staff_type,
    school_id: user.school_id,
    branch_id: user.branch_id,
    role: user.Role ? { id: user.Role.id, name: user.Role.name, code: user.Role.code } : null,
    permissions: permissions,
    avatar_url: user.avatar_url,
    institute: instituteData,
    branch: branchData,
    phone: user.phone,
    is_active: user.is_active,
    has_branch: !!user.branch_id
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

  const user = await User.findByPk(decoded.userId, {
    attributes: ['id', 'school_id', 'user_type', 'branch_id', 'is_active']
  });
  
  if (!user || !user.is_active) throw new AppError('User not found.', 401);

  const accessToken = signAccessToken({
    userId:   user.id,
    schoolId: user.school_id,
    userType: user.user_type,
    branchId: user.branch_id,
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
    email_verified:        true,
    password_reset_token:   null,
    password_reset_expires: null,
  });

  return user;
};

// backend/src/services/auth.service.js (ADD THIS)

/**
 * Get all accounts for an email WITHOUT verifying password
 * Returns list of accounts with their basic info
 */
export const getAccountsByEmailService = async (email) => {
  if (!email || !email.includes('@')) {
    throw new AppError('Valid email is required', 400);
  }
  
  const users = await User.unscoped().findAll({
    where: { email: email.toLowerCase() },
    attributes: [
      'id', 'first_name', 'last_name', 'email', 'user_type', 
      'staff_type', 'school_id', 'branch_id', 'avatar_url', 'is_active'
    ],
    include: [
      { 
        model: Institute, 
        as: 'institute', 
        attributes: ['id', 'institute_name', 'institute_code', 'institute_logo_url']
      }
    ]
  });
  
  if (!users || users.length === 0) {
    return { accounts: [], hasAccounts: false };
  }
  
  const accounts = users.map(user => ({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    user_type: user.user_type,
    staff_type: user.staff_type,
    display_name: `${user.first_name} ${user.last_name}`,
    display_role: getUserTypeDisplay(user.user_type, user.staff_type),
    display_icon: getUserTypeIcon(user.user_type),
    institute: user.institute ? {
      id: user.institute.id,
      name: user.institute.institute_name,
      code: user.institute.institute_code,
      logo_url: user.institute.institute_logo_url
    } : null,
    is_active: user.is_active
  }));
  
  return { 
    accounts, 
    hasAccounts: accounts.length > 0,
    accountCount: accounts.length 
  };
};

/**
 * Login with specific account ID and password
 */
export const loginWithAccountService = async (accountId, password) => {
  const user = await User.unscoped().findByPk(accountId, {
    include: [
      { model: Role, as: 'Role' },
      { model: Institute, as: 'institute', include: [{ model: InstituteType, as: 'type' }] },
      { model: Branch, as: 'branch' }
    ]
  });
  
  if (!user) {
    throw new AppError('Account not found.', 404);
  }
  
  if (!user.is_active) {
    throw new AppError('Account is deactivated. Contact administrator.', 403);
  }
  
  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    throw new AppError('Invalid password for this account.', 401);
  }
  
  // Update last login
  await user.update({ last_login_at: new Date() });
  
  // Generate tokens
  const tokenPayload = {
    userId: user.id,
    schoolId: user.school_id,
    userType: user.user_type,
    branchId: user.branch_id,
  };
  
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ userId: user.id });
  
  const userProfile = await getUserProfile(user.id);
  
  return {
    accessToken,
    refreshToken,
    user: userProfile
  };
};

export default { loginService, refreshTokenService, forgotPasswordService, resetPasswordService , selectAccountService, getAccountsByEmailService, loginWithAccountService };