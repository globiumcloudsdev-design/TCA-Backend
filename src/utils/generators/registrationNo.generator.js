// backend/src/utils/generators/registrationNo.generator.js
/**
 * Registration Number Generator
 * 
 * Generates unique registration numbers for students
 * Format: [PREFIX][YEAR][SEQUENCE]
 * Example: STD2024001, TUT2024001
 */

import { Op } from 'sequelize';
import models from '../../models/postgres/index.js';

const { User } = models;

/**
 * Get prefix based on institute type
 */
const getPrefix = (instituteType) => {
  const prefixes = {
    school: 'STD',
    college: 'CLG',
    university: 'UNI',
    coaching: 'COA',
    academy: 'ACA',
    tuition_center: 'TUT',
  };
  return prefixes[instituteType] || 'STD';
};

/**
 * Generate registration number
 * @param {string} instituteId - Institute ID
 * @param {string} instituteType - Institute type
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Generated registration number
 */
export const generateRegistrationNo = async (instituteId, instituteType, options = {}) => {
  const prefix = options.prefix || getPrefix(instituteType);
  const year = options.year || new Date().getFullYear();
  const sequenceLength = options.sequenceLength || 4;
  
  // Find last registration number for this institute and year
  const lastStudent = await User.findOne({
    where: {
      school_id: instituteId,
      user_type: 'STUDENT',
      registration_no: {
        [Op.like]: `${prefix}${year}%`
      }
    },
    order: [['registration_no', 'DESC']],
    paranoid: false, // Include soft-deleted
    transaction: options.transaction
  });

  let nextSequence = 1;
  
  if (lastStudent && lastStudent.registration_no) {
    // Extract sequence number from last registration
    const lastSeq = parseInt(lastStudent.registration_no.slice(-sequenceLength));
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  // Pad sequence with zeros
  const paddedSeq = String(nextSequence).padStart(sequenceLength, '0');
  
  return `${prefix}${year}${paddedSeq}`;
};

/**
 * Generate registration number synchronously (for dummy data)
 */
export const generateRegistrationNoSync = (instituteType, options = {}) => {
  const prefix = options.prefix || getPrefix(instituteType);
  const year = options.year || new Date().getFullYear();
  const sequence = options.sequence || Math.floor(Math.random() * 9000 + 1000);
  
  return `${prefix}${year}${sequence}`;
};

export default {
  generateRegistrationNo,
  generateRegistrationNoSync
};