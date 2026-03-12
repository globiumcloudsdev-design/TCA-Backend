/**
 * The Clouds Academy - 404 Not Found Middleware
 */

import { AppError } from '../../utils/lib/AppError.js';

export const notFound = (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
};

export default notFound;
