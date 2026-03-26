// backend/src/utils/generators/rollNo.generator.js
/**
 * Roll Number Generator
 * 
 * Generates roll numbers for students within a class/section
 * Format: [CLASS_CODE][SECTION_CODE][SEQUENCE]
 * Example: 9A001, BSCS-A-001
 */

import { Op } from 'sequelize';
import models from '../../models/postgres/index.js';

const { User } = models;

/**
 * Generate class code from class name
 */
const getClassCode = (className) => {
  if (!className) return 'XX';
  
  // Remove extra spaces and get first letters
  const words = className.trim().split(/\s+/);
  if (words.length === 1) {
    // Single word class name: take first 2 chars
    return words[0].slice(0, 2).toUpperCase();
  } else {
    // Multiple words: take first letter of each word
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
};

/**
 * Generate roll number
 * @param {string} instituteId - Institute ID
 * @param {string} classId - Class/Batch/Program ID
 * @param {string} sectionId - Section/Group/Semester ID
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Generated roll number
 */
export const generateRollNo = async (instituteId, classId, sectionId, options = {}) => {
  const {
    classCode,
    sectionCode,
    sequenceLength = 3,
    separator = '',
    year = new Date().getFullYear().toString().slice(-2)
  } = options;

  // Get class and section names from database
  // This would need to fetch from Class and Section models
  // For now, using provided codes or defaults
  
  const finalClassCode = classCode || `C${classId?.slice(-2) || 'XX'}`;
  const finalSectionCode = sectionCode || `S${sectionId?.slice(-2) || 'X'}`;
  
  // Find last roll number in this class/section
  const lastStudent = await User.findOne({
    where: {
      school_id: instituteId,
      user_type: 'STUDENT',
      'details.studentDetails.class_id': classId,
      'details.studentDetails.section_id': sectionId,
    },
    order: [['created_at', 'DESC']]
  });

  let nextSequence = 1;
  
  if (lastStudent && lastStudent.details?.studentDetails?.roll_no) {
    const lastRoll = lastStudent.details.studentDetails.roll_no;
    // Extract sequence from last roll number (last n digits)
    const lastSeq = parseInt(lastRoll.slice(-sequenceLength));
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  const paddedSeq = String(nextSequence).padStart(sequenceLength, '0');
  
  return `${finalClassCode}${separator}${finalSectionCode}${separator}${year}${paddedSeq}`;
};

/**
 * Generate roll number from class info object
 */
export const generateRollNoFromClassInfo = async (instituteId, classInfo) => {
  const { class_id, section_id, academic_year_id } = classInfo;
  
  // Get academic year code from year
  const year = academic_year_id?.slice(-2) || new Date().getFullYear().toString().slice(-2);
  
  return generateRollNo(instituteId, class_id, section_id, { year });
};

export default {
  generateRollNo,
  generateRollNoFromClassInfo
};