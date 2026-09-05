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


/**
 * The Clouds Academy - Auth Service
 */

import crypto from 'crypto';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import User from '../models/postgres/User.model.js';
import Role from '../models/postgres/Role.model.js';
import Institute from '../models/postgres/Institute.model.js';
import InstituteType from '../models/postgres/InstituteType.model.js';
import Branch from '../models/postgres/Branch.model.js';
import InstituteSettings from '../models/postgres/InstituteSettings.model.js';
import Policy from '../models/postgres/Policy.model.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../config/auth.js';
import { AppError } from '../utils/lib/AppError.js';
import { hashPassword, comparePassword } from '../utils/helpers/password.helper.js';
import logger from '../config/logger.js';

const USER_TYPE_TO_KEY = {
  MASTER_ADMIN:    'master',
  INSTITUTE_ADMIN: 'instituteAdmin',
  BRANCH_ADMIN:    'branchAdmin',
  TEACHER:         'teacher',
  STUDENT:         'student',
  PARENT:          'parent',
  STAFF:           'staff',
};

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
  if (typeof settings === 'string') {
    try {
      return JSON.parse(settings);
    } catch (e) {
      return {
        has_branches: false,
        enable_parent_portal: true,
        enable_teacher_portal: true,
        enable_student_portal: true,
        enable_sms_notifications: false
      };
    }
  }
  return settings;
};

// 🔥 FIXED: Return institute_type as STRING, not object
const getCompleteInstituteData = async (instituteId) => {
  if (!instituteId) return null;
  
  try {
    const { SubscriptionPlan, Invoice } = sequelize.models;
    
    const institute = await Institute.findByPk(instituteId, {
      include: [
        { model: InstituteType, as: 'type', attributes: ['id', 'name', 'slug', 'icon'] },
        { model: InstituteSettings, as: 'settings_detail' },
        { model: SubscriptionPlan, as: 'plan' },
        { 
          model: Invoice, 
          as: 'invoices',
          where: { status: 'PAID' },
          required: false,
          limit: 1,
          order: [['period_end', 'DESC']]
        }
      ],
      attributes: [
        'id', 'institute_name', 'institute_code', 'institute_email', 
        'institute_contact', 'institute_address', 'institute_city',
        'institute_country', 'institute_logo_url', 'subscription_status',
        'trial_end_date', 'joining_date', 'settings', 'subscription_plan_id'
      ]
    });
    
    if (!institute) return null;
    
    // Fetch active branches for institute
    const branches = await Branch.findAll({
      where: { institute_id: instituteId, is_active: true },
      attributes: ['id', 'name', 'code', 'phone', 'email', 'address', 'city', 'is_main'],
      order: [['is_main', 'DESC'], ['name', 'ASC']]
    });

    // Fetch policies
    const policies = await Policy.findAll({
      where: { institute_id: instituteId, is_active: true },
      attributes: ['id', 'policy_type', 'policy_name', 'description', 'config', 'version'],
      order: [['policy_type', 'ASC'], ['created_at', 'DESC']]
    });
    
    const policiesByType = {};
    const latestPolicies = {};
    policies.forEach(policy => {
      if (!policiesByType[policy.policy_type]) {
        policiesByType[policy.policy_type] = [];
      }
      policiesByType[policy.policy_type].push(policy);
      
      if (!latestPolicies[policy.policy_type] || policy.version > latestPolicies[policy.policy_type].version) {
        latestPolicies[policy.policy_type] = policy;
      }
    });
    
    // Merge settings
    const baseSettings = normalizeSettings(institute.settings);
    const detailedSettings = institute.settings_detail || {};
    
    const mergedSettings = {
      ...baseSettings,
      academic: detailedSettings.academic || {},
      timings: detailedSettings.timings || {},
      finance: detailedSettings.finance || {},
      communication: detailedSettings.communication || {},
      appearance: detailedSettings.appearance || {},
      security: detailedSettings.security || {},
      modules: detailedSettings.modules || {},
      footer: detailedSettings.footer || {}
    };
    
    // 🔥 IMPORTANT: Return institute_type as STRING, not object
    const instituteTypeSlug = institute.type?.slug || 'school';
    
    return {
      id: institute.id,
      name: institute.institute_name,
      code: institute.institute_code,
      email: institute.institute_email,
      phone: institute.institute_contact,
      address: institute.institute_address,
      city: institute.institute_city,
      country: institute.institute_country,
      logo_url: institute.institute_logo_url,
      subscription_status: institute.subscription_status,
      trial_end_date: institute.trial_end_date,
      joining_date: institute.joining_date,
      // 🔥 NEW: Subscription & Billing
      subscription_plan: institute.plan ? {
        id: institute.plan.id,
        name: institute.plan.name,
        code: institute.plan.code,
        description: institute.plan.description,
        price: institute.plan.price,
        currency: institute.plan.currency,
        cycle: institute.plan.cycle,
        trial_days: institute.plan.trial_days,
        limits: institute.plan.limits,
        features: institute.plan.features,
        is_popular: institute.plan.is_popular
      } : null,
      active_invoice: institute.invoices?.[0] ? {
        id: institute.invoices[0].id,
        invoice_number: institute.invoices[0].invoice_number,
        status: institute.invoices[0].status,
        period_start: institute.invoices[0].period_start,
        period_end: institute.invoices[0].period_end,
        expiry_date: institute.invoices[0].period_end, // Expiry date is period_end
      } : null,
      // 🔥 FIXED: String, not object
      institute_type: instituteTypeSlug,
      // Keep type object separately if needed
      institute_type_obj: institute.type ? {
        id: institute.type.id,
        name: institute.type.name,
        slug: institute.type.slug,
        icon: institute.type.icon
      } : null,
      settings: mergedSettings,
      policies: {
        all: policies,
        by_type: policiesByType,
        latest: latestPolicies
      },
      branches: branches.map(b => (b.toJSON ? b.toJSON() : b)),
      has_branches: mergedSettings.has_branches || branches.length > 0
    };
  } catch (error) {
    logger.error('Error fetching institute data:', error);
    return null;
  }
};

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

const getUserProfile = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [
      { model: Role, as: 'Role' },
      { model: Institute, as: 'institute' },
      { model: Branch, as: 'branch' }
    ]
  });
  
  if (!user) return null;
  
  const permissions = await getUserPermissions(user);
  
  let instituteData = null;
  if (user.school_id || user.institute?.id) {
    const instituteId = user.school_id || user.institute?.id;
    instituteData = await getCompleteInstituteData(instituteId);
  }
  
  let branchData = null;
  if (user.branch_id && instituteData) {
    // branch data from separate query
    const branch = await Branch.findByPk(user.branch_id, {
      attributes: ['id', 'name', 'code', 'phone', 'email', 'address', 'city', 'is_main']
    });
    if (branch) {
      branchData = {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        phone: branch.phone,
        email: branch.email,
        address: branch.address,
        city: branch.city,
        is_main: branch.is_main
      };
    }
  }
  
  const mainBranch = instituteData?.branches?.find(b => b.is_main === true) ||
    instituteData?.branches?.find(b => {
      const code = String(b.code || '').toUpperCase();
      const name = String(b.name || '').toLowerCase();
      return code.endsWith('-MAIN') || code === 'MAIN' || name.includes('main');
    }) ||
    instituteData?.branches?.[0] ||
    null;

  const isGlobalAdmin = [
    'MASTER_ADMIN',
    'SYSTEM_ADMIN',
    'SUPPORT_STAFF',
    'INSTITUTE_ADMIN',
    'SUPER_ADMIN',
    'SUPER ADMIN'
  ].includes(String(user.user_type || '').toUpperCase());

  const effectiveBranch = branchData || (isGlobalAdmin && mainBranch ? (mainBranch.toJSON ? mainBranch.toJSON() : mainBranch) : null);

  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    registration_no: user.registration_no,
    user_type: user.user_type,
    staff_type: user.staff_type,
    school_id: user.school_id,
    branch_id: user.branch_id || (isGlobalAdmin && mainBranch ? mainBranch.id : null),
    role: user.Role ? { 
      id: user.Role.id, 
      name: user.Role.name, 
      code: user.Role.code 
    } : null,
    permissions: permissions,
    avatar_url: user.avatar_url,
    institute: instituteData,
    branch: effectiveBranch,
    main_branch: mainBranch ? (mainBranch.toJSON ? mainBranch.toJSON() : mainBranch) : null,
    is_main_branch: branchData ? (branchData.is_main === true || String(branchData.code || '').toUpperCase().endsWith('-MAIN')) : Boolean(mainBranch),
    phone: user.phone,
    is_active: user.is_active,
    has_branch: !!user.branch_id || Boolean(effectiveBranch),
    email_verified: user.email_verified,
    created_at: user.created_at,
    last_login_at: user.last_login_at
  };
};

export const loginService = async (loginId, password) => {
  let users;
  if (loginId.includes('@')) {
    users = await User.unscoped().findAll({ 
      where: { email: loginId.toLowerCase() },
      include: [
        { model: Role, as: 'Role' },
        { model: Institute, as: 'institute' },
        { model: Branch, as: 'branch' }
      ]
    });
  } else {
    users = await User.unscoped().findAll({ 
      where: { registration_no: loginId },
      include: [
        { model: Role, as: 'Role' },
        { model: Institute, as: 'institute' },
        { model: Branch, as: 'branch' }
      ]
    });
  }

  if (!users || users.length === 0) {
    throw new AppError('No account found with these credentials.', 401);
  }

  const validAccounts = [];
  let inactiveAccountMatch = false;
  
  for (const user of users) {
    const isMatch = await comparePassword(password, user.password_hash);
    if (isMatch) {
      if (!user.is_active) {
        inactiveAccountMatch = true;
        continue;
      }
      if (user.school_id && user.institute && !user.institute.is_active) {
        throw new AppError('Your institute account is currently inactive. Please contact support.', 403);
      }
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
      
      let instituteData = null;
      if (user.school_id) {
        instituteData = await getCompleteInstituteData(user.school_id);
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
        institute: instituteData ? {
          id: instituteData.id,
          name: instituteData.name,
          code: instituteData.code,
          logo_url: instituteData.logo_url,
          institute_type: instituteData.institute_type, // 🔥 STRING
          settings: instituteData.settings,
          has_branches: instituteData.has_branches,
          branches: instituteData.branches,
          subscription_plan: instituteData.subscription_plan,
          active_invoice: instituteData.active_invoice
        } : null,
        role: user.Role ? {
          id: user.Role.id,
          name: user.Role.name,
          code: user.Role.code
        } : null,
        display_name: `${user.first_name} ${user.last_name}`,
        display_role: getUserTypeDisplay(user.user_type, user.staff_type),
        display_icon: getUserTypeIcon(user.user_type),
        is_active: user.is_active,
        last_login_at: user.last_login_at
      });
    }
  }

  if (validAccounts.length === 0) {
    if (inactiveAccountMatch) {
      throw new AppError('Account is deactivated. Please contact administrator.', 403);
    }
    throw new AppError('Invalid credentials.', 401);
  }

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
    
    const userProfile = await getUserProfile(user.id);
    
    return {
      accessToken,
      refreshToken,
      user: userProfile,
      accounts: validAccounts,
      hasMultipleAccounts: false
    };
  }
  
  return {
    accounts: validAccounts,
    hasMultipleAccounts: true,
    message: 'Multiple accounts found. Please select which account to use.'
  };
};

export const selectAccountService = async (accountId, email, registrationNo) => {
  const user = await User.unscoped().findByPk(accountId, {
    include: [
      { model: Role, as: 'Role' },
      { model: Institute, as: 'institute' },
      { model: Branch, as: 'branch' }
    ]
  });
  
  if (!user) throw new AppError('Account not found.', 404);
  if (!user.is_active) throw new AppError('Account is deactivated.', 403);
  if (user.school_id && user.institute && !user.institute.is_active) {
    throw new AppError('Your institute account is currently inactive. Please contact support.', 403);
  }
  
  await user.update({ last_login_at: new Date() });
  
  const tokenPayload = {
    userId: user.id,
    schoolId: user.school_id,
    userType: user.user_type,
    branchId: user.branch_id,
  };
  
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ userId: user.id });
  const userProfile = await getUserProfile(user.id);
  
  return { accessToken, refreshToken, user: userProfile };
};

export const refreshTokenService = async (refreshToken) => {
  if (!refreshToken) throw new AppError('Refresh token required.', 401);
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401);
  }
  const user = await User.findByPk(decoded.userId, {
    attributes: ['id', 'school_id', 'user_type', 'branch_id', 'is_active'],
    include: [{ model: Institute, as: 'institute', attributes: ['is_active'] }]
  });
  if (!user || !user.is_active) throw new AppError('User not found.', 401);
  if (user.school_id && user.institute && !user.institute.is_active) {
    throw new AppError('Your institute account is currently inactive.', 401);
  }
  const accessToken = signAccessToken({
    userId: user.id,
    schoolId: user.school_id,
    userType: user.user_type,
    branchId: user.branch_id,
  });
  const newRefreshToken = signRefreshToken({ userId: user.id });
  return {
    accessToken,
    access_token: accessToken,
    refreshToken: newRefreshToken,
    refresh_token: newRefreshToken,
    user: {
      id: user.id,
      school_id: user.school_id,
      user_type: user.user_type,
      branch_id: user.branch_id,
    }
  };
};

export const forgotPasswordService = async (email) => {
  const user = await User.findOne({ where: { email } });
  if (!user) return;
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 30 * 60 * 1000);
  await user.update({
    password_reset_token: token,
    password_reset_expires: expires,
  });
  return { token, user };
};

export const resetPasswordService = async (token, newPassword) => {
  const user = await User.scope('withPassword').findOne({
    where: { password_reset_token: token },
  });
  if (!user || new Date() > user.password_reset_expires) {
    throw new AppError('Invalid or expired reset token.', 400);
  }
  const passwordHash = await hashPassword(newPassword);
  await user.update({
    password_hash: passwordHash,
    email_verified: true,
    password_reset_token: null,
    password_reset_expires: null,
  });
  return user;
};

export const getAccountsByEmailService = async (email) => {
  if (!email || !email.includes('@')) {
    throw new AppError('Valid email is required', 400);
  }
  const users = await User.unscoped().findAll({
    where: { email: email.toLowerCase() },
    attributes: ['id', 'first_name', 'last_name', 'email', 'user_type', 'staff_type', 'school_id', 'branch_id', 'avatar_url', 'is_active'],
    include: [{ model: Institute, as: 'institute', attributes: ['id', 'institute_name', 'institute_code', 'institute_logo_url'] }]
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
  return { accounts, hasAccounts: accounts.length > 0, accountCount: accounts.length };
};

export const loginWithAccountService = async (accountId, password) => {
  const user = await User.unscoped().findByPk(accountId, {
    include: [
      { model: Role, as: 'Role' },
      { model: Institute, as: 'institute' },
      { model: Branch, as: 'branch' }
    ]
  });
  if (!user) throw new AppError('Account not found.', 404);
  if (!user.is_active) throw new AppError('Account is deactivated.', 403);
  if (user.school_id && user.institute && !user.institute.is_active) {
    throw new AppError('Your institute account is currently inactive. Please contact support.', 403);
  }
  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) throw new AppError('Invalid password.', 401);
  await user.update({ last_login_at: new Date() });
  const tokenPayload = {
    userId: user.id,
    schoolId: user.school_id,
    userType: user.user_type,
    branchId: user.branch_id,
  };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ userId: user.id });
  const userProfile = await getUserProfile(user.id);
  return { accessToken, refreshToken, user: userProfile };
};

export const getInstituteDataService = async (instituteId) => {
  return await getCompleteInstituteData(instituteId);
};

/**
 * Refresh institute data in user session (call after settings update)
 */
export const refreshInstituteDataService = async (userId) => {
    return await getUserProfile(userId);
};

/**
 * Impersonate User Service (Ghost Mode)
 * Generates tokens for any user without password check.
 * ONLY for Master Admin use.
 */
export const impersonateUserService = async (userId) => {
  const user = await User.unscoped().findByPk(userId, {
    attributes: ['id', 'school_id', 'user_type', 'branch_id', 'is_active']
  });

  if (!user) throw new AppError('User not found.', 404);
  if (!user.is_active) throw new AppError('Cannot impersonate an inactive user.', 403);

  // Update last login
  await user.update({ last_login_at: new Date() });

  const tokenPayload = {
    userId: user.id,
    schoolId: user.school_id,
    userType: user.user_type,
    branchId: user.branch_id,
    isImpersonated: true, // Flag for security/auditing
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ userId: user.id });
  const userProfile = await getUserProfile(user.id);

  return { accessToken, refreshToken, user: userProfile };
};

export const getInstitutePoliciesService = async (instituteId, policyType = null) => {
  const where = { institute_id: instituteId };
  if (policyType) where.policy_type = policyType;
  const policies = await Policy.findAll({ where, order: [['created_at', 'DESC']] });
  const latest = {};
  policies.forEach((p) => {
    if (!latest[p.policy_type]) latest[p.policy_type] = p;
  });
  return { policies, latest };
};

export default { 
  loginService, 
  refreshTokenService, 
  forgotPasswordService, 
  resetPasswordService,
  selectAccountService, 
  getAccountsByEmailService, 
  loginWithAccountService,
  getInstituteDataService,
  refreshInstituteDataService,
  impersonateUserService,
  getInstitutePoliciesService
};