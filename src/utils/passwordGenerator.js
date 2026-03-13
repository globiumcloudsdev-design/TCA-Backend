// backend/src/utils/passwordGenerator.js

import crypto from 'crypto';

/**
 * Generate random password
 * @param {number} length - Password length
 * @param {boolean} includeSpecial - Include special characters
 * @returns {string} - Generated password
 */
export const generateRandomPassword = (length = 10, includeSpecial = true) => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  
  let chars = uppercase + lowercase + numbers;
  if (includeSpecial) chars += special;
  
  let password = '';
  const bytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  
  return password;
};

/**
 * Generate temporary password (simpler)
 */
export const generateTempPassword = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

export default {
  generateRandomPassword,
  generateTempPassword
};