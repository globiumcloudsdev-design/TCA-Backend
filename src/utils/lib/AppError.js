/**
 * The Clouds Academy - Custom Error Class
 */

export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = {
  badRequest: (msg = 'Bad request') => new AppError(msg, 400),
  unauthorized: (msg = 'Unauthorized') => new AppError(msg, 401),
  forbidden: (msg = 'Forbidden') => new AppError(msg, 403),
  notFound: (msg = 'Resource not found') => new AppError(msg, 404),
  conflict: (msg = 'Resource already exists') => new AppError(msg, 409),
  validation: (msg = 'Validation failed', errors) => {
    const err = new AppError(msg, 422);
    err.errors = errors;
    return err;
  },
  tooManyRequests: (msg = 'Too many requests') => new AppError(msg, 429),
  paymentRequired: (msg = 'Payment required') => new AppError(msg, 402),
  serverError: (msg = 'Internal server error') => new AppError(msg, 500, false),
};

export default AppError;
