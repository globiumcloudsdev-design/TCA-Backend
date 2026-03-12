/**
 * The Clouds Academy - Student Service
 *
 * Students are User records with user_type = 'STUDENT'.
 * Type-specific data (class, section, roll number, etc.) lives in
 * details.studentDetails JSONB.
 *
 * Photo from the controller is passed as photo_url / photo_public_id
 * and mapped to the User model's avatar_url / avatar_public_id fields.
 */

import User from '../models/postgres/User.model.js';
import Role from '../models/postgres/Role.model.js';
import { AppError } from '../utils/lib/AppError.js';
import { hashPassword } from '../utils/helpers/password.helper.js';
import APIFeatures from '../utils/lib/apiFeatures.js';

// ─── Create ───────────────────────────────────────────────────────────────────
export const createStudent = async (schoolId, data, createdBy) => {
  const {
    first_name,
    last_name,
    email,
    phone,
    password,
    registration_no,
    role_id,
    // Photo fields from the upload middleware
    photo_url,
    photo_public_id,
    avatar_url,
    avatar_public_id,
    // Everything else → studentDetails JSONB
    ...studentExtraFields
  } = data;

  if (!password && !data.password_hash) {
    throw new AppError('A password is required to create a student account.', 400);
  }

  const password_hash = data.password_hash || (await hashPassword(password));

  const student = await User.create({
    school_id:        schoolId,
    user_type:        'STUDENT',
    first_name,
    last_name,
    email:            email || null,
    phone:            phone || null,
    registration_no:  registration_no || null,
    role_id:          role_id || null,
    password_hash,
    avatar_url:       avatar_url || photo_url || null,
    avatar_public_id: avatar_public_id || photo_public_id || null,
    details:          { studentDetails: studentExtraFields },
    created_by:       createdBy,
  });

  return student;
};

// ─── List ─────────────────────────────────────────────────────────────────────
export const getStudents = async (schoolId, query = {}) => {
  const features = new APIFeatures(
    { school_id: schoolId, user_type: 'STUDENT' },
    query
  )
    .filter()
    .search(['first_name', 'last_name', 'registration_no', 'email'])
    .sort()
    .paginate();

  const opts = features.build();
  const { count, rows } = await User.findAndCountAll({
    ...opts,
    include: [{ model: Role, attributes: ['id', 'name', 'code'], required: false }],
  });

  return { students: rows, pagination: features.getPaginationMeta(count) };
};

// ─── Single ───────────────────────────────────────────────────────────────────
export const getStudentById = async (studentId, schoolId) => {
  const student = await User.findOne({
    where:   { id: studentId, school_id: schoolId, user_type: 'STUDENT' },
    include: [{ model: Role, attributes: ['id', 'name', 'code'], required: false }],
  });

  if (!student) throw new AppError('Student not found.', 404);
  return student;
};

// ─── Update ───────────────────────────────────────────────────────────────────
export const updateStudent = async (studentId, schoolId, data) => {
  const student = await User.findOne({
    where: { id: studentId, school_id: schoolId, user_type: 'STUDENT' },
  });
  if (!student) throw new AppError('Student not found.', 404);

  // Map photo fields to the User model field names
  const { photo_url, photo_public_id, ...rest } = data;
  const updateData = { ...rest };
  if (photo_url)        updateData.avatar_url        = photo_url;
  if (photo_public_id)  updateData.avatar_public_id  = photo_public_id;

  return student.update(updateData);
};

// ─── Soft Delete ──────────────────────────────────────────────────────────────
export const deleteStudent = async (studentId, schoolId) => {
  const student = await User.findOne({
    where: { id: studentId, school_id: schoolId, user_type: 'STUDENT' },
  });
  if (!student) throw new AppError('Student not found.', 404);

  await student.update({ is_active: false });
  return { message: 'Student deactivated successfully.' };
};

export default { createStudent, getStudents, getStudentById, updateStudent, deleteStudent };

