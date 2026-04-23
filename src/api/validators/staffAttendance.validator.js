// backend/src/validators/staffAttendance.validator.js
import Joi from 'joi';

export const createAttendanceSchema = Joi.object({
  staff_id: Joi.string().uuid().required(),
  date: Joi.date().iso().required(),
  status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HOLIDAY', 'WEEKEND').default('PRESENT'),
  check_in: Joi.date().iso().allow(null),
  check_out: Joi.date().iso().allow(null),
  late_minutes: Joi.number().integer().min(0).default(0),
  early_exit_minutes: Joi.number().integer().min(0).default(0),
  overtime_minutes: Joi.number().integer().min(0).default(0),
  leave_type_id: Joi.string().uuid().allow(null),
  leave_request_id: Joi.string().uuid().allow(null),
  remarks: Joi.string().allow(''),
  branch_id: Joi.string().uuid().allow(null),
});

export const updateAttendanceSchema = Joi.object({
  status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HOLIDAY', 'WEEKEND'),
  check_in: Joi.date().iso().allow(null),
  check_out: Joi.date().iso().allow(null),
  late_minutes: Joi.number().integer().min(0),
  early_exit_minutes: Joi.number().integer().min(0),
  overtime_minutes: Joi.number().integer().min(0),
  leave_type_id: Joi.string().uuid().allow(null),
  remarks: Joi.string().allow(''),
});