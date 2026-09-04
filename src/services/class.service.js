// backend/src/api/services/class.service.js

import { Op } from 'sequelize';
import models from '../models/postgres/index.js';
import { v4 as uuidv4 } from 'uuid';

const { Class } = models;

/**
 * CREATE Complete Class
 */
export const createCompleteClass = async (data, options = {}) => {
  const { transaction } = options;

  const duplicateWhere = {
    school_id: data.institute_id,
    academic_year_id: data.academic_year_id,
    name: data.name
  };
  if (data.branch_id) {
    duplicateWhere.branch_id = data.branch_id;
  }

  // Check duplicate
  const existing = await Class.findOne({
    where: duplicateWhere
  });

  if (existing) {
    throw new Error('Class with this name already exists');
  }

  // Prepare sections with UUIDs
  const sections = (data.sections || []).map(s => ({
    id: uuidv4(),
    name: s.name,
    room_no: s.room_no || null,
    capacity: s.capacity ? Number(s.capacity) : null,
    is_active: s.active === true || s.active === 'true',
    created_at: new Date()
  }));

  // Prepare courses with materials
  const courses = (data.courses || []).map(course => ({
    id: uuidv4(),
    name: course.name,
    course_code: course.course_code || '',
    description: course.description || '',
    is_active: course.active === true || course.active === 'true',
    materials: (course.materials || []).map(m => ({
      id: uuidv4(),
      name: m.name,
      description: m.description || '',
      pdf_url: m.pdf_url || null,
      is_active: m.active === true || m.active === 'true',
      created_at: new Date()
    })),
    created_at: new Date()
  }));

  // Create class
  const classData = {
    id: uuidv4(),
    school_id: data.institute_id,
    branch_id: data.branch_id || null,
    academic_year_id: data.academic_year_id,
    name: data.name,
    description: data.description || '',
    is_active: data.is_active !== false,
    sections: sections,
    courses: courses,
    created_at: new Date(),
    updated_at: new Date()
  };

  const newClass = await Class.create(classData, { transaction });
  return newClass;
};

/**
 * UPDATE Complete Class
 */
export const updateCompleteClass = async (id, instituteId, updateData, options = {}) => {
  const { transaction } = options;

  const classData = await Class.findOne({
    where: { id, school_id: instituteId }
  });

  if (!classData) {
    throw new Error('Class not found');
  }

  // Update basic fields
  if (updateData.name !== undefined) classData.name = updateData.name;
  if (updateData.description !== undefined) classData.description = updateData.description || '';
  if (updateData.academic_year_id !== undefined) classData.academic_year_id = updateData.academic_year_id;
  if (updateData.is_active !== undefined) {
    classData.is_active = updateData.is_active === true || updateData.is_active === 'true';
  }

  // Update sections if provided
  if (updateData.sections !== undefined) {
    const existingSections = classData.sections || [];
    const existingMap = {};
    existingSections.forEach(s => { existingMap[s.id] = s; });

    const mergedSections = updateData.sections.map(s => {
      if (s.id && existingMap[s.id]) {
        // Update existing
        return {
          ...existingMap[s.id],
          name: s.name ?? existingMap[s.id].name,
          room_no: s.room_no !== undefined ? s.room_no : existingMap[s.id].room_no,
          capacity: s.capacity !== undefined ? s.capacity : existingMap[s.id].capacity,
          is_active: s.active !== undefined ? Boolean(s.active) : existingMap[s.id].is_active,
          updated_at: new Date()
        };
      } else {
        // New section
        return {
          id: uuidv4(),
          name: s.name,
          room_no: s.room_no || null,
          capacity: s.capacity ? Number(s.capacity) : null,
          is_active: s.active !== undefined ? Boolean(s.active) : true,
          created_at: new Date(),
          updated_at: new Date()
        };
      }
    });

    classData.sections = mergedSections;
    classData.changed('sections', true);
  }

  // Update courses if provided
  if (updateData.courses !== undefined) {
    const existingCourses = classData.courses || [];
    const existingCourseMap = {};
    existingCourses.forEach(c => { existingCourseMap[c.id] = c; });

    const mergedCourses = updateData.courses.map(newCourse => {
      if (newCourse.id && existingCourseMap[newCourse.id]) {
        const existing = existingCourseMap[newCourse.id];

        // Handle materials
        const existingMaterialMap = {};
        (existing.materials || []).forEach(m => { existingMaterialMap[m.id] = m; });

        const mergedMaterials = (newCourse.materials || []).map(m => {
          if (m.id && existingMaterialMap[m.id]) {
            return {
              ...existingMaterialMap[m.id],
              name: m.name ?? existingMaterialMap[m.id].name,
              description: m.description !== undefined ? m.description : existingMaterialMap[m.id].description,
              is_active: m.active !== undefined ? Boolean(m.active) : existingMaterialMap[m.id].is_active,
              pdf_url: m.pdf_url !== undefined ? m.pdf_url : existingMaterialMap[m.id].pdf_url,
              updated_at: new Date()
            };
          } else {
            return {
              id: uuidv4(),
              name: m.name || '',
              description: m.description || '',
              is_active: m.active !== undefined ? Boolean(m.active) : true,
              pdf_url: m.pdf_url || null,
              created_at: new Date(),
              updated_at: new Date()
            };
          }
        });

        return {
          ...existing,
          name: newCourse.name ?? existing.name,
          course_code: newCourse.course_code !== undefined ? newCourse.course_code : existing.course_code,
          description: newCourse.description !== undefined ? newCourse.description : existing.description,
          is_active: newCourse.active !== undefined ? Boolean(newCourse.active) : existing.is_active,
          materials: mergedMaterials,
          updated_at: new Date()
        };
      } else {
        // New course
        return {
          id: uuidv4(),
          name: newCourse.name,
          course_code: newCourse.course_code || '',
          description: newCourse.description || '',
          is_active: newCourse.active !== undefined ? Boolean(newCourse.active) : true,
          materials: (newCourse.materials || []).map(m => ({
            id: uuidv4(),
            name: m.name || '',
            description: m.description || '',
            is_active: m.active !== undefined ? Boolean(m.active) : true,
            pdf_url: m.pdf_url || null,
            created_at: new Date(),
            updated_at: new Date()
          })),
          created_at: new Date(),
          updated_at: new Date()
        };
      }
    });

    classData.courses = mergedCourses;
    classData.changed('courses', true);
  }

  classData.updated_at = new Date();
  await classData.save({ transaction });
  return classData;
};

// Other service functions (getAll, getById, delete)...
export const getAllClasses = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const where = { school_id: filters.institute_id };
  if (filters.branch_id) where.branch_id = filters.branch_id;
  if (filters.academic_year_id) where.academic_year_id = filters.academic_year_id;
  
  if (filters.search) {
    where.name = { [Op.iLike]: `%${filters.search}%` };
  }
  
  if (filters.status !== undefined && filters.status !== '') {
    where.is_active = filters.status === 'active' || filters.status === 'true' || filters.status === true;
  } else if (filters.is_active !== undefined && filters.is_active !== '') {
    where.is_active = filters.is_active === 'active' || filters.is_active === 'true' || filters.is_active === true;
  }

  const { count, rows } = await Class.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset
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

export const getClassOptions = async (instituteId, academicYearId, branchId = null) => {
  const where = {
    school_id: instituteId,
    is_active: true
  };

  if (branchId) {
    where.branch_id = branchId;
  }

  if (academicYearId) {
    where.academic_year_id = academicYearId;
  }

  const classes = await Class.findAll({
    where,
    attributes: ['id', 'name', 'sections'],
    order: [['name', 'ASC']]
  });

  return classes.map((c) => ({
    value: c.id,
    label: c.name,
    sections: c.sections || []
  }));
};

export const getClassById = async (id, instituteId, branchId = null) => {
  const where = { id, school_id: instituteId };
  if (branchId) where.branch_id = branchId;
  return await Class.findOne({ where });
};

export const deleteClass = async (id, instituteId, branchId = null) => {
  const where = { id, school_id: instituteId };
  if (branchId) where.branch_id = branchId;
  const classData = await Class.findOne({ where });
  
  if (!classData) throw new Error('Class not found');
  await classData.destroy();
  return { message: 'Class deleted successfully' };
};