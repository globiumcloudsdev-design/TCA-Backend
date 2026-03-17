/**
 * The Clouds Academy - Auth Controller
 */

import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendCreated, sendUnauthorized } from '../../utils/helpers/response.helper.js';
import {
  loginService,
  refreshTokenService,
  forgotPasswordService,
  resetPasswordService,
} from '../../services/auth.service.js';
import { sendPasswordResetEmail } from '../../services/email.service.js';

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await loginService(email, password);

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  sendSuccess(res, { accessToken: result.accessToken, user: result.user }, 'Login successful');
});

export const logout = catchAsync(async (req, res) => {
  res.clearCookie('refreshToken');
  sendSuccess(res, null, 'Logged out successfully');
});

export const refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  const result = await refreshTokenService(token);
  sendSuccess(res, result, 'Token refreshed');
});

export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await forgotPasswordService(email);

  if (result) {
    await sendPasswordResetEmail(email, result.token, result.user.first_name);
  }

  // Always return success (don't reveal if email exists)
  sendSuccess(res, null, 'If the email exists, a reset link has been sent.');
});

export const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;
  await resetPasswordService(token, password);
  sendSuccess(res, null, 'Password reset successfully. Please login.');
});

export const getMe = catchAsync(async (req, res) => {
  sendSuccess(res, req.user, 'User profile');
});

export default { login, logout, refreshToken, forgotPassword, resetPassword, getMe };





