/**
 * The Clouds Academy - Section Service
 *
 * Sections are the physical/logical subdivisions of a Class for a specific
 * Academic Year  (e.g., Class 5 → Section A capacity 30, Room 101).
 *
 * Business Rules:
 *  1. A school must have `has_branches` logic checked at class level, not here.
 *  2. Section names must be unique within the same class + academic year.
 *  3. Total enrolled students must not exceed section capacity.
 */

import { Op } from 'sequelize';
import models from '../models/postgres/index.js';
import AppError from '../utils/lib/AppError.js';

const { Section, Class, AcademicYear, User, School } = models;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — ensure class belongs to this school
// ─────────────────────────────────────────────────────────────────────────────
const verifyClass = async (schoolId, classId) => {
  const cls = await Class.findOne({ where: { id: classId, school_id: schoolId } });
  if (!cls) throw AppError.notFound('Class not found');
  return cls;
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────
export const createSection = async (schoolId, classId, data) => {
  await verifyClass(schoolId, classId);

  // Validate academic year belongs to school
  const yearExists = await AcademicYear.findOne({
    where: { id: data.academic_year_id, school_id: schoolId },
  });
  if (!yearExists) throw AppError.badRequest('Academic year not found for this school');

  const section = await Section.create({
    ...data,
    class_id: classId,
    school_id: schoolId,
  });

  return section;
};

// ─────────────────────────────────────────────────────────────────────────────
// READ ALL sections of a class (optionally filter by academic year)
// ─────────────────────────────────────────────────────────────────────────────
export const getSections = async (schoolId, classId, filters = {}) => {
  await verifyClass(schoolId, classId);

  const where = { class_id: classId, school_id: schoolId };
  if (filters.academic_year_id) where.academic_year_id = filters.academic_year_id;
  if (filters.is_active !== undefined) where.is_active = filters.is_active;
  if (filters.branch_id) where.branch_id = filters.branch_id;

  const sections = await Section.findAll({
    where,
    include: [
      { association: 'AcademicYear', attributes: ['id', 'name', 'is_current'] },
      { association: 'SectionTeacher', attributes: ['id', 'first_name', 'last_name'] },
    ],
    order: [['name', 'ASC']],
  });

  // Enrich with enrolled student count
  const enriched = await Promise.all(
    sections.map(async (sec) => {
      const enrolled = await User.count({
        where: {
          user_type: 'STUDENT',
          school_id: schoolId,
          is_active: true,
          details: { [Op.contains]: { studentDetails: { section_id: sec.id } } },
        },
      });
      return { ...sec.toJSON(), enrolled_count: enrolled };
    })
  );

  return enriched;
};

// ─────────────────────────────────────────────────────────────────────────────
// READ ONE
// ─────────────────────────────────────────────────────────────────────────────
export const getSectionById = async (schoolId, classId, sectionId) => {
  await verifyClass(schoolId, classId);

  const section = await Section.findOne({
    where: { id: sectionId, class_id: classId, school_id: schoolId },
    include: [
      { association: 'AcademicYear', attributes: ['id', 'name', 'is_current'] },
      { association: 'SectionTeacher', attributes: ['id', 'first_name', 'last_name', 'employee_id'] },
    ],
  });

  if (!section) throw AppError.notFound('Section not found');

  const enrolled = await User.count({
    where: {
      user_type: 'STUDENT',
      school_id: schoolId,
      is_active: true,
      details: { [Op.contains]: { studentDetails: { section_id: sectionId } } },
    },
  });
  return { ...section.toJSON(), enrolled_count: enrolled };
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────
export const updateSection = async (schoolId, classId, sectionId, data) => {
  const section = await getSectionById(schoolId, classId, sectionId);

  // If reducing capacity, check enrolled count
  if (data.capacity !== undefined && data.capacity < section.enrolled_count) {
    throw AppError.badRequest(
      `Cannot reduce capacity to ${data.capacity}: ${section.enrolled_count} students are already enrolled.`
    );
  }

  const sectionRecord = await Section.findByPk(sectionId);
  await sectionRecord.update(data);
  return sectionRecord.reload();
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE (soft delete — only if no students enrolled)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteSection = async (schoolId, classId, sectionId) => {
  const section = await getSectionById(schoolId, classId, sectionId);

  if (section.enrolled_count > 0) {
    throw AppError.badRequest(
      `Cannot delete: ${section.enrolled_count} student(s) are enrolled in this section.`
    );
  }

  const sectionRecord = await Section.findByPk(sectionId);
  await sectionRecord.destroy();
  return { message: 'Section deleted successfully' };
};
