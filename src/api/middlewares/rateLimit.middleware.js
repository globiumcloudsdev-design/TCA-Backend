/**
 * The Clouds Academy - Rate Limiter Middleware
 */

import rateLimit from 'express-rate-limit';
import config from '../../config/index.js';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Strict limiter for auth routes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30, // 10 attempts
  message: { success: false, message: 'Too many login attempts. Try after 15 minutes.' },
});

// Loose limiter for public routes
export const publicRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 min
  max: 60,
  message: { success: false, message: 'Too many requests.' },
});

export default rateLimiter;
