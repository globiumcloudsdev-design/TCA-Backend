/**
 * The Clouds Academy - Global Error Handler Middleware
 *
 * Centralized error handling for all thrown errors.
 * Handles Sequelize errors, JWT errors, and custom AppErrors.
 */

import { AppError } from '../../utils/lib/AppError.js';
import logger from '../../config/logger.js';

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
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  } else {
    // Programming/unknown errors - don't leak details
    logger.error('💥 CRITICAL ERROR:', err);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
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
    error = new AppError(error.message || 'Server error', error.statusCode || 500, false);
  }

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

export default errorHandler;
