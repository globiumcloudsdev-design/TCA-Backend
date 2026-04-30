import User from '../models/postgres/User.model.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/lib/AppError.js';
import { v4 as uuidv4 } from 'uuid';
import { sendWelcomeEmailWithCredentials } from './email.service.js';

export const createPlatformUser = async (userData, createdBy) => {
  const { first_name, last_name, email, password, user_type, permissions } = userData;

  if (!email || !password || !first_name || !last_name) {
    throw new AppError('First name, last name, email, and password are required', 400);
  }

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw new AppError('Email is already in use', 409);
  }

  const password_hash = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    id: uuidv4(),
    first_name,
    last_name,
    email,
    password_hash,
    user_type: user_type || 'SUPPORT_STAFF',
    school_id: null, // Platform level user
    branch_id: null,
    permissions: permissions || [],
    created_by: createdBy,
    is_active: true,
  });

  // Send email asynchronously without awaiting to block response
  sendWelcomeEmailWithCredentials(newUser, password, 'The Clouds Academy (Platform)', null, user_type || 'Support Staff').catch(err => {
    console.error('Failed to send welcome email:', err);
  });

  return newUser;
};
