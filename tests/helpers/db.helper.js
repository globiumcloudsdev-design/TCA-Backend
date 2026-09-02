import { v4 as uuidv4 } from 'uuid';
import models, { sequelize } from '../../src/models/postgres/index.js';
import { hashPassword } from '../../src/utils/helpers/password.helper.js';

export const uniqueCode = (prefix = 'T') => `${prefix}${Math.random().toString(36).substring(2, 6).toUpperCase()}${Date.now().toString().slice(-7)}`;
export const uniqueId = (prefix = 'test') => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
export const uniqueEmail = (prefix = 'user') => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@example.com`;

/**
 * Ensures an InstituteType exists
 */
export const getOrCreateInstituteType = async () => {
  let type = await models.InstituteType.findOne();
  if (!type) {
    type = await models.InstituteType.create({
      name: 'School',
      slug: `school_${Date.now()}`,
      description: 'Standard K-12 School',
      icon: '🏫',
      is_active: true,
      sort_order: 1,
    });
  }
  return type;
};

/**
 * Ensures a template Role exists
 */
export const getOrCreateTemplateRole = async () => {
  let role = await models.Role.findOne({ where: { school_id: null, is_template: true } });
  if (!role) {
    role = await models.Role.create({
      school_id: null,
      name: 'Standard Institute Role',
      code: uniqueCode('R'),
      description: 'Default institute template role',
      permissions: {
        instituteAdmin: ['ALL'],
        branchAdmin: ['ALL'],
        teacher: ['ALL'],
        student: ['ALL'],
        parent: ['ALL'],
        staff: ['ALL'],
      },
      is_template: true,
      is_active: true,
    });
  }
  return role;
};

/**
 * Creates an Institute for testing
 */
export const createTestInstitute = async (overrides = {}) => {
  const code = uniqueCode('IN');
  const instType = overrides.institute_type_id ? { id: overrides.institute_type_id } : await getOrCreateInstituteType();
  const instRole = overrides.institute_role_id ? { id: overrides.institute_role_id } : await getOrCreateTemplateRole();

  const institute = await models.Institute.create({
    institute_name: overrides.institute_name || `Test Academy ${code}`,
    institute_code: overrides.institute_code || code,
    institute_email: overrides.institute_email || uniqueEmail('institute'),
    institute_contact: overrides.institute_contact || '+1234567890',
    institute_type_id: instType.id,
    institute_address: overrides.institute_address || '123 Education Lane',
    institute_city: overrides.institute_city || 'Islamabad',
    institute_country: overrides.institute_country || 'Pakistan',
    principal_name: overrides.principal_name || 'Principal John Doe',
    principal_email: overrides.principal_email || uniqueEmail('principal'),
    principal_phone: overrides.principal_phone || '+1234567891',
    institute_role_id: instRole.id,
    is_active: overrides.is_active ?? true,
    subscription_status: overrides.subscription_status || 'active',
    settings: overrides.settings || {
      has_branches: true,
      enable_parent_portal: true,
      enable_teacher_portal: true,
      enable_student_portal: true,
      enable_sms_notifications: false,
    },
    ...overrides,
  });
  return institute;
};

/**
 * Creates a Branch for an Institute
 */
export const createTestBranch = async (instituteId, overrides = {}) => {
  const code = uniqueCode('BR');
  const branch = await models.Branch.create({
    institute_id: instituteId,
    name: overrides.name || `Main Branch ${code}`,
    code: overrides.code || code,
    phone: overrides.phone || '+1234567890',
    email: overrides.email || uniqueEmail('branch'),
    address: overrides.address || '456 Campus Road',
    city: overrides.city || 'Islamabad',
    is_active: overrides.is_active ?? true,
    is_main: overrides.is_main ?? false,
    ...overrides,
  });
  return branch;
};

/**
 * Creates a User for testing
 */
export const createTestUser = async (overrides = {}) => {
  const password = overrides.password || 'Test@123456';
  const password_hash = await hashPassword(password);
  const userType = overrides.user_type || 'INSTITUTE_ADMIN';
  const email = overrides.email || uniqueEmail(userType.toLowerCase());

  const user = await models.User.create({
    first_name: overrides.first_name || 'Test',
    last_name: overrides.last_name || 'User',
    email,
    password_hash,
    user_type: userType,
    school_id: overrides.school_id || null,
    branch_id: overrides.branch_id || null,
    role_id: overrides.role_id || null,
    permissions: overrides.permissions || ['ALL'],
    is_active: overrides.is_active ?? true,
    details: overrides.details || {},
    ...overrides,
  });

  return { user, password, plainEmail: email };
};

/**
 * Creates an Academic Year
 */
export const createTestAcademicYear = async (instituteId, overrides = {}) => {
  const currentYear = new Date().getFullYear();
  const suffix = uniqueCode('').slice(-4);
  try {
    const academicYear = await models.AcademicYear.create({
      institute_id: instituteId,
      name: overrides.name || `${currentYear}-${suffix}`,
      start_date: overrides.start_date || `${currentYear}-01-01`,
      end_date: overrides.end_date || `${currentYear}-12-31`,
      is_current: overrides.is_current ?? true,
      is_active: overrides.is_active ?? true,
      ...overrides,
    });
    return academicYear;
  } catch (err) {
    console.error('FAILED TO CREATE ACADEMIC YEAR:', err.message, err.parent?.message);
    throw err;
  }
};

/**
 * Creates a Class
 */
export const createTestClass = async (instituteId, academicYearId, overrides = {}) => {
  const cls = await models.Class.create({
    school_id: instituteId,
    academic_year_id: academicYearId,
    name: overrides.name || `Class ${uniqueCode('C')}`,
    description: overrides.description || 'Test Class Description',
    sections: overrides.sections || [
      { id: uuidv4(), name: 'A', room_no: '101', capacity: 30, is_active: true }
    ],
    courses: overrides.courses || [],
    is_active: overrides.is_active ?? true,
    ...overrides,
  });
  return cls;
};

/**
 * Creates a Section
 */
export const createTestSection = async (instituteId, classId, academicYearId, overrides = {}) => {
  const section = await models.Section.create({
    school_id: instituteId,
    class_id: classId,
    academic_year_id: academicYearId,
    name: overrides.name || `A_${uniqueCode('S').slice(-4)}`,
    capacity: overrides.capacity || 30,
    is_active: overrides.is_active ?? true,
    ...overrides,
  });
  return section;
};

/**
 * Creates a Role
 */
export const createTestRole = async (schoolId, overrides = {}) => {
  const role = await models.Role.create({
    school_id: schoolId,
    name: overrides.name || `Role ${uniqueCode('R')}`,
    code: overrides.code || uniqueCode('ROLE'),
    description: overrides.description || 'Test Role Description',
    permissions: overrides.permissions || {
      instituteAdmin: ['ALL'],
      teacher: ['ALL'],
      student: ['ALL'],
      parent: ['ALL'],
      staff: ['ALL'],
    },
    is_template: overrides.is_template ?? false,
    is_active: overrides.is_active ?? true,
    ...overrides,
  });
  return role;
};

/**
 * Clean up test records
 */
export const cleanupTestRecord = async (model, id) => {
  try {
    if (id && model) {
      await model.destroy({ where: { id }, force: true });
    }
  } catch (e) {
    // Ignore cleanup errors
  }
};
