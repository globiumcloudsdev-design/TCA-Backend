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
  loginWithAccount
} from '../../controllers/auth.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { authRateLimiter } from '../../middlewares/rateLimit.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../../validators/auth.validator.js';

const router = Router();

router.post('/login', authRateLimiter, validate(loginSchema), login);
router.post('/select-account', protect, selectAccount);
// backend/src/routes/v1/auth.routes.js (ADD THESE)

router.get('/accounts', getAccountsByEmail);  // GET /api/v1/auth/accounts?email=xxx
router.post('/login-with-account', loginWithAccount);  // POST /api/v1/auth/login-with-account
router.post('/logout', protect, logout);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.get('/me', protect, getMe);

export default router;
