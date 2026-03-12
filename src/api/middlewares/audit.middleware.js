/**
 * The Clouds Academy - Audit Log Middleware
 *
 * Logs every mutating request (POST, PUT, PATCH, DELETE)
 * to an audit trail for accountability.
 */

import logger from '../../config/logger.js';

export const auditLog = (req, res, next) => {
  const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!methods.includes(req.method)) return next();

  const original = res.json.bind(res);

  res.json = function (data) {
    if (res.statusCode < 400) {
      logger.info(
        `[AUDIT] ${req.method} ${req.originalUrl} | User: ${req.user?.id || 'anonymous'} | School: ${req.school?.id || 'N/A'} | Branch: ${req.branch_id || 'N/A'} | Status: ${res.statusCode}`
      );
    }
    return original(data);
  };

  next();
};

export default auditLog;
