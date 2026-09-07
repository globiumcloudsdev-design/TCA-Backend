// backend/src/api/services/class.service.js

import { Op } from 'sequelize';
import models from '../models/postgres/index.js';
import { v4 as uuidv4 } from 'uuid';

const { Class, User } = models;

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

/**
 * Helper to compute and attach active student counts to classes and their sections
 * @param {Array|Object} classes - List of class models/objects or single class
 * @param {Object} options - { instituteId, branchId, academicYearId }
 * @returns {Promise<Array|Object>} Enriched classes with student_count and section.student_count
 */
export const attachStudentCountsToClasses = async (classes, { instituteId, branchId = null, academicYearId = null } = {}) => {
  if (!classes) return classes;

  const isArray = Array.isArray(classes);
  const classList = isArray ? classes : [classes];
  if (classList.length === 0) return classes;

  const studentWhere = {
    school_id: instituteId,
    user_type: 'STUDENT',
    is_active: true,
  };
  if (branchId) {
    studentWhere.branch_id = branchId;
  }

  // Efficient single-query fetch of active student metadata
  const students = await User.findAll({
    where: studentWhere,
    attributes: ['id', 'school_id', 'branch_id', 'details'],
    raw: true,
  });

  const enriched = classList.map((cls) => {
    const classObj = typeof cls?.toJSON === 'function' ? cls.toJSON() : { ...cls };
    const classId = String(classObj.id || '');
    const classAyId = classObj.academic_year_id ? String(classObj.academic_year_id) : null;
    const targetAyId = academicYearId ? String(academicYearId) : classAyId;

    const sections = Array.isArray(classObj.sections) ? classObj.sections : [];
    const secCounts = {};
    sections.forEach((s) => {
      const secId = String(s.id || s.section_id || '');
      if (secId) secCounts[secId] = 0;
    });

    let classCount = 0;

    for (const st of students) {
      const d = st.details?.studentDetails || st.details?.student_details || st.details || {};
      if (d.is_alumni) continue;

      const sessions = Array.isArray(d.academicSessions)
        ? d.academicSessions
        : (Array.isArray(st.details?.academicSessions) ? st.details.academicSessions : []);

      const active = sessions.find((s) => s && String(s.status || '').toLowerCase() === 'active');

      let sClassId, sSectionId, sSectionName, sAyId;
      if (active) {
        sClassId = active.class_id || d.class_id;
        sSectionId = active.section_id || d.section_id;
        sSectionName = active.section_name || d.section_name;
        sAyId = active.academic_year_id || d.academic_year_id;
      } else if (sessions.length === 0) {
        sClassId = d.class_id;
        sSectionId = d.section_id;
        sSectionName = d.section_name;
        sAyId = d.academic_year_id;
      } else {
        // Has sessions, none active
        continue;
      }

      if (!sClassId || String(sClassId) !== classId) continue;

      // Filter by academic year
      if (targetAyId && sAyId && String(sAyId) !== targetAyId) continue;

      classCount++;

      // Section matching: by ID first, then by name, then fallback to single section if only 1 section exists
      let matchedSec = sections.find((s) => {
        const sid = String(s.id || s.section_id || '');
        return sid && sid === String(sSectionId);
      });

      if (!matchedSec && sSectionName) {
        const normName = String(sSectionName).trim().toLowerCase();
        matchedSec = sections.find((s) => String(s.name || '').trim().toLowerCase() === normName);
      }

      if (!matchedSec && sections.length === 1) {
        matchedSec = sections[0];
      }

      if (!matchedSec && sections.length > 0) {
        matchedSec = sections[0];
      }

      if (matchedSec) {
        const mid = String(matchedSec.id || matchedSec.section_id || '');
        if (mid) {
          secCounts[mid] = (secCounts[mid] || 0) + 1;
        }
      }
    }

    classObj.student_count = classCount;
    classObj.total_students = classCount;

    if (sections.length > 0) {
      classObj.sections = sections.map((s) => {
        const sid = String(s.id || s.section_id || '');
        const count = secCounts[sid] || 0;
        return {
          ...s,
          student_count: count,
          total_students: count,
        };
      });
    }

    return classObj;
  });

  return isArray ? enriched : enriched[0];
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

  const enrichedRows = await attachStudentCountsToClasses(rows, {
    instituteId: filters.institute_id,
    branchId: filters.branch_id,
    academicYearId: filters.academic_year_id,
  });

  return {
    data: enrichedRows,
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
    attributes: ['id', 'name', 'academic_year_id', 'sections'],
    order: [['name', 'ASC']]
  });

  const enrichedClasses = await attachStudentCountsToClasses(classes, {
    instituteId,
    branchId,
    academicYearId,
  });

  return (enrichedClasses || []).map((c) => ({
    value: c.id,
    label: c.name,
    student_count: c.student_count || 0,
    total_students: c.student_count || 0,
    sections: c.sections || []
  }));
};

export const getClassById = async (id, instituteId, branchId = null) => {
  const where = { id, school_id: instituteId };
  if (branchId) where.branch_id = branchId;
  const classData = await Class.findOne({ where });
  if (!classData) return null;

  return await attachStudentCountsToClasses(classData, {
    instituteId,
    branchId,
    academicYearId: classData.academic_year_id,
  });
};

export const deleteClass = async (id, instituteId, branchId = null) => {
  const where = { id, school_id: instituteId };
  if (branchId) where.branch_id = branchId;
  const classData = await Class.findOne({ where });
  
  if (!classData) throw new Error('Class not found');
  await classData.destroy();
  return { message: 'Class deleted successfully' };
};