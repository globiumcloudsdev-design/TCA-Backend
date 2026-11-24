/**
 * The Clouds Academy - Global Error Handler Middleware
 *
 * Centralized error handling for all thrown errors.
 * Handles Sequelize errors, JWT errors, and custom AppErrors.
 */

import { AppError } from '../../utils/lib/AppError.js';
import logger from '../../config/logger.js';
import { errorStatus } from '../../utils/helpers/response.helper.js';

/**
 * Handle Sequelize unique constraint violations
 */
const handleSequelizeUniqueError = (err) => {
  const field = err.errors?.[0]?.path || 'field';
  return new AppError(`${field} already exists.`, 409);
};

/**
 * Handle Sequelize validation errors
 */
const handleSequelizeValidationError = (err) => {
  const errors = err.errors.map((e) => ({ field: e.path, message: e.message }));
  const appErr = new AppError('Validation failed', 422);
  appErr.errors = errors;
  return appErr;
};

/**
 * Handle JWT invalid signature
 */
const handleJWTError = () => new AppError('Invalid token. Please login again.', 401);

/**
 * Handle JWT expired token
 */
const handleJWTExpiredError = () => new AppError('Token expired. Please login again.', 401);

/**
 * Send error in development (full details)
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    success: false,
    status: err.status,
    message: err.message,
    errors: err.errors || err.details, // Joi puts details in error.details
    stack: err.stack,
  });
};

/**
 * Send error in production (limited info)
 */
const GENERIC_5XX = 'Something went wrong. Please try again.';

const sendErrorProd = (err, req, res) => {
  const status = err.statusCode || 500;
  if (status >= 500 || !err.isOperational) {
    // Never expose internals (messages, stack, paths, SQL): log server-side, answer generically
    logger.error(`💥 ${req.method} ${req.originalUrl.split('?')[0]} -> ${status}: ${err.message}`, { stack: err.stack });
    return res.status(status >= 500 ? status : 500).json({ success: false, message: GENERIC_5XX });
  }
  // 4xx operational errors: human-readable message (and Joi-style field errors) are safe to show
  return res.status(status).json({
    success: false,
    message: err.message,
    ...(err.errors ? { errors: err.errors } : {}),
  });
};

export const errorHandler = (err, req, res, next) => {
  let error = err; // Use direct reference to keep the prototype chain
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.isOperational = err.isOperational ?? false;

  // Sequelize errors
  if (err.name === 'SequelizeUniqueConstraintError') error = handleSequelizeUniqueError(err);
  if (err.name === 'SequelizeValidationError') error = handleSequelizeValidationError(err);

  // JWT errors
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  // Not an AppError — wrap it
  if (!(error instanceof AppError)) {
    const status = errorStatus(error, error.statusCode || 500);
    // 4xx mapped from a plain Error message is safe to show (operational); 5xx stays generic
    error = new AppError(error.message || 'Server error', status, status < 500);
  }

  // Stack traces / details ONLY when NODE_ENV is explicitly 'development'.
  // Anything else (production, unset on Render, test, ...) gets the safe response.
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

export default errorHandler;
