/**
 * The Clouds Academy - Auth Validators (Joi)
 */

import Joi from 'joi';

export const loginSchema = Joi.object({
  email: Joi.string().required().messages({
    'any.required': 'Email or registration number is required',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'any.required': 'Password is required',
  }),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base': 'Password must have uppercase, lowercase and a number',
    }),
});

export default { loginSchema, forgotPasswordSchema, resetPasswordSchema };
