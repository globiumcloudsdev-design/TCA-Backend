/**
 * The Clouds Academy - Standard Response Helper
 */
import logger from '../../config/logger.js';
import { exposeErrorDetails } from './errorExposure.js';

/**
 * Best HTTP status for a thrown error: an explicit statusCode (AppError) wins,
 * otherwise common service messages map to 404/403 instead of a blanket 500 (B32).
 */
export const errorStatus = (error, fallback = 500) => {
  if (error?.statusCode) return error.statusCode;
  const msg = String(error?.message || '');
  if (/not found/i.test(msg)) return 404;
  if (/not authorized|unauthorized|do not teach|not assigned|access denied|forbidden|not allowed/i.test(msg)) return 403;
  return fallback;
};

export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data, timestamp: new Date().toISOString() });

export const sendCreated = (res, data, message = 'Created successfully') =>
  res.status(201).json({ success: true, message, data, timestamp: new Date().toISOString() });

export const sendPaginated = (res, data, pagination, message = 'Success') =>
  res.status(200).json({ success: true, message, data, pagination, timestamp: new Date().toISOString() });

export const sendNoContent = (res) => res.status(204).send();

export const sendError = (res, message = 'Error', statusCode = 500, errors = null) => {
  // 5xx: never leak internal messages (SQL, paths, ...) unless EXPOSE_ERROR_DETAILS=true; log them instead
  if (statusCode >= 500 && !exposeErrorDetails()) {
    logger.error(`💥 ${res.req?.method || ''} ${(res.req?.originalUrl || '').split('?')[0]} -> ${statusCode}: ${message}`);
    return res.status(statusCode).json({ success: false, message: 'Something went wrong. Please try again.', timestamp: new Date().toISOString() });
  }
  const payload = { success: false, message, timestamp: new Date().toISOString() };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

export const sendBadRequest = (res, message = 'Bad request', errors = null) =>
  sendError(res, message, 400, errors);

export const sendUnauthorized = (res, message = 'Unauthorized') =>
  sendError(res, message, 401);

export const sendForbidden = (res, message = 'Access forbidden') =>
  sendError(res, message, 403);

export const sendNotFound = (res, message = 'Not found') =>
  sendError(res, message, 404);

export const sendConflict = (res, message = 'Already exists') =>
  sendError(res, message, 409);

export const sendValidationError = (res, errors, message = 'Validation failed') =>
  sendError(res, message, 422, errors);

export default {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendNoContent,
  sendError,
  sendBadRequest,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendValidationError,
};
