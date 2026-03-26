// /**
//  * The Clouds Academy - Auth Controller
//  */

// import catchAsync from '../../utils/lib/catchAsync.js';
// import { sendSuccess, sendCreated, sendUnauthorized } from '../../utils/helpers/response.helper.js';
// import authService, {
//   loginService,
//   refreshTokenService,
//   forgotPasswordService,
//   resetPasswordService,
// } from '../../services/auth.service.js';
// import { sendPasswordResetEmail } from '../../services/email.service.js';

// // /**
// //  * Login - Returns accounts if multiple, or direct login if single
// //  */
// // export const login = catchAsync(async (req, res) => {
// //   const { email, password, registration_no } = req.body;
// //   const loginId = email || registration_no;
  
// //   if (!loginId || !password) {
// //     throw new AppError('Email/Registration number and password are required', 400);
// //   }
  
// //   const result = await authService.loginService(loginId, password);
  
// //   if (result.hasMultipleAccounts) {
// //     // Return accounts for selection
// //     return sendSuccess(res, {
// //       requiresAccountSelection: true,
// //       accounts: result.accounts,
// //       message: result.message
// //     }, 'Multiple accounts found. Please select one.');
// //   }
  
// //   // Single account - login directly
// //   sendSuccess(res, {
// //     requiresAccountSelection: false,
// //     accessToken: result.accessToken,
// //     refreshToken: result.refreshToken,
// //     user: result.user,
// //     accounts: result.accounts
// //   }, 'Login successful');
// // });

// /**
//  * Get accounts by email (without password verification)
//  * GET /api/v1/auth/accounts?email=xxx
//  */
// export const getAccountsByEmail = catchAsync(async (req, res) => {
//   const { email } = req.query;
  
//   if (!email) {
//     throw new AppError('Email is required', 400);
//   }
  
//   const result = await authService.getAccountsByEmailService(email);
  
//   sendSuccess(res, result, 'Accounts fetched successfully');
// });

// /**
//  * Login with specific account ID
//  * POST /api/v1/auth/login-with-account
//  */
// export const loginWithAccount = catchAsync(async (req, res) => {
//   const { accountId, password } = req.body;
  
//   if (!accountId || !password) {
//     throw new AppError('Account ID and password are required', 400);
//   }
  
//   const result = await authService.loginWithAccountService(accountId, password);
  
//   sendSuccess(res, {
//     accessToken: result.accessToken,
//     refreshToken: result.refreshToken,
//     user: result.user
//   }, 'Login successful');
// });

// /**
//  * Modified login - First step only checks if email exists
//  */
// export const login = catchAsync(async (req, res) => {
//   const { email, password, registration_no } = req.body;
//   const loginId = email || registration_no;
  
//   if (!loginId) {
//     throw new AppError('Email/Registration number is required', 400);
//   }
  
//   // If email is provided, first check how many accounts exist
//   if (email && email.includes('@')) {
//     const accountsResult = await authService.getAccountsByEmailService(email);
    
//     if (accountsResult.accountCount > 1) {
//       // Multiple accounts found, return them for selection
//       return sendSuccess(res, {
//         requiresAccountSelection: true,
//         accounts: accountsResult.accounts,
//         message: 'Multiple accounts found. Please select which account to use.'
//       }, 'Multiple accounts found');
//     }
    
//     if (accountsResult.accountCount === 1) {
//       // Single account, ask for password directly
//       return sendSuccess(res, {
//         requiresAccountSelection: false,
//         singleAccount: accountsResult.accounts[0],
//         message: 'Single account found. Please enter password.'
//       }, 'Single account found');
//     }
//   }
  
//   // For registration_no or if no accounts found, try direct login
//   if (!password) {
//     throw new AppError('Password is required', 400);
//   }
  
//   const result = await authService.loginService(loginId, password);
  
//   sendSuccess(res, {
//     requiresAccountSelection: false,
//     accessToken: result.accessToken,
//     refreshToken: result.refreshToken,
//     user: result.user
//   }, 'Login successful');
// });

// /**
//  * Select account after multiple account login
//  */
// export const selectAccount = catchAsync(async (req, res) => {
//   const { accountId } = req.body;
//   const { userId } = req.user; // From temporary token
  
//   if (!accountId) {
//     throw new AppError('Account ID is required', 400);
//   }
  
//   const result = await authService.selectAccountService(userId, accountId);
  
//   sendSuccess(res, {
//     accessToken: result.accessToken,
//     refreshToken: result.refreshToken,
//     user: result.user
//   }, 'Account selected successfully');
// });

// export const logout = catchAsync(async (req, res) => {
//   res.clearCookie('refreshToken');
//   sendSuccess(res, null, 'Logged out successfully');
// });

// export const refreshToken = catchAsync(async (req, res) => {
//   const token = req.cookies?.refreshToken || req.body?.refreshToken;
//   const result = await refreshTokenService(token);
//   sendSuccess(res, result, 'Token refreshed');
// });

// export const forgotPassword = catchAsync(async (req, res) => {
//   const { email } = req.body;
//   const result = await forgotPasswordService(email);

//   if (result) {
//     await sendPasswordResetEmail(email, result.token, result.user.first_name);
//   }

//   // Always return success (don't reveal if email exists)
//   sendSuccess(res, null, 'If the email exists, a reset link has been sent.');
// });

// export const resetPassword = catchAsync(async (req, res) => {
//   const { token, password } = req.body;
//   await resetPasswordService(token, password);
//   sendSuccess(res, null, 'Password reset successfully. Please login.');
// });

// export const getMe = catchAsync(async (req, res) => {
//   sendSuccess(res, req.user, 'User profile');
// });

// export default { login, logout, refreshToken, forgotPassword, resetPassword, getMe };





// backend/src/controllers/auth.controller.js (FIXED)

import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendCreated, sendUnauthorized } from '../../utils/helpers/response.helper.js';
import authService from '../../services/auth.service.js';
import { sendPasswordResetEmail } from '../../services/email.service.js';
import { AppError } from '../../utils/lib/AppError.js';

// /**
//  * Login - Handles both single and multiple accounts
//  */
// export const login = catchAsync(async (req, res) => {
//   const { email, password, registration_no } = req.body;
//   const loginId = email || registration_no;
  
//   if (!loginId) {
//     throw new AppError('Email/Registration number is required', 400);
//   }
  
//   // If password is provided, try direct login
//   if (password) {
//     const result = await authService.loginService(loginId, password);
    
//     if (result.hasMultipleAccounts) {
//       // Multiple accounts with correct password for one of them? Actually multiple accounts found
//       return sendSuccess(res, {
//         requiresAccountSelection: true,
//         accounts: result.accounts,
//         message: 'Multiple accounts found. Please select which account to use.'
//       }, 'Multiple accounts found');
//     }
    
//     // Single account - direct login
//     return sendSuccess(res, {
//       requiresAccountSelection: false,
//       accessToken: result.accessToken,
//       refreshToken: result.refreshToken,
//       user: result.user
//     }, 'Login successful');
//   }
  
//   // No password provided, just check accounts
//   if (email && email.includes('@')) {
//     const accountsResult = await authService.getAccountsByEmailService(email);
    
//     if (accountsResult.accounts.length > 1) {
//       return sendSuccess(res, {
//         requiresAccountSelection: true,
//         accounts: accountsResult.accounts,
//         message: 'Multiple accounts found. Please select one.'
//       }, 'Multiple accounts found');
//     }
    
//     if (accountsResult.accounts.length === 1) {
//       return sendSuccess(res, {
//         requiresAccountSelection: false,
//         singleAccount: accountsResult.accounts[0],
//         message: 'Single account found. Please enter password.'
//       }, 'Single account found');
//     }
    
//     throw new AppError('No account found with this email', 404);
//   }
  
//   throw new AppError('Email or password required', 400);
// });




// backend/src/controllers/auth.controller.js

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
    return sendSuccess(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user
    }, 'Login successful');
  }
  
  // For email - check if password provided
  if (email) {
    // If password is provided, try direct login with that specific account
    if (password) {
      const result = await authService.loginService(email, password);
      return sendSuccess(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
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
  
  sendSuccess(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
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
  
  const result = await authService.selectAccountService(userId, accountId);
  
  sendSuccess(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user
  }, 'Account selected successfully');
});

export const logout = catchAsync(async (req, res) => {
  res.clearCookie('refreshToken');
  sendSuccess(res, null, 'Logged out successfully');
});

export const refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  const result = await authService.refreshTokenService(token);
  sendSuccess(res, result, 'Token refreshed');
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

export default { 
  login, 
  logout, 
  refreshToken, 
  forgotPassword, 
  resetPassword, 
  getMe,
  getAccountsByEmail,
  loginWithAccount,
  selectAccount
};