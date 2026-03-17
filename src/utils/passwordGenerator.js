/**
 * The Clouds Academy - Password Generator
 * 
 * Generates simple numeric passwords (1-8 digits only)
 * Used for staff/teacher accounts where simple passwords are needed
 */

import crypto from 'crypto';

/**
 * Generate numeric password (1-8 digits only)
 * @param {number} length - Password length (1-8)
 * @returns {string} - Numeric password
 */
export const generateNumericPassword = (length = 6) => {
  // Ensure length is between 1 and 8
  const safeLength = Math.min(Math.max(parseInt(length) || 6, 1), 8);
  
  // Generate random number with exact digits
  const min = Math.pow(10, safeLength - 1);
  const max = Math.pow(10, safeLength) - 1;
  
  // Use crypto for secure random
  const randomBytes = crypto.randomBytes(4);
  const randomValue = randomBytes.readUInt32BE(0);
  
  // Scale to our range and ensure proper number of digits
  const password = (min + (randomValue % (max - min + 1))).toString();
  
  console.log(`✅ Generated ${safeLength}-digit numeric password`);
  return password;
};

/**
 * Generate random password (original - kept for backward compatibility)
 * @param {number} length - Password length
 * @param {boolean} includeSpecial - Include special characters
 * @returns {string} - Generated password
 */
export const generateRandomPassword = (length = 10, includeSpecial = true) => {
  // For staff/teacher accounts, use numeric by default
  if (length <= 8 && !includeSpecial) {
    return generateNumericPassword(length);
  }
  
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
 * Generate temporary password (numeric, 6 digits)
 */
export const generateTempPassword = () => {
  return generateNumericPassword(6);
};

export default {
  generateNumericPassword,
  generateRandomPassword,
  generateTempPassword
};