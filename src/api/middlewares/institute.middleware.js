/**
 * The Clouds Academy - Institute Middleware
 * 
 * Sets institute context from user's school_id
 * Used for routes that need institute-specific data
 */

import { AppError } from '../../utils/lib/AppError.js';
import catchAsync from '../../utils/lib/catchAsync.js';
import Institute from '../../models/postgres/Institute.model.js';

export const setInstitute = catchAsync(async (req, res, next) => {
  // Master admin ke liye institute optional hai
  if (req.user?.user_type === 'MASTER_ADMIN') {
    // Agar query mein institute_id diya ho to use karo
    if (req.query.institute_id) {
      const institute = await Institute.findByPk(req.query.institute_id);
      if (!institute) {
        throw new AppError('Institute not found', 404);
      }
      req.institute = institute;
    } else {
      req.institute = null;
    }
    return next();
  }

  // Institute users ke liye school_id mandatory hai
  if (!req.user?.school_id) {
    throw new AppError('No institute associated with this user', 400);
  }

  const institute = await Institute.findByPk(req.user.school_id);
  if (!institute) {
    throw new AppError('Institute not found', 404);
  }

  req.institute = institute;
  next();
});

// Optional institute (doesn't fail if no institute)
export const optionalInstitute = catchAsync(async (req, res, next) => {
  if (req.user?.school_id) {
    const institute = await Institute.findByPk(req.user.school_id);
    req.institute = institute || null;
  } else {
    req.institute = null;
  }
  next();
});

export default { setInstitute, optionalInstitute };