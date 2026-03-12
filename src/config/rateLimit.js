/**
 * The Clouds Academy - Rate Limit Config
 */

import rateLimit from 'express-rate-limit';
import config from './index.js';

export const rateLimitConfig = {
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
};

export default rateLimitConfig;
