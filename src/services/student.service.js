/**
 * The Clouds Academy - Student Service
 *
 * Students are User records with user_type = 'STUDENT'.
 * Class and Section data comes from separate models.
 */

import models, { sequelize } from "../models/postgres/index.js";
import Sequelize, { Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import { generateRandomPassword } from "../utils/passwordGenerator.js";
import { generateRegistrationNo } from "../utils/generators/registrationNo.generator.js";
import { generateRollNoFromClassInfo } from "../utils/generators/rollNo.generator.js";
import { generateAndUploadQRCode } from "../utils/qrCodeGenerator.js";
import { sendWelcomeEmailWithCredentials } from "./email.service.js";
import { deleteFromCloudinary } from "../config/cloudinary.js";

const { User, Role, Institute, Class, Section, AcademicYear } = models;
const { ExamResult, StudentAttendance, FeeVoucher, LeaveRequest, Exam } = models;

const getLatestSessionForStudent = (studentDetails = {}) => {
  const sessions = Array.isArray(studentDetails?.academicSessions)
    ? studentDetails.academicSessions
    : [];
  if (!sessions.length) return null;

  const withTs = sessions
    .filter(
      (session) =>
        session &&
        (session.class_id ||
          session.section_id ||
          session.class_name ||
          session.section_name),
    )
    .map((session) => ({
      ...session,
      status_normalized: String(session.status || "").toLowerCase(),
      start_ts: Number(new Date(session.start_date || 0)),
      end_ts: Number(new Date(session.end_date || 0)),
    }));

  const active = withTs
    .filter((session) => session.status_normalized === "active")
    .sort((a, b) => b.start_ts - a.start_ts);

  if (active.length) return active[0];

  const latest = withTs.sort((a, b) => {
    const bKey =
      Number.isFinite(b.end_ts) && b.end_ts > 0 ? b.end_ts : b.start_ts;
    const aKey =
      Number.isFinite(a.end_ts) && a.end_ts > 0 ? a.end_ts : a.start_ts;
    return bKey - aKey;
  });

  return latest[0] || null;
};

/**
 * Get student role for institute
 */
const getStudentRole = async (instituteId) => {
  // Institute-specific roles
  const instituteRoles = await Role.findAll({
    where: {
      school_id: instituteId,
      is_active: true,
    },
    attributes: [
      "id",
      "name",
      "permissions",
      "school_id",
      "is_template",
      "is_active",
    ],
  });

  const studentInstituteRole = instituteRoles.find(
    (role) =>
      role.permissions &&
      (Array.isArray(role.permissions.student) ||
        role.permissions.student === "ALL"),
  );

  if (studentInstituteRole) {
    return studentInstituteRole;
  }

  // Template roles
  const templateRoles = await Role.findAll({
    where: {
      school_id: null,
      is_template: true,
      is_active: true,
    },
    attributes: [
      "id",
      "name",
      "permissions",
      "school_id",
      "is_template",
      "is_active",
    ],
  });

  const studentTemplateRole = templateRoles.find(
    (role) =>
      role.permissions &&
      (Array.isArray(role.permissions.student) ||
        role.permissions.student === "ALL"),
  );

  if (studentTemplateRole) {
    return studentTemplateRole;
  }

  // Fallback
  return {
    id: null,
    name: "Student",
    permissions: {
      student: [
        "dashboard.view.self",
        "attendance.view.self",
        "results.view.self",
      ],
    },
  };
};

/**
 * Get class and section details from database
 */
const getClassSectionDetails = async (classId, sectionId) => {
  const classInfo = classId
    ? await Class.findByPk(classId, {
      attributes: ["id", "name", "academic_year_id", "sections"],
    })
    : null;

  let sectionInfo = sectionId
    ? await Section.findByPk(sectionId, {
      attributes: ["id", "name", "room_number"],
    })
    : null;

  // In this codebase, many institutes keep sections inside Class.sections JSON.
  // Fallback to class-embedded sections when standalone Section row is missing.
  if (!sectionInfo && sectionId && classInfo) {
    const embeddedSections = Array.isArray(classInfo.sections)
      ? classInfo.sections
      : [];
    const matched = embeddedSections.find(
      (section) =>
        String(section?.id || section?.section_id || "") === String(sectionId),
    );
    if (matched) {
      sectionInfo = {
        id: matched.id || matched.section_id || sectionId,
        name: matched.name || matched.section_name || null,
        room_number: matched.room_number || matched.room_no || null,
      };
    }
  }

  return {
    class_id: classInfo?.id || null,
    class_name: classInfo?.name || null,
    academic_year_id: classInfo?.academic_year_id || null,
    section_id: sectionInfo?.id || null,
    section_name: sectionInfo?.name || null,
    room_no: sectionInfo?.room_number || null,
  };
};

/**
 * Create student
 */
export const createStudent = async (data, options = {}) => {
  const { transaction } = options;

  try {
    console.log("📝 Creating student with data:", data);

    // Keep both naming conventions in sync for downstream fee voucher logic.
    const resolvedAdmissionFee =
      data.admission_fee !== undefined && data.admission_fee !== null
        ? data.admission_fee
        : data.admission_charges;

    // 1. Get student role
    const studentRole = await getStudentRole(data.institute_id);

    // 2. Generate password
    const password = data.password || generateRandomPassword(8);
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Generate registration number if not provided
    let registrationNo = data.registration_no;
    if (!registrationNo) {
      registrationNo = await generateRegistrationNo(
        data.institute_id,
        data.institute_type || "school",
      );
    } else {
      // 🛑 CRITICAL CHECK: Manual registration number must be unique within the institute
      const existingUser = await User.findOne({
        where: {
          school_id: data.institute_id,
          registration_no: registrationNo,
        },
        attributes: ["id"],
        transaction,
      });

      if (existingUser) {
        const error = new Error(`Registration Number "${registrationNo}" already exists in this institute.`);
        error.name = 'SequelizeUniqueConstraintError'; // Force naming for controller catch
        error.errors = [{ path: 'registration_no', value: registrationNo }];
        throw error;
      }
    }

    // 4. Get role permissions
    let rolePermissions = [];
    if (studentRole.permissions) {
      if (studentRole.permissions.student === "ALL") {
        rolePermissions = ["ALL"];
      } else if (Array.isArray(studentRole.permissions.student)) {
        rolePermissions = studentRole.permissions.student;
      }
    }

    // 5. Get class and section details
    let classId = data.class_id;
    let sectionId = data.section_id;

    // If class_id is not in root, check in details
    if (!classId && data.details?.studentDetails?.class_id) {
      classId = data.details.studentDetails.class_id;
    }
    if (!sectionId && data.details?.studentDetails?.section_id) {
      sectionId = data.details.studentDetails.section_id;
    }

    const classSectionInfo = await getClassSectionDetails(classId, sectionId);

    // 6. Generate roll number if not provided
    let rollNo = data.roll_no || data.details?.studentDetails?.roll_no;
    if (!rollNo && classId && sectionId) {
      rollNo = await generateRollNoFromClassInfo(data.institute_id, {
        class_id: classId,
        section_id: sectionId,
        academic_year_id: classSectionInfo.academic_year_id,
      });
    }

    // 7. Prepare academic sessions array
    const academicSessions = [];

    const currentSession = {
      academic_year_id: classSectionInfo.academic_year_id,
      class_id: classId,
      class_name: classSectionInfo.class_name,
      section_id: sectionId,
      section_name: classSectionInfo.section_name,
      roll_no: rollNo,
      status: "active",
      start_date: data.admission_date || new Date(),
      end_date: null,
    };

    academicSessions.push(currentSession);

    // 8. Prepare student details
    const studentDetails = {
      // Basic Info
      date_of_birth: data.dob || data.date_of_birth,
      gender: data.gender,
      blood_group: data.blood_group,
      religion: data.religion,
      nationality: data.nationality || "Pakistani",
      cnic: data.cnic,

      // Academic Info
      class_id: classId,
      class_name: classSectionInfo.class_name,
      section_id: sectionId,
      section_name: classSectionInfo.section_name,
      roll_no: rollNo,
      academic_year_id: classSectionInfo.academic_year_id,
      admission_date: data.admission_date,

      // Parent/Guardian Info
      father_name: data.father_name,
      father_cnic: data.father_cnic,
      father_phone: data.father_phone,
      father_occupation: data.father_occupation,
      father_education: data.father_education,

      mother_name: data.mother_name,
      mother_cnic: data.mother_cnic,
      mother_phone: data.mother_phone,
      mother_occupation: data.mother_occupation,

      // Handle Multiple Guardians
      guardians:
        data.guardians &&
          Array.isArray(data.guardians) &&
          data.guardians.length > 0
          ? data.guardians.map((g) => ({
            name: g.name,
            relation: (g.type || g.relation || "guardian").toLowerCase(),
            phone: g.phone,
            cnic: g.cnic,
            email: g.email || null,
            type: (g.type || g.relation || "guardian").toLowerCase(),
          }))
          : data.guardian_name
            ? [
              {
                name: data.guardian_name,
                relation: data.guardian_relation,
                phone: data.guardian_phone,
                cnic: data.guardian_cnic,
                email: data.guardian_email || null,
                type: "guardian",
              },
            ]
            : [],

      // Contact Info
      present_address: data.present_address,
      permanent_address: data.permanent_address,
      city: data.city,

      // Fee Info
      fee_plan_id: data.fee_plan_id,
      monthly_fee: data.monthly_fee,
      admission_fee: resolvedAdmissionFee,
      admission_charges: resolvedAdmissionFee,
      annual_charges: data.annual_charges,
      lab_charges: data.lab_charges,
      discount_type: data.discount_type,
      concession_type: data.concession_type || "none",
      concession_percentage: data.concession_percentage || 0,
      concession_reason: data.concession_reason,

      // Medical Info
      medical_conditions: data.medical_conditions,
      allergies: data.allergies,

      // Previous School
      previous_school: data.previous_school,
      previous_class: data.previous_class,

      // Status
      status: data.status || "active",
    };

    // 9. Prepare documents
    const documents = (data.documents || []).map((doc) => ({
      id: doc.id || uuidv4(),
      type: doc.type || "other",
      title: doc.title || doc.file_name,
      file_name: doc.file_name,
      file_url: doc.file_url,
      uploaded_at: new Date(),
      verified: doc.verified || false,
    }));

    // 10. Create user
    const userData = {
      id: uuidv4(),
      school_id: data.institute_id,
      role_id: studentRole.id,
      user_type: "STUDENT",
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || null,
      phone: data.phone,
      password_hash: hashedPassword,
      registration_no: registrationNo,
      permissions: rolePermissions,
      // Map photo_url → avatar_url
      avatar_url: data.photo_url || data.avatar_url || null,
      avatar_public_id: data.photo_public_id || data.avatar_public_id || null,
      details: {
        studentDetails: {
          ...studentDetails,
          academicSessions: academicSessions,
        },
      },
      documents: documents,
      is_active: true,
      created_by: data.created_by,
    };

    const user = await User.create(userData, { transaction });

    // 11. Generate and upload QR Code
    const qrCodeResult = await generateAndUploadQRCode(user, data.institute_id);
    user.qr_code_url = qrCodeResult.url;
    user.qr_code_public_id = qrCodeResult.public_id;
    await user.save({ transaction });

    // 12. Send welcome email
    if (user.email && data.send_email !== false) {
      const institute = await Institute.findByPk(data.institute_id);
      await sendWelcomeEmailWithCredentials(
        user,
        password,
        institute?.name || "The Clouds Academy",
        qrCodeResult.url,
        "Student",
      ).catch((err) => console.error("Email sending failed:", err));
    }

    return {
      user,
      password,
      role: studentRole,
    };
  } catch (error) {
    console.error("❌ Student creation failed:", error);
    throw error;
  }
};
/**
 * Resolve Class and Section names for a list of students
 */
const resolveStudentRelations = async (students = []) => {
  if (!students.length) return students;

  const classIds = new Set();
  const sectionIds = new Set();

  students.forEach((student) => {
    const details = student?.details?.studentDetails || student?.details || {};
    const activeSession = getLatestSessionForStudent(details);
    const classId = activeSession?.class_id || details?.class_id;
    const sectionId = activeSession?.section_id || details?.section_id;

    if (classId) classIds.add(classId);
    if (sectionId) sectionIds.add(sectionId);
  });

  const [classes, sections] = await Promise.all([
    classIds.size
      ? Class.findAll({
        where: { id: { [Op.in]: Array.from(classIds) } },
        attributes: ["id", "name"],
      })
      : Promise.resolve([]),
    sectionIds.size
      ? Section.findAll({
        where: { id: { [Op.in]: Array.from(sectionIds) } },
        attributes: ["id", "name"],
      })
      : Promise.resolve([]),
  ]);

  const classNameMap = new Map(classes.map((cls) => [cls.id, cls.name]));
  const sectionNameMap = new Map(
    sections.map((section) => [section.id, section.name]),
  );

  students.forEach((student) => {
    const details = student?.details || {};
    const studentDetails = details?.studentDetails || {};
    const activeSession = getLatestSessionForStudent(studentDetails);
    const classId = activeSession?.class_id || studentDetails?.class_id;
    const sectionId = activeSession?.section_id || studentDetails?.section_id;

    const resolvedClassName = classId
      ? classNameMap.get(classId) ||
      activeSession?.class_name ||
      studentDetails.class_name ||
      null
      : activeSession?.class_name || studentDetails.class_name;
    const resolvedSectionName = sectionId
      ? sectionNameMap.get(sectionId) ||
      activeSession?.section_name ||
      studentDetails.section_name ||
      null
      : activeSession?.section_name || studentDetails.section_name;

    if (!details.studentDetails) {
      details.studentDetails = {};
    }

    details.studentDetails.class_id =
      classId || details.studentDetails.class_id || null;
    details.studentDetails.section_id =
      sectionId || details.studentDetails.section_id || null;
    details.studentDetails.class_name = resolvedClassName;
    details.studentDetails.section_name = resolvedSectionName;
    student.details = details;
  });

  return students;
};

/**
 * Get all students with class and section details
 */
export const getAllStudents = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const where = {
    school_id: filters.institute_id,
    user_type: "STUDENT",
  };

  if (filters.search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${filters.search}%` } },
      { last_name: { [Op.iLike]: `%${filters.search}%` } },
      { email: { [Op.iLike]: `%${filters.search}%` } },
      { registration_no: { [Op.iLike]: `%${filters.search}%` } },
    ];
  }

  // Support both is_active (boolean from frontend) and status (string) filters
  if (filters.is_active === true || filters.is_active === "true") where.is_active = true;
  else if (filters.is_active === false || filters.is_active === "false") where.is_active = false;
  else if (filters.status === "active") where.is_active = true;
  else if (filters.status === "inactive") where.is_active = false;

  // Build where clause with raw SQL for JSON comparisons
  let whereWith = { ...where };
  let rawWhereClauses = [];

  // Filter by class_id - handle both UUID strings and integers in JSON
  if (filters.class_id) {
    const classId = filters.class_id;
    rawWhereClauses.push(
      `(details->'studentDetails'->>'class_id' = '${classId}' OR details->'studentDetails'->>'class_id' = '${classId}'::text)`,
    );
  }

  // Filter by section_id
  if (filters.section_id) {
    const sectionId = filters.section_id;
    rawWhereClauses.push(
      `(details->'studentDetails'->>'section_id' = '${sectionId}' OR details->'studentDetails'->>'section_id' = '${sectionId}'::text)`,
    );
  }

  // Filter by academic_year_id
  if (filters.academic_year_id) {
    const yearId = filters.academic_year_id;
    rawWhereClauses.push(
      `(details->'studentDetails'->>'academic_year_id' = '${yearId}' OR details->'studentDetails'->>'academic_year_id' = '${yearId}'::text)`,
    );
  }

  // Build final where clause with raw SQL if needed
  const sequelizeWhere =
    rawWhereClauses.length > 0
      ? {
        ...whereWith,
        [Op.and]: rawWhereClauses.map((clause) => Sequelize.literal(clause)),
      }
      : whereWith;

  const { count, rows } = await User.findAndCountAll({
    where: sequelizeWhere,
    include: [
      {
        model: Role,
        as: "Role",
        attributes: ["id", "name", "permissions"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    subQuery: false,
  });

  await resolveStudentRelations(rows);

  return {
    data: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
    },
  };
};

/**
 * Get student by ID
 */
export const getStudentById = async (id, instituteId) => {
  const student = await User.findOne({
    where: { id, school_id: instituteId, user_type: 'STUDENT' },
    include: [
      { model: Role, as: 'Role', attributes: ['id', 'name', 'permissions'] },
      { model: ExamResult, as: 'examResults', separate: true, order: [['created_at', 'DESC']] },
      { model: StudentAttendance, as: 'studentAttendances', separate: true, order: [['date', 'DESC']], limit: 100 },
      { model: FeeVoucher, as: 'feeVouchers', separate: true, order: [['created_at', 'DESC']] },
      { model: LeaveRequest, as: 'leaveRequests', separate: true, order: [['created_at', 'DESC']] }
    ]
  });

  if (!student) return null;

  // ✅ FIX: Correct path to academicSessions
  const academicSessions = student.details?.studentDetails?.academicSessions;

  if (academicSessions?.length) {
    const academicYearIds = [...new Set(academicSessions.map(s => s.academic_year_id).filter(Boolean))];

    if (academicYearIds.length) {
      const academicYears = await AcademicYear.findAll({
        where: { id: academicYearIds, institute_id: instituteId },
        attributes: ['id', 'name'],
        raw: true
      });
      const yearMap = new Map(academicYears.map(ay => [ay.id, ay.name]));

      // Update each session with academic_year_name
      student.details.studentDetails.academicSessions = academicSessions.map(session => ({
        ...session,
        academic_year_name: yearMap.get(session.academic_year_id) || session.academic_year_id
      }));
    }
  }

  return student;
};

/**
 * Update student
 */
export const updateStudent = async (
  id,
  instituteId,
  updateData,
  options = {},
) => {
  const { transaction } = options;

  const resolvedAdmissionFee =
    updateData.admission_fee !== undefined && updateData.admission_fee !== null
      ? updateData.admission_fee
      : updateData.admission_charges;

  const user = await User.findOne({
    where: { id, school_id: instituteId, user_type: "STUDENT" },
  });

  if (!user) {
    throw new Error("Student not found");
  }

  console.log("📝 Updating student with data:", updateData);

  // Update basic fields
  if (updateData.first_name !== undefined)
    user.first_name = updateData.first_name;
  if (updateData.last_name !== undefined) user.last_name = updateData.last_name;
  if (updateData.email !== undefined) user.email = updateData.email;
  if (updateData.phone !== undefined) user.phone = updateData.phone;
  if (updateData.is_active !== undefined) user.is_active = updateData.is_active;
  if (updateData.registration_no !== undefined)
    user.registration_no = updateData.registration_no;

  // 🖼️ Update avatar (map photo_url → avatar_url)
  if (updateData.photo_url !== undefined) {
    user.avatar_url = updateData.photo_url;
  }
  if (updateData.photo_public_id !== undefined) {
    user.avatar_public_id = updateData.photo_public_id;
  }
  if (updateData.avatar_url !== undefined) {
    user.avatar_url = updateData.avatar_url;
  }
  if (updateData.avatar_public_id !== undefined) {
    user.avatar_public_id = updateData.avatar_public_id;
  }

  // Get existing details
  const existingDetails = user.details?.studentDetails || {};
  const existingSessions =
    user.details?.studentDetails?.academicSessions ||
    user.details?.academicSessions ||
    [];

  // Resolve incoming class/section with safe fallback to existing values
  const incomingClassId =
    updateData.class_id ?? updateData.details?.studentDetails?.class_id;
  const incomingSectionId =
    updateData.section_id ?? updateData.details?.studentDetails?.section_id;
  const newClassId = incomingClassId || existingDetails.class_id || null;
  const newSectionId = incomingSectionId || existingDetails.section_id || null;

  let classSectionInfo = await getClassSectionDetails(newClassId, newSectionId);
  let newRollNo = updateData.roll_no || existingDetails.roll_no;
  const classOrSectionChanged =
    (newClassId && newClassId !== existingDetails.class_id) ||
    (newSectionId && newSectionId !== existingDetails.section_id);

  // If class or section changed, get new info and generate new roll number
  if (classOrSectionChanged) {
    // Generate new roll number if not provided
    if (!updateData.roll_no && newClassId && newSectionId) {
      newRollNo = await generateRollNoFromClassInfo(instituteId, {
        class_id: newClassId,
        section_id: newSectionId,
        academic_year_id: classSectionInfo.academic_year_id,
      });
    }

    // Add new academic session
    const newSession = {
      academic_year_id:
        classSectionInfo.academic_year_id || existingDetails.academic_year_id,
      class_id: newClassId || existingDetails.class_id,
      class_name: classSectionInfo.class_name || existingDetails.class_name,
      section_id: newSectionId || existingDetails.section_id,
      section_name:
        classSectionInfo.section_name || existingDetails.section_name,
      roll_no: newRollNo,
      status: "active",
      start_date: new Date(),
      end_date: null,
    };

    // Deactivate current active session (do not assume index 0 is active)
    existingSessions.forEach((session) => {
      if (String(session?.status || "").toLowerCase() === "active") {
        session.status = "completed";
        session.end_date = new Date();
      }
    });

    existingSessions.unshift(newSession);
  } else {
    // Keep active session metadata aligned with currently selected class/section.
    existingSessions.forEach((session) => {
      if (String(session?.status || "").toLowerCase() === "active") {
        session.class_id = newClassId || session.class_id || null;
        session.class_name =
          classSectionInfo.class_name ||
          session.class_name ||
          existingDetails.class_name ||
          null;
        session.section_id = newSectionId || session.section_id || null;
        session.section_name =
          classSectionInfo.section_name ||
          session.section_name ||
          existingDetails.section_name ||
          null;
        session.roll_no =
          updateData.roll_no || session.roll_no || newRollNo || null;
        session.academic_year_id =
          classSectionInfo.academic_year_id ||
          session.academic_year_id ||
          existingDetails.academic_year_id ||
          null;
      }
    });
  }

  // Prepare updated student details
  const updatedStudentDetails = {
    // Keep existing values
    ...existingDetails,

    // Override with new values
    ...(updateData.dob !== undefined && { date_of_birth: updateData.dob }),
    ...(updateData.gender !== undefined && { gender: updateData.gender }),
    ...(updateData.blood_group !== undefined && {
      blood_group: updateData.blood_group,
    }),
    ...(updateData.religion !== undefined && { religion: updateData.religion }),
    ...(updateData.nationality !== undefined && {
      nationality: updateData.nationality,
    }),
    ...(updateData.cnic !== undefined && { cnic: updateData.cnic }),

    // Academic - use new values if changed
    ...(newClassId && { class_id: newClassId }),
    class_name:
      classSectionInfo.class_name || existingDetails.class_name || null,
    ...(newSectionId && { section_id: newSectionId }),
    section_name:
      classSectionInfo.section_name || existingDetails.section_name || null,
    ...(updateData.roll_no && { roll_no: updateData.roll_no }),
    ...(newRollNo && !updateData.roll_no && { roll_no: newRollNo }),
    ...(classSectionInfo.academic_year_id && {
      academic_year_id: classSectionInfo.academic_year_id,
    }),
    ...(updateData.admission_date && {
      admission_date: updateData.admission_date,
    }),

    // Parent info
    ...(updateData.father_name !== undefined && {
      father_name: updateData.father_name,
    }),
    ...(updateData.father_cnic !== undefined && {
      father_cnic: updateData.father_cnic,
    }),
    ...(updateData.father_phone !== undefined && {
      father_phone: updateData.father_phone,
    }),
    ...(updateData.father_occupation !== undefined && {
      father_occupation: updateData.father_occupation,
    }),

    ...(updateData.mother_name !== undefined && {
      mother_name: updateData.mother_name,
    }),
    ...(updateData.mother_phone !== undefined && {
      mother_phone: updateData.mother_phone,
    }),

    ...(updateData.guardian_name !== undefined && {
      guardian_name: updateData.guardian_name,
    }),
    ...(updateData.guardian_relation !== undefined && {
      guardian_relation: updateData.guardian_relation,
    }),
    ...(updateData.guardian_phone !== undefined && {
      guardian_phone: updateData.guardian_phone,
    }),

    // Address
    ...(updateData.present_address !== undefined && {
      present_address: updateData.present_address,
    }),
    ...(updateData.permanent_address !== undefined && {
      permanent_address: updateData.permanent_address,
    }),
    ...(updateData.city !== undefined && { city: updateData.city }),

    // Fee
    ...(updateData.monthly_fee !== undefined && {
      monthly_fee: updateData.monthly_fee,
    }),
    ...(resolvedAdmissionFee !== undefined && {
      admission_fee: resolvedAdmissionFee,
    }),
    ...(resolvedAdmissionFee !== undefined && {
      admission_charges: resolvedAdmissionFee,
    }),
    ...(updateData.annual_charges !== undefined && {
      annual_charges: updateData.annual_charges,
    }),
    ...(updateData.lab_charges !== undefined && {
      lab_charges: updateData.lab_charges,
    }),
    ...(updateData.discount_type !== undefined && {
      discount_type: updateData.discount_type,
    }),
    ...(updateData.concession_type !== undefined && {
      concession_type: updateData.concession_type,
    }),
    ...(updateData.concession_percentage !== undefined && {
      concession_percentage: updateData.concession_percentage,
    }),

    // Medical
    ...(updateData.medical_conditions !== undefined && {
      medical_conditions: updateData.medical_conditions,
    }),
    ...(updateData.allergies !== undefined && {
      allergies: updateData.allergies,
    }),

    // Previous
    ...(updateData.previous_school !== undefined && {
      previous_school: updateData.previous_school,
    }),
    ...(updateData.previous_class !== undefined && {
      previous_class: updateData.previous_class,
    }),

    // Guardians (type is source of truth for relation)
    ...(updateData.guardians !== undefined && {
      guardians: (Array.isArray(updateData.guardians)
        ? updateData.guardians
        : []
      ).map((g) => ({
        name: g.name,
        type: (g.type || g.relation || "guardian").toLowerCase(),
        relation: (g.type || g.relation || "guardian").toLowerCase(),
        phone: g.phone,
        cnic: g.cnic,
        email: g.email || null,
      })),
    }),
  };

  // Update documents if provided
  if (updateData.documents !== undefined) {
    try {
      const documents = Array.isArray(updateData.documents)
        ? updateData.documents
        : typeof updateData.documents === "string"
          ? JSON.parse(updateData.documents)
          : [];

      const newDocs = documents.map((doc) => ({
        id: doc.id || uuidv4(),
        type: doc.type || "other",
        title: doc.title || doc.file_name,
        file_name: doc.file_name,
        file_url: doc.file_url,
        public_id: doc.public_id,
        uploaded_at: doc.uploaded_at || new Date(),
        verified: doc.verified || false,
      }));

      // Handle deletions from Cloudinary
      const existingDocs = user.documents || [];

      // Find deleted docs (present in existing but missing in new)
      for (const oldDoc of existingDocs) {
        // Match by public_id is safest if id is not reliable, or by id
        const isKept = newDocs.some(
          (n) =>
            (n.id && n.id === oldDoc.id) ||
            (n.public_id && n.public_id === oldDoc.public_id) ||
            (n.file_url && n.file_url === oldDoc.file_url),
        );

        if (!isKept && oldDoc.public_id) {
          console.log("🗑️ Deleting removed document:", oldDoc.public_id);
          await deleteFromCloudinary(oldDoc.public_id).catch((e) =>
            console.error("Cloudinary delete error:", e),
          );
        }
      }

      user.documents = newDocs;
    } catch (error) {
      console.error("❌ Error parsing documents:", error);
    }
  } else if (updateData.documents === null) {
    // Explicitly clear documents if null
    const existingDocs = user.documents || [];
    for (const oldDoc of existingDocs) {
      if (oldDoc.public_id) {
        console.log(
          "🗑️ Deleting removed document (clear all):",
          oldDoc.public_id,
        );
        await deleteFromCloudinary(oldDoc.public_id).catch((e) =>
          console.error("Cloudinary delete error:", e),
        );
      }
    }
    user.documents = [];
  }

  // Update details (Move academicSessions inside studentDetails)
  const newDetails = { ...user.details };
  delete newDetails.academicSessions; // Cleanup old location if present

  newDetails.studentDetails = {
    ...updatedStudentDetails,
    academicSessions: existingSessions,
  };

  user.details = newDetails;

  user.changed("details", true);
  user.changed("documents", true);

  // Generate QR Code if missing
  if (!user.qr_code_url) {
    try {
      const fullUser = {
        ...user.toJSON(),
        details: user.details,
      };

      // Removed generateAndUploadQRCode import check, assuming it exists based on line 856
      const qrCodeResult = await generateAndUploadQRCode(fullUser, instituteId);
      if (qrCodeResult) {
        user.qr_code_url = qrCodeResult.url;
        user.qr_code_public_id = qrCodeResult.public_id;
      }
    } catch (qrError) {
      console.error("⚠️ Failed to generate QR code on update:", qrError);
    }
  }

  await user.save({ transaction });

  return user;
};

/**
 * Add academic session (promote student)
 */
export const addAcademicSession = async (
  studentId,
  instituteId,
  sessionData,
  options = {},
) => {
  const { transaction } = options;

  const user = await User.findOne({
    where: { id: studentId, school_id: instituteId, user_type: "STUDENT" },
  });

  if (!user) {
    throw new Error("Student not found");
  }

  const existingSessions =
    user.details?.studentDetails?.academicSessions ||
    user.details?.academicSessions ||
    [];

  // Get class and section details
  const classSectionInfo = await getClassSectionDetails(
    sessionData.class_id,
    sessionData.section_id,
  );

  // Generate roll number if not provided
  let rollNo = sessionData.roll_no;
  if (!rollNo && sessionData.class_id && sessionData.section_id) {
    rollNo = await generateRollNoFromClassInfo(instituteId, {
      class_id: sessionData.class_id,
      section_id: sessionData.section_id,
      academic_year_id: classSectionInfo.academic_year_id,
    });
  }

  // Deactivate current active session (do not assume index 0 is active)
  existingSessions.forEach((session) => {
    if (String(session?.status || "").toLowerCase() === "active") {
      session.status = "completed";
      session.end_date = new Date();
    }
  });

  // Add new session
  const newSession = {
    academic_year_id:
      classSectionInfo.academic_year_id || sessionData.academic_year_id,
    class_id: sessionData.class_id,
    class_name: classSectionInfo.class_name,
    section_id: sessionData.section_id,
    section_name: classSectionInfo.section_name,
    roll_no: rollNo,
    status: "active",
    start_date: sessionData.start_date || new Date(),
    end_date: null,
  };

  existingSessions.unshift(newSession);

  // Update current details
  if (user.details?.studentDetails) {
    user.details.studentDetails.class_id = sessionData.class_id;
    user.details.studentDetails.class_name = classSectionInfo.class_name;
    user.details.studentDetails.section_id = sessionData.section_id;
    user.details.studentDetails.section_name = classSectionInfo.section_name;
    user.details.studentDetails.roll_no = rollNo;
    user.details.studentDetails.academic_year_id =
      classSectionInfo.academic_year_id;
  }

  const existingDetails = user.details || {};
  const existingStudentDetails = existingDetails.studentDetails || {};

  user.details = {
    ...existingDetails,
    studentDetails: {
      ...existingStudentDetails,
      academicSessions: existingSessions,
    },
  };

  user.changed("details", true);
  await user.save({ transaction });

  return user;
};

/**
 * Delete student (Soft Delete or Hard Delete)
 * @param {string} id - Student ID
 * @param {string} instituteId - Institute ID
 * @param {string} type - 'delete' for permanent delete, 'inactive' for soft delete (default)
 */
export const deleteStudent = async (id, instituteId, type = 'inactive') => {
  const user = await User.findOne({
    where: { id, school_id: instituteId, user_type: "STUDENT" },
  });

  if (!user) {
    throw new Error("Student not found");
  }

  // HARD DELETE - Permanently remove from database
  if (type === 'delete') {
    // Delete associated Cloudinary assets (QR code, photo, documents)
    if (user.qr_code_public_id) {
      await deleteFromCloudinary(user.qr_code_public_id).catch(err =>
        console.error("QR Code deletion error:", err)
      );
    }

    if (user.avatar_public_id) {
      await deleteFromCloudinary(user.avatar_public_id).catch(err =>
        console.error("Avatar deletion error:", err)
      );
    }

    // Delete all documents from Cloudinary
    if (user.documents && Array.isArray(user.documents)) {
      for (const doc of user.documents) {
        if (doc.public_id) {
          await deleteFromCloudinary(doc.public_id).catch(err =>
            console.error("Document deletion error:", err)
          );
        }
      }
    }

    // Permanently delete from database
    await user.destroy();
    return {
      message: "Student permanently deleted successfully",
      deleted: true,
      type: 'hard_delete'
    };
  }

  // SOFT DELETE - Just deactivate (default behavior)
  if (type === 'active') {
    // Activate the student
    await user.update({ is_active: true });
    return {
      message: "Student activated successfully",
      is_active: true,
      type: 'activate'
    };
  } else {
    // Deactivate the student (default)
    await user.update({ is_active: false });
    return {
      message: "Student deactivated successfully",
      is_active: false,
      type: 'deactivate'
    };
  }
};

/**
 * Bulk delete students
 */
export const bulkDeleteStudents = async (ids, instituteId) => {
  const result = await User.update(
    { is_active: false },
    {
      where: {
        id: { [Op.in]: ids },
        school_id: instituteId,
        user_type: "STUDENT",
      },
    },
  );

  return { deletedCount: result[0] };
};

/**
 * Toggle student status
 */
export const toggleStudentStatus = async (id, instituteId, isActive) => {
  const user = await User.findOne({
    where: { id, school_id: instituteId, user_type: "STUDENT" },
  });

  if (!user) {
    throw new Error("Student not found");
  }

  user.is_active = isActive;
  await user.save();

  return user;
};

/**
 * Get students by class
 */
export const getStudentsByClass = async (classId, instituteId) => {
  return await User.findAll({
    where: {
      school_id: instituteId,
      user_type: "STUDENT",
      is_active: true,
      [Op.and]: sequelize.literal(
        `"User"."details"->'studentDetails'->>'class_id' = '${classId}'`,
      ),
    },
    order: [["first_name", "ASC"]],
  });
};

/**
 * Get students by section
 */
export const getStudentsBySection = async (sectionId, instituteId) => {
  return await User.findAll({
    where: {
      school_id: instituteId,
      user_type: "STUDENT",
      is_active: true,
      [Op.and]: sequelize.literal(
        `"User"."details"->'studentDetails'->>'section_id' = '${sectionId}'`,
      ),
    },
    order: [["first_name", "ASC"]],
  });
};

/**
 * Get student statistics
 */
export const getStudentStats = async (instituteId) => {
  const total = await User.count({
    where: { school_id: instituteId, user_type: "STUDENT" },
  });

  const active = await User.count({
    where: { school_id: instituteId, user_type: "STUDENT", is_active: true },
  });

  const inactive = total - active;

  // Get gender distribution
  const maleCount = await User.count({
    where: {
      school_id: instituteId,
      user_type: "STUDENT",
      "details.studentDetails.gender": "male",
    },
  });

  const femaleCount = await User.count({
    where: {
      school_id: instituteId,
      user_type: "STUDENT",
      "details.studentDetails.gender": "female",
    },
  });

  return {
    total,
    active,
    inactive,
    gender: {
      male: maleCount,
      female: femaleCount,
      other: total - (maleCount + femaleCount),
    },
  };
};

/**
 * The Clouds Academy - Optimized Student Bulk Import
 * Rules:
 * 1. Hierarchy: AcademicYear -> Class -> Section (Create if not exists)
 * 2. If Section missing in Excel, default "A"
 * 3. Returns success and failed rows with reasons
 * 4. ✅ QR Code generation for each student
 * 5. ✅ Unique registration number per institute
 * 6. ✅ Unique email per institute
 * 7. ✅ Safe string conversion for all fields (FIXED)
 */
export const bulkImportStudents = async (
  studentsData,
  instituteId,
  instituteType,
  options = {},
) => {
  const transaction = await sequelize.transaction();
  const failedRecords = [];
  const successfulRecords = [];

  try {
    console.log(`🚀 Starting bulk import of ${studentsData.length} students...`);

    // Helper function to safely get string value
    const safeString = (value) => {
      if (value === null || value === undefined) return '';
      return String(value).trim();
    };

    // ========== STEP 1: VALIDATE AND PREPARE DATA ==========

    // Get all existing emails for this institute to check duplicates
    const existingUsers = await User.findAll({
      where: {
        school_id: instituteId,
        user_type: "STUDENT",
        email: { [Op.ne]: null }
      },
      attributes: ['email', 'registration_no'],
      transaction
    });

    const existingEmails = new Set(existingUsers.map(u => u.email?.toLowerCase()).filter(Boolean));
    const existingRegNos = new Set(existingUsers.map(u => u.registration_no).filter(Boolean));

    // Get student role
    const studentRole = await getStudentRole(instituteId);

    // Prepare data for bulk creation
    const usersToCreate = [];
    const sectionCounters = new Map(); // For roll number generation

    // Extract unique academic years and classes with safe conversion
    const uniqueYearNames = [
      ...new Set(
        studentsData
          .map((s) => safeString(s.academic_year_name))
          .filter(Boolean),
      ),
    ];

    const uniqueClassNames = [
      ...new Set(
        studentsData
          .map((s) => safeString(s.class_name))
          .filter(Boolean),
      ),
    ];

    // ========== STEP 2: CREATE/FIND ACADEMIC YEARS ==========
    const yearMap = new Map();
    for (const name of uniqueYearNames) {
      const [yearObj] = await AcademicYear.findOrCreate({
        where: { institute_id: instituteId, name: String(name) },
        defaults: {
          institute_id: instituteId,
          name: String(name),
          start_date: new Date(),
          end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          is_active: true,
          is_current: false,
        },
        transaction,
      });
      yearMap.set(String(name), yearObj.id);
    }

    // ========== STEP 3: CREATE/FIND CLASSES ==========
    const classMap = new Map();
    for (const className of uniqueClassNames) {
      const sampleStudent = studentsData.find(
        (s) => safeString(s.class_name) === className,
      );
      const yearId = yearMap.get(safeString(sampleStudent?.academic_year_name));

      const [classObj] = await Class.findOrCreate({
        where: {
          school_id: instituteId,
          academic_year_id: yearId,
          name: String(className),
        },
        defaults: {
          school_id: instituteId,
          academic_year_id: yearId,
          name: String(className),
          sections: [],
        },
        transaction,
      });
      classMap.set(`${className}-${yearId}`, classObj);
    }

    // ========== STEP 4: PROCESS EACH STUDENT (Validation + Preparation) ==========
    for (let i = 0; i < studentsData.length; i++) {
      const s = studentsData[i];
      const rowNumber = i + 2; // +2 because Excel starts at row 2 (assuming row 1 is headers)
      const errors = [];

      try {
        // SAFE STRING CONVERSION FOR ALL FIELDS
        const firstName = safeString(s.first_name);
        const lastName = safeString(s.last_name);
        const className = safeString(s.class_name);
        const academicYearName = safeString(s.academic_year_name);
        const sectionName = safeString(s.section_name) || "A";
        const email = s.email ? safeString(s.email) : null;
        const phone = s.phone ? safeString(s.phone) : null;
        const registrationNoProvided = s.registration_no ? safeString(s.registration_no) : null;
        const rollNoProvided = s.roll_no ? safeString(s.roll_no) : null;

        // Validate required fields
        if (!firstName) errors.push("First name is required");
        if (!lastName) errors.push("Last name is required");
        if (!className) errors.push("Class name is required");
        if (!academicYearName) errors.push("Academic year name is required");

        // Validate email uniqueness (per institute)
        if (email) {
          const emailLower = email.toLowerCase();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(emailLower)) {
            errors.push("Invalid email format");
          }
          if (existingEmails.has(emailLower)) {
            errors.push(`Email "${email}" already exists in this institute`);
          }
          // Check within current batch
          const duplicateInBatch = usersToCreate.some(
            u => u.email?.toLowerCase() === emailLower
          );
          if (duplicateInBatch) {
            errors.push(`Duplicate email "${email}" in import file`);
          }
        }

        if (errors.length > 0) {
          failedRecords.push({
            row: rowNumber,
            data: s,
            errors: errors
          });
          continue;
        }

        // Get or create academic year
        const yearId = yearMap.get(academicYearName);
        if (!yearId) {
          failedRecords.push({
            row: rowNumber,
            data: s,
            errors: ["Academic year not found or could not be created"]
          });
          continue;
        }

        // Get class
        const targetClass = classMap.get(`${className}-${yearId}`);
        if (!targetClass) {
          failedRecords.push({
            row: rowNumber,
            data: s,
            errors: ["Class not found or could not be created"]
          });
          continue;
        }

        // Get or create section
        const [sectionObj] = await Section.findOrCreate({
          where: {
            school_id: instituteId,
            class_id: targetClass.id,
            name: sectionName,
          },
          defaults: {
            school_id: instituteId,
            class_id: targetClass.id,
            academic_year_id: yearId,
            name: sectionName,
            capacity: 40,
          },
          transaction,
        });

        // Update class JSONB sections
        let sectionsArray = Array.isArray(targetClass.sections)
          ? [...targetClass.sections]
          : [];
        if (!sectionsArray.some((sec) => sec.id === sectionObj.id)) {
          sectionsArray.push({ id: sectionObj.id, name: sectionObj.name });
          targetClass.sections = sectionsArray;
          await targetClass.save({ transaction });
        }

        // Generate unique registration number
        let registrationNo = registrationNoProvided;
        if (!registrationNo) {
          registrationNo = await generateRegistrationNo(instituteId, instituteType);
          // Ensure uniqueness within batch and existing
          let counter = 0;
          while (existingRegNos.has(registrationNo) ||
            usersToCreate.some(u => u.registration_no === registrationNo)) {
            registrationNo = await generateRegistrationNo(instituteId, instituteType);
            counter++;
            if (counter > 5) {
              registrationNo = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
              break;
            }
          }
        } else {
          // Check if provided registration number is unique
          if (existingRegNos.has(registrationNo)) {
            errors.push(`Registration number "${registrationNo}" already exists`);
            failedRecords.push({
              row: rowNumber,
              data: s,
              errors: errors
            });
            continue;
          }
        }

        existingRegNos.add(registrationNo);

        // Generate roll number
        let rollNo = rollNoProvided;
        if (!rollNo) {
          if (!sectionCounters.has(sectionObj.id)) {
            // Get current max roll number for this section
            const existingStudentsInSection = await User.count({
              where: {
                school_id: instituteId,
                user_type: "STUDENT",
                [Op.and]: Sequelize.literal(
                  `details->'studentDetails'->>'section_id' = '${sectionObj.id}'`
                )
              },
              transaction
            });
            sectionCounters.set(sectionObj.id, existingStudentsInSection + 1);
          }
          const currentSeq = sectionCounters.get(sectionObj.id);
          const classCode = (targetClass.name?.slice(0, 2) || "CL").toUpperCase();
          const yrCode = String(new Date().getFullYear()).slice(-2);
          rollNo = `${classCode}-${sectionName}-${yrCode}-${String(currentSeq).padStart(3, "0")}`;
          sectionCounters.set(sectionObj.id, currentSeq + 1);
        }

        // Generate password
        const password = generateRandomPassword(8);
        const hashedPassword = await bcrypt.hash(password, 10);

        // Safely parse date fields
        const dob = s.dob || s.date_of_birth;
        const admissionDate = s.admission_date || s.admissionDate || new Date();

        // Prepare student details with safe values
        const studentDetails = {
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          registration_no: registrationNo,
          roll_no: rollNo,
          class_id: targetClass.id,
          class_name: targetClass.name,
          section_id: sectionObj.id,
          section_name: sectionObj.name,
          academic_year_id: yearId,
          academic_year_name: academicYearName,
          date_of_birth: dob || null,
          admission_date: admissionDate,
          gender: safeString(s.gender) || null,
          blood_group: safeString(s.blood_group) || null,
          religion: safeString(s.religion) || null,
          nationality: safeString(s.nationality) || "Pakistani",
          cnic: safeString(s.cnic) || null,
          father_name: safeString(s.father_name) || null,
          father_cnic: safeString(s.father_cnic) || null,
          father_phone: safeString(s.father_phone) || null,
          father_occupation: safeString(s.father_occupation) || null,
          mother_name: safeString(s.mother_name) || null,
          mother_phone: safeString(s.mother_phone) || null,
          present_address: safeString(s.present_address) || null,
          permanent_address: safeString(s.permanent_address) || null,
          city: safeString(s.city) || null,
          academicSessions: [
            {
              academic_year_id: yearId,
              academic_year_name: academicYearName,
              class_id: targetClass.id,
              class_name: targetClass.name,
              section_id: sectionObj.id,
              section_name: sectionObj.name,
              roll_no: rollNo,
              status: "active",
              start_date: admissionDate,
              end_date: null,
            },
          ],
        };

        // Store user data with password for later use
        usersToCreate.push({
          id: uuidv4(),
          school_id: instituteId,
          role_id: studentRole.id,
          user_type: "STUDENT",
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          password_hash: hashedPassword,
          registration_no: registrationNo,
          details: {
            studentDetails: studentDetails,
          },
          is_active: true,
          created_by: options.created_by || null,
          // Store plain password temporarily for QR/Email
          _temp_password: password,
          _temp_email_sent: false
        });

        successfulRecords.push({
          row: rowNumber,
          name: `${firstName} ${lastName}`,
          registration_no: registrationNo,
          email: email || 'N/A',
          class: className,
          section: sectionName,
          roll_no: rollNo
        });

      } catch (error) {
        console.error(`❌ Error processing row ${rowNumber}:`, error);
        failedRecords.push({
          row: rowNumber,
          data: s,
          errors: [error.message || "Unknown error processing record"]
        });
      }
    }

    // ========== STEP 5: BULK CREATE STUDENTS ==========
    const createdStudents = [];
    const studentsWithQR = [];

    if (usersToCreate.length > 0) {
      console.log(`📝 Creating ${usersToCreate.length} students...`);

      // Remove temp fields for bulk create
      const usersForCreate = usersToCreate.map(({ _temp_password, _temp_email_sent, ...user }) => user);

      const created = await User.bulkCreate(usersForCreate, {
        transaction,
        validate: true,
        individualHooks: true, // Enable individual hooks for better validation
      });

      // ========== STEP 6: GENERATE QR CODES & SEND EMAILS ==========
      console.log(`🔲 Generating QR codes for ${created.length} students...`);

      for (let i = 0; i < created.length; i++) {
        const user = created[i];
        const tempData = usersToCreate[i];
        const password = tempData._temp_password;

        try {
          // Generate QR Code
          const fullUser = {
            ...user.toJSON(),
            details: user.details
          };

          const qrCodeResult = await generateAndUploadQRCode(fullUser, instituteId);
          user.qr_code_url = qrCodeResult.url;
          user.qr_code_public_id = qrCodeResult.public_id;
          await user.save({ transaction });

          studentsWithQR.push({
            id: user.id,
            name: `${user.first_name} ${user.last_name}`,
            qr_url: qrCodeResult.url
          });

          // Send welcome email (if email exists)
          if (user.email && tempData._temp_email_sent === false) {
            const institute = await Institute.findByPk(instituteId);
            await sendWelcomeEmailWithCredentials(
              user,
              password,
              institute?.name || "The Clouds Academy",
              qrCodeResult.url,
              "Student",
            ).catch((err) => console.error(`⚠️ Email failed for ${user.email}:`, err.message));
            tempData._temp_email_sent = true;
          }

          // Small delay to avoid rate limiting on QR generation
          if (i % 10 === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (qrError) {
          console.error(`⚠️ QR Code generation failed for ${user.id}:`, qrError.message);
          // Don't fail the import, just log the error
        }
      }

      createdStudents.push(...created);
    }

    await transaction.commit();

    console.log(`✅ Bulk import completed: ${createdStudents.length} successful, ${failedRecords.length} failed`);

    return {
      imported: createdStudents.length,
      total: studentsData.length,
      failed: failedRecords,
      successful: successfulRecords,
      qr_generated: studentsWithQR.length
    };

  } catch (error) {
    await transaction.rollback();
    console.error("❌ Bulk Import Error:", error);

    // Provide detailed error information
    let errorMessage = error.message;
    if (error.errors && Array.isArray(error.errors)) {
      errorMessage = error.errors.map(e => e.message).join(", ");
    }

    throw new Error(`Bulk import failed: ${errorMessage}`);
  }
};

// ==================== CHECK PROMOTION ELIGIBILITY (with full student details) ====================
export const isStudentEligibleForPromotion = async (studentId, academicYearId) => {
  const examResults = await ExamResult.findAll({
    where: { student_id: studentId },
    include: [{
      model: Exam,
      as: 'exam',
      where: { academic_year_id: academicYearId },
      required: true
    }]
  });

  if (examResults.length === 0) {
    return { eligible: true, reason: null };
  }

  const failedResults = examResults.filter(r => r.status === 'fail');
  if (failedResults.length > 0) {
    const failedSubjects = failedResults.flatMap(r => r.subject_marks?.filter(sm => sm.status === 'fail') || []);
    const subjects = failedSubjects.map(s => s.subject_name).join(', ');
    return { eligible: false, reason: `Failed in: ${subjects || 'one or more subjects'}` };
  }

  return { eligible: true, reason: null };
};

// ==================== SINGLE STUDENT PROMOTION (with full previous session) ====================
export const promoteStudent = async (studentId, instituteId, promotionData, options = {}) => {
  const { targetClassId, targetSectionId, targetAcademicYearId, force = false, startDate = new Date() } = promotionData;
  const { transaction } = options;

  const student = await User.findOne({
    where: { id: studentId, school_id: instituteId, user_type: 'STUDENT' },
    transaction
  });
  if (!student) throw new Error('Student not found');

  const sessions = student.details?.studentDetails?.academicSessions || [];
  const activeSession = sessions.find(s => s.status === 'active');
  if (!activeSession) throw new Error('No active academic session found');

  const currentAcademicYearId = activeSession.academic_year_id;

  // Check eligibility (unless forced)
  if (!force) {
    const { eligible, reason } = await isStudentEligibleForPromotion(studentId, currentAcademicYearId);
    if (!eligible) {
      throw new Error(`Student not eligible for promotion: ${reason}`);
    }
  }

  // Get target class/section details
  const classSectionInfo = await getClassSectionDetails(targetClassId, targetSectionId);
  if (!classSectionInfo.class_name) throw new Error('Target class not found');

  // Generate new roll number
  let newRollNo = promotionData.roll_no;
  if (!newRollNo) {
    newRollNo = await generateRollNoFromClassInfo(instituteId, {
      class_id: targetClassId,
      section_id: targetSectionId,
      academic_year_id: targetAcademicYearId
    });
  }

  // Prepare old session snapshot (with full details)
  const oldSessionSnapshot = { ...activeSession };

  // Deactivate current active session
  sessions.forEach(session => {
    if (session.status === 'active') {
      session.status = 'completed';
      session.end_date = new Date();
    }
  });

  // Create new session
  const newSession = {
    academic_year_id: targetAcademicYearId,
    academic_year_name: null,
    class_id: targetClassId,
    class_name: classSectionInfo.class_name,
    section_id: targetSectionId,
    section_name: classSectionInfo.section_name,
    roll_no: newRollNo,
    status: 'active',
    start_date: startDate,
    end_date: null
  };

  sessions.unshift(newSession);

  // Update student details
  const studentDetails = student.details?.studentDetails || {};
  studentDetails.class_id = targetClassId;
  studentDetails.class_name = classSectionInfo.class_name;
  studentDetails.section_id = targetSectionId;
  studentDetails.section_name = classSectionInfo.section_name;
  studentDetails.roll_no = newRollNo;
  studentDetails.academic_year_id = targetAcademicYearId;
  studentDetails.academicSessions = sessions;

  student.details = { ...student.details, studentDetails };
  student.changed('details', true);
  await student.save({ transaction });

  // Return full student object with new session and old session snapshot
  return {
    success: true,
    studentId,
    student: {
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      email: student.email,
      phone: student.phone,
      registration_no: student.registration_no,
      current_session: newSession,
    },
    previous_session: oldSessionSnapshot,
    new_session: newSession,
    forced: force
  };
};

// ==================== BULK PROMOTION BY ACADEMIC YEAR (Entire Class) ====================
export const bulkPromoteWholeClass = async (instituteId, fromClassId, toClassId, toSectionId, targetAcademicYearId, force = false) => {
  return await bulkPromoteByClass(instituteId, fromClassId, toClassId, toSectionId, targetAcademicYearId, { force });
};

// ==================== BULK PROMOTION BY CLASS ====================
export const bulkPromoteByClass = async (instituteId, fromClassId, toClassId, toSectionId, targetAcademicYearId, options = {}) => {
  const { force = false, startDate = new Date() } = options;

  const allStudents = await User.findAll({
    where: {
      school_id: instituteId,
      user_type: 'STUDENT',
      is_active: true
    }
  });

  const studentsToPromote = [];
  for (const student of allStudents) {
    const sessions = student.details?.studentDetails?.academicSessions || [];
    const active = sessions.find(s => s.status === 'active');
    if (active && active.class_id === fromClassId) {
      studentsToPromote.push(student);
    }
  }

  const results = {
    total: studentsToPromote.length,
    promoted: [],
    failed: []
  };

  for (const student of studentsToPromote) {
    try {
      const promotionResult = await promoteStudent(student.id, instituteId, {
        targetClassId: toClassId,
        targetSectionId: toSectionId,
        targetAcademicYearId,
        force,
        startDate
      }, { transaction: null });
      results.promoted.push(promotionResult);
    } catch (error) {
      results.failed.push({
        studentId: student.id,
        name: `${student.first_name} ${student.last_name}`,
        error: error.message
      });
    }
  }

  return results;
};

// ==================== GET PROMOTION ELIGIBILITY FOR A CLASS (with full student details) ====================
export const getClassPromotionEligibility = async (instituteId, classId, academicYearId) => {
  const allStudents = await User.findAll({
    where: {
      school_id: instituteId,
      user_type: 'STUDENT',
      is_active: true
    },
    attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'registration_no', 'avatar_url', 'details']
  });

  const studentsInClass = [];
  for (const student of allStudents) {
    const sessions = student.details?.studentDetails?.academicSessions || [];
    const active = sessions.find(s => s.status === 'active');
    if (active && active.class_id === classId && active.academic_year_id === academicYearId) {
      // Attach current active session info to student
      const flatStudent = {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        phone: student.phone,
        registration_no: student.registration_no,
        avatar_url: student.avatar_url,
        current_session: {
          class_id: active.class_id,
          class_name: active.class_name,
          section_id: active.section_id,
          section_name: active.section_name,
          roll_no: active.roll_no,
          academic_year_id: active.academic_year_id,
          start_date: active.start_date,
        }
      };
      studentsInClass.push({ student: flatStudent, activeSession: active });
    }
  }

  const eligibilityResults = [];
  for (const { student, activeSession } of studentsInClass) {
    const { eligible, reason } = await isStudentEligibleForPromotion(student.id, academicYearId);
    eligibilityResults.push({
      studentId: student.id,
      name: `${student.first_name} ${student.last_name}`,
      eligible,
      reason,
      student: {
        ...student,
        current_class: activeSession.class_name,
        current_section: activeSession.section_name,
        current_roll_no: activeSession.roll_no,
      }
    });
  }

  return {
    total: studentsInClass.length,
    eligibleCount: eligibilityResults.filter(e => e.eligible).length,
    ineligibleCount: eligibilityResults.filter(e => !e.eligible).length,
    details: eligibilityResults
  };
};

export const searchStudents = async (instituteId, searchQuery, limit = 20) => {
  if (!searchQuery || searchQuery.trim().length < 2) {
    return { data: [], total: 0 };
  }

  const trimmed = searchQuery.trim();
  const searchTerm = `%${trimmed}%`;
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  
  const orConditions = [
    { first_name: { [Op.iLike]: searchTerm } },
    { last_name: { [Op.iLike]: searchTerm } },
    { email: { [Op.iLike]: searchTerm } },
    { phone: { [Op.iLike]: searchTerm } },
    { registration_no: { [Op.iLike]: searchTerm } },
    sequelize.literal(`details->'studentDetails'->>'roll_no' ILIKE '${searchTerm.replace(/'/g, "''")}'`),
    sequelize.literal(`CONCAT(first_name, ' ', last_name) ILIKE '${searchTerm.replace(/'/g, "''")}'`)
  ];
  
  // Handle multi-word names with AND logic (all words must appear in name)
  if (words.length > 1) {
    const wordAndConditions = words.map(word => {
      const wordTerm = `%${word}%`;
      return {
        [Op.or]: [
          { first_name: { [Op.iLike]: wordTerm } },
          { last_name: { [Op.iLike]: wordTerm } }
        ]
      };
    });
    orConditions.push({ [Op.and]: wordAndConditions });
  }
  
  const students = await User.findAll({
    where: {
      school_id: instituteId,
      user_type: 'STUDENT',
      [Op.or]: orConditions
    },
    // Fetch all needed attributes including details
    attributes: [
      'id', 'school_id', 'role_id', 'user_type', 'first_name', 'last_name', 
      'email', 'phone', 'registration_no', 'avatar_url', 'is_active', 'details',
      'created_at', 'updated_at'
    ],
    include: [
      {
        model: Role,
        as: "Role",
        attributes: ["id", "name", "permissions"],
      },
    ],
    limit: parseInt(limit),
    order: [['first_name', 'ASC']]
  });

  // Resolve Class/Section names just like in getAllStudents
  await resolveStudentRelations(students);

  return { data: students, total: students.length, query: searchQuery };
};

export default {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  bulkDeleteStudents,
  toggleStudentStatus,
  addAcademicSession,
  getStudentsByClass,
  getStudentsBySection,
  getStudentStats,
  bulkImportStudents,
  promoteStudent,
  bulkPromoteByClass,
  bulkPromoteWholeClass,
  getClassPromotionEligibility,
  isStudentEligibleForPromotion,
  searchStudents
};