/**
 * Last line of defence against information leaks.
 *
 * Several legacy controllers answer errors directly (res.status(500).json({ message: error.message })).
 * This wraps res.json so that, unless EXPOSE_ERROR_DETAILS=true:
 *   - any 5xx body is replaced by a generic message (the original is logged server-side)
 *   - a `stack` key can never leave the server, at any status
 */
import logger from '../../config/logger.js';
import { exposeErrorDetails } from '../../utils/helpers/errorExposure.js';

const GENERIC_5XX = 'Something went wrong. Please try again.';

export const responseScrub = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (!exposeErrorDetails() && body && typeof body === 'object') {
      if (res.statusCode >= 500) {
        const original = body.message || body.error || '';
        if (original && original !== GENERIC_5XX) {
          logger.error(`💥 ${req.method} ${(req.originalUrl || '').split('?')[0]} -> ${res.statusCode}: ${typeof original === 'string' ? original : JSON.stringify(original)}`);
        }
        return originalJson({ success: false, message: GENERIC_5XX, ...(body.timestamp ? { timestamp: body.timestamp } : {}) });
      }
      if ('stack' in body) {
        const { stack, ...rest } = body;
        return originalJson(rest);
      }
    }
    return originalJson(body);
  };
  next();
};

export default responseScrub;
