/**
 * The Clouds Academy - 404 Not Found Middleware
 */

import { AppError } from '../../utils/lib/AppError.js';

export const notFound = (req, res, next) => {
  // Do not echo the URL/query string back (information leak / reflected content)
  next(new AppError('The requested endpoint does not exist.', 404));
};

export default notFound;
