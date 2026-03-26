

/**
 * The Clouds Academy - AcademicYear Service
 * 
 * File: /src/services/academicYear.service.js
 */

import models from '../models/postgres/index.js';
import { Op } from 'sequelize';

const { AcademicYear, sequelize } = models;

/**
 * Create academic year
 */
export const createAcademicYear = async (data, options = {}) => {
  const { transaction } = options;
  
  // Validate dates
  if (new Date(data.start_date) >= new Date(data.end_date)) {
    throw new Error('Start date must be before end date');
  }

  // If setting as current, unset any existing current year
  if (data.is_current) {
    await AcademicYear.update(
      { is_current: false },
      { 
        where: { 
          institute_id: data.institute_id,
          is_current: true 
        },
        transaction 
      }
    );
  }

  const academicYear = await AcademicYear.create(data, { transaction });
  return academicYear;
};

/**
 * Get all academic years for an institute
 */
export const getAllAcademicYears = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 10, sortBy = 'start_date', sortOrder = 'DESC' } = pagination;
  const offset = (page - 1) * limit;

  const where = { institute_id: filters.institute_id };
  
  if (filters.is_current !== undefined) {
    where.is_current = filters.is_current;
  }
  
  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  }

  const { count, rows } = await AcademicYear.findAndCountAll({
    where,
    order: [[sortBy, sortOrder]],
    limit,
    offset,
  });

  return {
    data: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    }
  };
};

/**
 * Get academic year by ID
 */
export const getAcademicYearById = async (id, instituteId) => {
  const academicYear = await AcademicYear.findOne({
    where: { id, institute_id: instituteId }
  });
  return academicYear;
};

/**
 * Update academic year
 */
export const updateAcademicYear = async (id, instituteId, updateData, options = {}) => {
  const { transaction } = options;
  
  const academicYear = await AcademicYear.findOne({
    where: { id, institute_id: instituteId }
  });
  
  if (!academicYear) {
    throw new Error('Academic year not found');
  }

  if (updateData.is_current && !academicYear.is_current) {
    await AcademicYear.update(
      { is_current: false },
      { 
        where: { 
          institute_id: instituteId,
          is_current: true 
        },
        transaction 
      }
    );
  }

  await academicYear.update(updateData, { transaction });
  return academicYear;
};

/**
 * Delete academic year
 */
export const deleteAcademicYear = async (id, instituteId, options = {}) => {
  const { transaction } = options;
  
  const academicYear = await AcademicYear.findOne({
    where: { id, institute_id: instituteId }
  });
  
  if (!academicYear) {
    throw new Error('Academic year not found');
  }

  if (academicYear.is_current) {
    throw new Error('Cannot delete current academic year');
  }

  await academicYear.destroy({ transaction });
  return { message: 'Academic year deleted successfully' };
};

/**
 * Set academic year as current
 */
export const setCurrentAcademicYear = async (id, instituteId, options = {}) => {
  const { transaction } = options;
  
  const academicYear = await AcademicYear.findOne({
    where: { id, institute_id: instituteId }
  });
  
  if (!academicYear) {
    throw new Error('Academic year not found');
  }

  await AcademicYear.update(
    { is_current: false },
    { 
      where: { 
        institute_id: instituteId,
        is_current: true 
      },
      transaction 
    }
  );

  await academicYear.update({ is_current: true }, { transaction });
  return academicYear;
};

/**
 * Get current academic year
 */
export const getCurrentAcademicYear = async (instituteId) => {
  const academicYear = await AcademicYear.findOne({
    where: { 
      institute_id: instituteId,
      is_current: true,
      is_active: true
    }
  });
  return academicYear;
};

/**
 * GET ACADEMIC YEAR OPTIONS FOR DROPDOWN
 * Yeh function frontend dropdown ke liye hai
 */
export const getAcademicYearOptions = async (instituteId, onlyActive = true) => {
  const where = { institute_id: instituteId };
  
  if (onlyActive) {
    where.is_active = true;
  }

  const academicYears = await AcademicYear.findAll({
    where,
    attributes: ['id', 'name', 'start_date', 'end_date', 'is_current', 'is_active'],
    order: [['start_date', 'DESC']],
  });

  // Format for dropdown: { value: id, label: name }
  const options = academicYears.map(year => ({
    value: year.id,
    label: year.name,
    is_current: year.is_current,
    start_date: year.start_date,
    end_date: year.end_date
  }));

  return {
    data: options,
    total: options.length
  };
};