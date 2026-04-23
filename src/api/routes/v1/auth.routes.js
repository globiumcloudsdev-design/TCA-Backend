/**
 * The Clouds Academy - Auth Routes
 */

import { Router } from 'express';
import {
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  getMe,
  selectAccount,
  getAccountsByEmail,
  loginWithAccount,
  getMyInstitute,
  getMyInstitutePolicies,
  getInstitutePolicyByType,
  refreshUserData
} from '../../controllers/auth.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { authRateLimiter } from '../../middlewares/rateLimit.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../../validators/auth.validator.js';

const router = Router();

router.post('/login', authRateLimiter, validate(loginSchema), login);
router.post('/select-account', protect, selectAccount);

// GET /auth/my-institute - Get full institute data with settings and policies
router.get('/my-institute', protect, getMyInstitute);

// GET /auth/my-policies - Get all policies for current institute
router.get('/my-policies', protect, getMyInstitutePolicies);

// GET /auth/my-policies/:policyType - Get specific policy by type
router.get('/my-policies/:policyType', protect, getInstitutePolicyByType);

// backend/src/routes/v1/auth.routes.js (Add this)

// GET /auth/refresh-data - Get latest user data after updates
router.get('/refresh-data', protect, refreshUserData);

router.get('/accounts', getAccountsByEmail);  // GET /api/v1/auth/accounts?email=xxx
router.post('/login-with-account', loginWithAccount);  // POST /api/v1/auth/login-with-account
router.post('/logout', protect, logout);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.get('/me', protect, getMe);

export default router;
