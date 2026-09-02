import jwt from 'jsonwebtoken';
import config from '../../src/config/index.js';
import {
  createTestInstitute,
  createTestBranch,
  createTestUser,
  createTestAcademicYear,
  createTestClass,
  createTestSection,
  createTestRole,
} from './db.helper.js';

/**
 * Generates an Access Token for a given user
 */
export const generateTestToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      userType: user.user_type,
      schoolId: user.school_id,
      branchId: user.branch_id,
    },
    config.jwt.secret,
    {
      expiresIn: '1d',
      issuer: 'thecloudsacademy',
    }
  );
};

/**
 * Returns authorization header object
 */
export const authHeader = (token) => ({
  Authorization: `Bearer ${token}`,
});

/**
 * Creates a fully loaded test context containing:
 * - Institute
 * - Branch
 * - Academic Year
 * - Class
 * - Section
 * - Master Admin user + token
 * - Institute Admin user + token
 * - Teacher user + token
 * - Student user + token
 * - Parent user + token
 * - Staff user + token
 */
export const setupTestContext = async () => {
  const institute = await createTestInstitute();
  const branch = await createTestBranch(institute.id);
  const academicYear = await createTestAcademicYear(institute.id);
  const testClass = await createTestClass(institute.id, academicYear.id);
  const testSection = await createTestSection(institute.id, testClass.id, academicYear.id);

  // Master Admin
  const masterAdminData = await createTestUser({
    user_type: 'MASTER_ADMIN',
    school_id: null,
    branch_id: null,
    permissions: ['ALL'],
  });
  const masterAdminToken = generateTestToken(masterAdminData.user);

  // Institute Admin
  const instituteAdminData = await createTestUser({
    user_type: 'INSTITUTE_ADMIN',
    school_id: institute.id,
    branch_id: branch.id,
    permissions: ['ALL'],
  });
  const instituteAdminToken = generateTestToken(instituteAdminData.user);

  // Branch Admin
  const branchAdminData = await createTestUser({
    user_type: 'BRANCH_ADMIN',
    school_id: institute.id,
    branch_id: branch.id,
    permissions: ['ALL'],
  });
  const branchAdminToken = generateTestToken(branchAdminData.user);

  // Teacher
  const teacherData = await createTestUser({
    user_type: 'TEACHER',
    school_id: institute.id,
    branch_id: branch.id,
    permissions: ['dashboard.view.self', 'classes.view.self', 'attendance.mark.self', 'results.enter.self', 'portal.teacher'],
    details: {
      qualification: 'M.Sc Mathematics',
      designation: 'Senior Teacher',
    },
  });
  const teacherToken = generateTestToken(teacherData.user);

  // Student
  const regNo = `REG_${Date.now().toString().slice(-6)}`;
  const studentData = await createTestUser({
    user_type: 'STUDENT',
    school_id: institute.id,
    branch_id: branch.id,
    registration_no: regNo,
    permissions: ['dashboard.view.self', 'classes.view.self', 'attendance.view.self', 'results.view.self', 'portal.student'],
    details: {
      class_id: testClass.id,
      section_id: testSection.id,
      admission_number: regNo,
      studentDetails: {
        academicSessions: [
          {
            session_id: 'sess-1',
            academic_year_id: academicYear.id,
            class_id: testClass.id,
            section_id: testSection.id,
            status: 'active',
            roll_number: '101'
          }
        ],
        personalInfo: {
          date_of_birth: '2010-05-15',
          gender: 'male',
          father_name: 'Parent User',
        }
      }
    },
  });
  const studentToken = generateTestToken(studentData.user);

  // Parent (linked to student)
  const parentData = await createTestUser({
    user_type: 'PARENT',
    school_id: institute.id,
    branch_id: branch.id,
    permissions: ['dashboard.view.self', 'attendance.view.self', 'fees.view.self', 'portal.parent'],
    details: {
      parentDetails: {
        student_ids: [studentData.user.id],
        students: [{ id: studentData.user.id, name: 'Student Test', registration_no: regNo }],
      }
    }
  });
  const parentToken = generateTestToken(parentData.user);

  // Staff
  const staffData = await createTestUser({
    user_type: 'STAFF',
    staff_type: 'Accountant',
    school_id: institute.id,
    branch_id: branch.id,
    permissions: ['staff.view.self', 'attendance.view.self'],
  });
  const staffToken = generateTestToken(staffData.user);

  return {
    institute,
    branch,
    academicYear,
    testClass,
    testSection,
    masterAdmin: { ...masterAdminData, token: masterAdminToken, headers: authHeader(masterAdminToken) },
    instituteAdmin: { ...instituteAdminData, token: instituteAdminToken, headers: authHeader(instituteAdminToken) },
    branchAdmin: { ...branchAdminData, token: branchAdminToken, headers: authHeader(branchAdminToken) },
    teacher: { ...teacherData, token: teacherToken, headers: authHeader(teacherToken) },
    student: { ...studentData, token: studentToken, headers: authHeader(studentToken) },
    parent: { ...parentData, token: parentToken, headers: authHeader(parentToken) },
    staff: { ...staffData, token: staffToken, headers: authHeader(staffToken) },
  };
};
