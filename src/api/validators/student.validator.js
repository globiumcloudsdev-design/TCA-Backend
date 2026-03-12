/**
 * The Clouds Academy - Student Validators
 */

import Joi from 'joi';

export const createStudentSchema = Joi.object({
  first_name: Joi.string().min(2).max(100).required(),
  last_name: Joi.string().min(2).max(100).required(),
  class_id: Joi.string().uuid(),
  roll_number: Joi.string().max(50),
  gr_number: Joi.string().max(50),
  date_of_birth: Joi.date().iso(),
  gender: Joi.string().valid('male', 'female', 'other'),
  blood_group: Joi.string().max(5),
  religion: Joi.string().max(50),
  address: Joi.string().max(500),
  city: Joi.string().max(100),
  emergency_contact: Joi.string().max(20),
  admission_date: Joi.date().iso(),
});

export const updateStudentSchema = createStudentSchema.fork(
  ['first_name', 'last_name'],
  (s) => s.optional()
);

export default { createStudentSchema, updateStudentSchema };
