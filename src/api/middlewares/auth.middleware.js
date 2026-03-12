/**
 * The Clouds Academy - Auth Middleware
 * Verifies JWT token and attaches user to request
 */

import { verifyAccessToken } from '../../config/auth.js';
import { AppError } from '../../utils/lib/AppError.js';
import catchAsync from '../../utils/lib/catchAsync.js';
import User from '../../models/postgres/User.model.js';

export const protect = catchAsync(async (req, res, next) => {
  // 1. Get token from header or cookie
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) throw new AppError('No token provided. Please login.', 401);

  // 2. Verify token
  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw new AppError('Invalid or expired token. Please login again.', 401);
  }

  // 3. Check if user still exists
  const user = await User.findByPk(decoded.userId, {
    attributes: { exclude: ['password_hash'] },
  });

  if (!user) throw new AppError('User no longer exists.', 401);
  if (!user.is_active) throw new AppError('Account is deactivated.', 403);

  // 4. Attach user to request
  req.user = user;
  req.token = token;

  next();
});

/**
 * Verify Master Admin (Platform owner)
 */
export const isMasterAdmin = catchAsync(async (req, res, next) => {
  if (req.user?.user_type !== 'MASTER_ADMIN') {
    throw new AppError('Master Admin access required.', 403);
  }
  next();
});

/**
 * Optional auth (doesn't fail if no token)
 */
export const optionalAuth = catchAsync(async (req, res, next) => {
  try {
    await protect(req, res, next);
  } catch {
    next();
  }
});

export default { protect, isMasterAdmin, optionalAuth };
