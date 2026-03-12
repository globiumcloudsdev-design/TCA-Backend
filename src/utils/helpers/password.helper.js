/**
 * The Clouds Academy - Password Helper (bcryptjs)
 */

import bcrypt from 'bcryptjs';
import config from '../../config/index.js';

export const hashPassword = async (password) => {
  return bcrypt.hash(password, config.bcrypt.saltRounds);
};

export const comparePassword = async (plain, hashed) => {
  return bcrypt.compare(plain, hashed);
};

export default { hashPassword, comparePassword };
