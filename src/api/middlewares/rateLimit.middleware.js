/**
 * The Clouds Academy - Rate Limiter Middleware
 */

import rateLimit from 'express-rate-limit';
import config from '../../config/index.js';

const isLocalhostRequest = (req) => {
  const ip = req.ip || req.socket?.remoteAddress || '';
  const host = req.hostname || req.get('host') || '';
  const forwardedFor = req.get('x-forwarded-for') || '';

  const ipMatches =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.endsWith('127.0.0.1') ||
    ip.startsWith('::ffff:127.0.0.1') ||
    forwardedFor.includes('127.0.0.1') ||
    forwardedFor.includes('::1');

  const hostMatches =
    host.includes('localhost') ||
    host.includes('127.0.0.1');

  return ipMatches || hostMatches;
};

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.isDevelopment ? Math.max(config.rateLimit.max, 5000) : config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => config.isDevelopment && isLocalhostRequest(req),
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
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
