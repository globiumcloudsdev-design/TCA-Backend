/**
 * The Clouds Academy - Joi Validation Middleware
 */

import { AppError } from '../../utils/lib/AppError.js';

/**
 * Validate request body with a Joi schema
 * @param {object} schema - Joi schema
 * @param {string} property - 'body' | 'query' | 'params'
 */
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], { abortEarly: false });
    if (!error) return next();

    const errors = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message.replace(/['"]/g, ''),
    }));

    const err = new AppError('Validation failed', 422);
    err.errors = errors;
    next(err);
  };
};

export default validate;
