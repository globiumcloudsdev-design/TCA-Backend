/**
 * The Clouds Academy - Auth Controller
 */
import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendCreated, sendUnauthorized } from '../../utils/helpers/response.helper.js';
import authService from '../../services/auth.service.js';
import { sendPasswordResetEmail } from '../../services/email.service.js';
import { AppError } from '../../utils/lib/AppError.js';

/**
 * Helper to set httpOnly refresh token cookie
 */
const setRefreshTokenCookie = (res, token) => {
  if (!token) return;
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/'
  });
};

/**
 * Login - Modified to handle both scenarios
 */
export const login = catchAsync(async (req, res) => {
  const { email, password, registration_no } = req.body;
  const loginId = email || registration_no;
  
  if (!loginId) {
    throw new AppError('Email/Registration number is required', 400);
  }
  
  // If registration_no, direct login with password
  if (registration_no) {
    if (!password) {
      throw new AppError('Password is required', 400);
    }
    const result = await authService.loginService(loginId, password);
    setRefreshTokenCookie(res, result.refreshToken);
    return sendSuccess(res, {
      accessToken: result.accessToken,
      access_token: result.accessToken,
      refreshToken: result.refreshToken,
      refresh_token: result.refreshToken,
      user: result.user
    }, 'Login successful');
  }
  
  // For email - check if password provided
  if (email) {
    // If password is provided, try direct login with that specific account
    if (password) {
      const result = await authService.loginService(email, password);
      setRefreshTokenCookie(res, result.refreshToken);
      return sendSuccess(res, {
        accessToken: result.accessToken,
        access_token: result.accessToken,
        refreshToken: result.refreshToken,
        refresh_token: result.refreshToken,
        user: result.user
      }, 'Login successful');
    }
    
    // No password - just get accounts list
    const accountsResult = await authService.getAccountsByEmailService(email);
    
    if (accountsResult.accounts.length === 0) {
      throw new AppError('No account found with this email', 404);
    }
    
    if (accountsResult.accounts.length === 1) {
      // Single account - return account info, frontend will ask for password
      return sendSuccess(res, {
        requiresPassword: true,
        account: accountsResult.accounts[0],
        message: 'Enter password to continue'
      }, 'Password required');
    }
    
    // Multiple accounts - return list for selection
    return sendSuccess(res, {
      requiresSelection: true,
      accounts: accountsResult.accounts,
      message: 'Select an account to continue'
    }, 'Account selection required');
  }
  
  throw new AppError('Email or registration number required', 400);
});

/**
 * Get accounts by email (without password)
 */
export const getAccountsByEmail = catchAsync(async (req, res) => {
  const { email } = req.query;
  
  if (!email) {
    throw new AppError('Email is required', 400);
  }
  
  const result = await authService.getAccountsByEmailService(email);
  sendSuccess(res, result, 'Accounts fetched successfully');
});

/**
 * Login with specific account ID
 */
export const loginWithAccount = catchAsync(async (req, res) => {
  const { accountId, password } = req.body;
  
  if (!accountId || !password) {
    throw new AppError('Account ID and password are required', 400);
  }
  
  const result = await authService.loginWithAccountService(accountId, password);
  setRefreshTokenCookie(res, result.refreshToken);
  
  sendSuccess(res, {
    accessToken: result.accessToken,
    access_token: result.accessToken,
    refreshToken: result.refreshToken,
    refresh_token: result.refreshToken,
    user: result.user
  }, 'Login successful');
});

/**
 * Select account after multiple account detection (legacy)
 */
export const selectAccount = catchAsync(async (req, res) => {
  const { accountId } = req.body;
  const { userId } = req.user;
  
  if (!accountId) {
    throw new AppError('Account ID is required', 400);
  }
  
  const result = await authService.selectAccountService(accountId, null, null);
  setRefreshTokenCookie(res, result.refreshToken);
  
  sendSuccess(res, {
    accessToken: result.accessToken,
    access_token: result.accessToken,
    refreshToken: result.refreshToken,
    refresh_token: result.refreshToken,
    user: result.user
  }, 'Account selected successfully');
});

export const logout = catchAsync(async (req, res) => {
  res.clearCookie('refreshToken', { path: '/' });
  sendSuccess(res, null, 'Logged out successfully');
});

export const refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken || req.body?.refresh_token;
  const result = await authService.refreshTokenService(token);
  setRefreshTokenCookie(res, result.refreshToken);
  sendSuccess(res, {
    accessToken: result.accessToken,
    access_token: result.accessToken,
    refreshToken: result.refreshToken,
    refresh_token: result.refreshToken,
    user: result.user
  }, 'Token refreshed');
});

export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await authService.forgotPasswordService(email);

  if (result) {
    await sendPasswordResetEmail(email, result.token, result.user.first_name);
  }

  sendSuccess(res, null, 'If the email exists, a reset link has been sent.');
});

export const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;
  await authService.resetPasswordService(token, password);
  sendSuccess(res, null, 'Password reset successfully. Please login.');
});

export const getMe = catchAsync(async (req, res) => {
  sendSuccess(res, req.user, 'User profile');
});

// backend/src/controllers/auth.controller.js (ADD THESE)

/**
 * Get full institute data for current user's institute
 */
export const getMyInstitute = catchAsync(async (req, res) => {
  const instituteId = req.user.school_id;
  
  if (!instituteId) {
    throw new AppError('No institute associated with this account', 404);
  }
  
  const instituteData = await authService.getInstituteDataService(instituteId);
  
  if (!instituteData) {
    throw new AppError('Institute not found', 404);
  }
  
  sendSuccess(res, instituteData, 'Institute data fetched successfully');
});

/**
 * Get institute policies for current user's institute
 */
export const getMyInstitutePolicies = catchAsync(async (req, res) => {
  const instituteId = req.user.school_id;
  const { policy_type } = req.query;
  
  if (!instituteId) {
    throw new AppError('No institute associated with this account', 404);
  }
  
  const policies = await authService.getInstitutePoliciesService(instituteId, policy_type);
  
  sendSuccess(res, policies, 'Institute policies fetched successfully');
});

/**
 * Get specific policy by type
 */
export const getInstitutePolicyByType = catchAsync(async (req, res) => {
  const instituteId = req.user.school_id;
  const { policyType } = req.params;
  
  if (!instituteId) {
    throw new AppError('No institute associated with this account', 404);
  }
  
  const policies = await authService.getInstitutePoliciesService(instituteId, policyType);
  
  const latestPolicy = policies.latest[policyType] || null;
  
  sendSuccess(res, latestPolicy, `Policy fetched for type: ${policyType}`);
});


/**
 * Refresh current user data (get latest institute info)
 */
export const refreshUserData = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const userData = await authService.refreshInstituteDataService(userId);
    sendSuccess(res, userData, 'User data refreshed');
});

/**
 * Impersonate user (Ghost Mode)
 * Access: Master Admin ONLY (checked in routes)
 */
export const impersonateUser = catchAsync(async (req, res) => {
  const { userId } = req.body;
  if (!userId) throw new AppError('User ID is required', 400);

  const result = await authService.impersonateUserService(userId);
  setRefreshTokenCookie(res, result.refreshToken);

  sendSuccess(res, {
    accessToken: result.accessToken,
    access_token: result.accessToken,
    refreshToken: result.refreshToken,
    refresh_token: result.refreshToken,
    user: result.user
  }, `Successfully impersonated ${result.user.first_name}`);
});


export default { 
  login, 
  logout, 
  refreshToken, 
  forgotPassword, 
  resetPassword, 
  getMe,
  getAccountsByEmail,
  loginWithAccount,
  selectAccount,
  getMyInstitute,
  getMyInstitutePolicies,
  getInstitutePolicyByType,
  refreshUserData,
  impersonateUser
};