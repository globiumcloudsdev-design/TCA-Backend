
// backend/src/services/student.service.js
/**
 * The Clouds Academy - Student Service
 * 
 * Students are User records with user_type = 'STUDENT'.
 * Class and Section data comes from separate models.
 */

import models, { sequelize } from '../models/postgres/index.js';
import Sequelize, { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { generateRandomPassword } from '../utils/passwordGenerator.js';
import { generateRegistrationNo } from '../utils/generators/registrationNo.generator.js';
import { generateRollNoFromClassInfo } from '../utils/generators/rollNo.generator.js';
import { generateAndUploadQRCode } from '../utils/qrCodeGenerator.js';
import { sendWelcomeEmailWithCredentials } from './email.service.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';

const { User, Role, Institute, Class, Section } = models;

const getLatestSessionForStudent = (studentDetails = {}) => {
  const sessions = Array.isArray(studentDetails?.academicSessions) ? studentDetails.academicSessions : [];
  if (!sessions.length) return null;

  const withTs = sessions
    .filter((session) => session && (session.class_id || session.section_id || session.class_name || session.section_name))
    .map((session) => ({
      ...session,
      status_normalized: String(session.status || '').toLowerCase(),
      start_ts: Number(new Date(session.start_date || 0)),
      end_ts: Number(new Date(session.end_date || 0))
    }));

  const active = withTs
    .filter((session) => session.status_normalized === 'active')
    .sort((a, b) => b.start_ts - a.start_ts);

  if (active.length) return active[0];

  const latest = withTs.sort((a, b) => {
    const bKey = Number.isFinite(b.end_ts) && b.end_ts > 0 ? b.end_ts : b.start_ts;
    const aKey = Number.isFinite(a.end_ts) && a.end_ts > 0 ? a.end_ts : a.start_ts;
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
      is_active: true
    },
    attributes: ['id', 'name', 'permissions', 'school_id', 'is_template', 'is_active']
  });
  
  const studentInstituteRole = instituteRoles.find(role => 
    role.permissions && 
    (Array.isArray(role.permissions.student) || role.permissions.student === 'ALL')
  );
  
  if (studentInstituteRole) {
    return studentInstituteRole;
  }
  
  // Template roles
  const templateRoles = await Role.findAll({
    where: {
      school_id: null,
      is_template: true,
      is_active: true
    },
    attributes: ['id', 'name', 'permissions', 'school_id', 'is_template', 'is_active']
  });
  
  const studentTemplateRole = templateRoles.find(role => 
    role.permissions && 
    (Array.isArray(role.permissions.student) || role.permissions.student === 'ALL')
  );
  
  if (studentTemplateRole) {
    return studentTemplateRole;
  }
  
  // Fallback
  return {
    id: null,
    name: 'Student',
    permissions: { student: ['dashboard.view.self', 'attendance.view.self', 'results.view.self'] }
  };
};

/**
 * Get class and section details from database
 */
const getClassSectionDetails = async (classId, sectionId) => {
  const classInfo = classId ? await Class.findByPk(classId, {
    attributes: ['id', 'name', 'academic_year_id', 'sections']
  }) : null;
  
  let sectionInfo = sectionId ? await Section.findByPk(sectionId, {
    attributes: ['id', 'name', 'room_number']
  }) : null;

  // In this codebase, many institutes keep sections inside Class.sections JSON.
  // Fallback to class-embedded sections when standalone Section row is missing.
  if (!sectionInfo && sectionId && classInfo) {
    const embeddedSections = Array.isArray(classInfo.sections) ? classInfo.sections : [];
    const matched = embeddedSections.find((section) => String(section?.id || section?.section_id || '') === String(sectionId));
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
    room_no: sectionInfo?.room_number || null
  };
};

/**
 * Create student
 */
export const createStudent = async (data, options = {}) => {
  const { transaction } = options;
  
  try {
    console.log('📝 Creating student with data:', data);
    
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
        data.institute_type || 'school'
      );
    }
    
    // 4. Get role permissions
    let rolePermissions = [];
    if (studentRole.permissions) {
      if (studentRole.permissions.student === 'ALL') {
        rolePermissions = ['ALL'];
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
        academic_year_id: classSectionInfo.academic_year_id
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
      status: 'active',
      start_date: data.admission_date || new Date(),
      end_date: null
    };
    
    academicSessions.push(currentSession);
    
    // 8. Prepare student details
    const studentDetails = {
      // Basic Info
      date_of_birth: data.dob || data.date_of_birth,
      gender: data.gender,
      blood_group: data.blood_group,
      religion: data.religion,
      nationality: data.nationality || 'Pakistani',
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
      guardians: (data.guardians && Array.isArray(data.guardians) && data.guardians.length > 0) 
        ? data.guardians.map(g => ({
            name: g.name,
            relation: (g.type || g.relation || 'guardian').toLowerCase(),
            phone: g.phone,
            cnic: g.cnic,
            email: g.email || null,
            type: (g.type || g.relation || 'guardian').toLowerCase()
          }))
        : (data.guardian_name ? [{
            name: data.guardian_name,
            relation: data.guardian_relation,
            phone: data.guardian_phone,
            cnic: data.guardian_cnic,
            email: data.guardian_email || null,
            type: 'guardian'
          }] : []),
      
      // Contact Info
      present_address: data.present_address,
      permanent_address: data.permanent_address,
      city: data.city,
      
      // Fee Info
      fee_plan_id: data.fee_plan_id,
      monthly_fee: data.monthly_fee,
      admission_fee: data.admission_fee,
      concession_type: data.concession_type || 'none',
      concession_percentage: data.concession_percentage || 0,
      concession_reason: data.concession_reason,
      
      // Medical Info
      medical_conditions: data.medical_conditions,
      allergies: data.allergies,
      
      // Previous School
      previous_school: data.previous_school,
      previous_class: data.previous_class,
      
      // Status
      status: data.status || 'active',
    };
    
    // 9. Prepare documents
    const documents = (data.documents || []).map(doc => ({
      id: doc.id || uuidv4(),
      type: doc.type || 'other',
      title: doc.title || doc.file_name,
      file_name: doc.file_name,
      file_url: doc.file_url,
      uploaded_at: new Date(),
      verified: doc.verified || false
    }));
    
    // 10. Create user
    const userData = {
      id: uuidv4(),
      school_id: data.institute_id,
      role_id: studentRole.id,
      user_type: 'STUDENT',
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || null,
      phone: data.phone,
      password_hash: hashedPassword,
      registration_no: registrationNo,
      permissions: rolePermissions,
      avatar_url: data.avatar_url || data.photo_url || null,
      avatar_public_id: data.avatar_public_id || data.photo_public_id || null,
      details: {
        studentDetails: {
          ...studentDetails,
          academicSessions: academicSessions
        }
      },
      documents: documents,
      is_active: true,
      created_by: data.created_by
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
        institute?.name || 'The Clouds Academy',
        qrCodeResult.url,
        'Student'
      ).catch(err => console.error('Email sending failed:', err));
    }
    
    return {
      user,
      password,
      role: studentRole
    };
    
  } catch (error) {
    console.error('❌ Student creation failed:', error);
    throw error;
  }
};

/**
 * Get all students with class and section details
 */
export const getAllStudents = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;
  
  const where = { 
    school_id: filters.institute_id,
    user_type: 'STUDENT'
  };
  
  if (filters.search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${filters.search}%` } },
      { last_name: { [Op.iLike]: `%${filters.search}%` } },
      { email: { [Op.iLike]: `%${filters.search}%` } },
      { registration_no: { [Op.iLike]: `%${filters.search}%` } }
    ];
  }
  
  if (filters.status === 'active') where.is_active = true;
  if (filters.status === 'inactive') where.is_active = false;
  
  // Filter by class_id (direct match in JSON)
  if (filters.class_id) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(Sequelize.literal(`"User"."details"->'studentDetails'->>'class_id' = '${filters.class_id}'`));
  }
  
  // Filter by section_id
  if (filters.section_id) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(Sequelize.literal(`"User"."details"->'studentDetails'->>'section_id' = '${filters.section_id}'`));
  }
  
  // Filter by academic_year_id
  if (filters.academic_year_id) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(Sequelize.literal(`"User"."details"->'studentDetails'->>'academic_year_id' = '${filters.academic_year_id}'`));
  }
  
  const { count, rows } = await User.findAndCountAll({
    where,
    include: [
      {
        model: Role,
        as: 'Role',
        attributes: ['id', 'name', 'permissions']
      }
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset
  });

  // Normalize class/section names from source tables to avoid stale JSON values.
  const classIds = new Set();
  const sectionIds = new Set();

  rows.forEach((student) => {
    const details = student?.details?.studentDetails || student?.details || {};
    const activeSession = getLatestSessionForStudent(details);
    const classId = activeSession?.class_id || details?.class_id;
    const sectionId = activeSession?.section_id || details?.section_id;

    if (classId) classIds.add(classId);
    if (sectionId) sectionIds.add(sectionId);
  });

  const [classes, sections] = await Promise.all([
    classIds.size
      ? Class.findAll({ where: { id: { [Op.in]: Array.from(classIds) } }, attributes: ['id', 'name'] })
      : Promise.resolve([]),
    sectionIds.size
      ? Section.findAll({ where: { id: { [Op.in]: Array.from(sectionIds) } }, attributes: ['id', 'name'] })
      : Promise.resolve([])
  ]);

  const classNameMap = new Map(classes.map((cls) => [cls.id, cls.name]));
  const sectionNameMap = new Map(sections.map((section) => [section.id, section.name]));

  rows.forEach((student) => {
    const details = student?.details || {};
    const studentDetails = details?.studentDetails || {};
    const activeSession = getLatestSessionForStudent(studentDetails);
    const classId = activeSession?.class_id || studentDetails?.class_id;
    const sectionId = activeSession?.section_id || studentDetails?.section_id;

    const resolvedClassName = classId
      ? (classNameMap.get(classId) || activeSession?.class_name || studentDetails.class_name || null)
      : (activeSession?.class_name || studentDetails.class_name);
    const resolvedSectionName = sectionId
      ? (sectionNameMap.get(sectionId) || activeSession?.section_name || studentDetails.section_name || null)
      : (activeSession?.section_name || studentDetails.section_name);

    if (!details.studentDetails) {
      details.studentDetails = {};
    }

    details.studentDetails.class_id = classId || details.studentDetails.class_id || null;
    details.studentDetails.section_id = sectionId || details.studentDetails.section_id || null;
    details.studentDetails.class_name = resolvedClassName;
    details.studentDetails.section_name = resolvedSectionName;
    student.details = details;
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
 * Get student by ID
 */
export const getStudentById = async (id, instituteId) => {
  return await User.findOne({
    where: { id, school_id: instituteId, user_type: 'STUDENT' },
    include: [
      {
        model: Role,
        as: 'Role',
        attributes: ['id', 'name', 'permissions']
      }
    ]
  });
};

/**
 * Update student
 */
export const updateStudent = async (id, instituteId, updateData, options = {}) => {
  const { transaction } = options;
  
  const user = await User.findOne({
    where: { id, school_id: instituteId, user_type: 'STUDENT' }
  });
  
  if (!user) {
    throw new Error('Student not found');
  }
  
  console.log('📝 Updating student with data:', updateData);
  
  // Update basic fields
  if (updateData.first_name !== undefined) user.first_name = updateData.first_name;
  if (updateData.last_name !== undefined) user.last_name = updateData.last_name;
  if (updateData.email !== undefined) user.email = updateData.email;
  if (updateData.phone !== undefined) user.phone = updateData.phone;
  if (updateData.is_active !== undefined) user.is_active = updateData.is_active;
  if (updateData.registration_no !== undefined) user.registration_no = updateData.registration_no;
  
  // Get existing details
  const existingDetails = user.details?.studentDetails || {};
  const existingSessions = user.details?.studentDetails?.academicSessions || user.details?.academicSessions || [];
  
  // Resolve incoming class/section with safe fallback to existing values
  const incomingClassId = updateData.class_id ?? updateData.details?.studentDetails?.class_id;
  const incomingSectionId = updateData.section_id ?? updateData.details?.studentDetails?.section_id;
  const newClassId = incomingClassId || existingDetails.class_id || null;
  const newSectionId = incomingSectionId || existingDetails.section_id || null;

  let classSectionInfo = await getClassSectionDetails(newClassId, newSectionId);
  let newRollNo = updateData.roll_no || existingDetails.roll_no;
  const classOrSectionChanged = (
    (newClassId && newClassId !== existingDetails.class_id)
    || (newSectionId && newSectionId !== existingDetails.section_id)
  );
  
  // If class or section changed, get new info and generate new roll number
  if (classOrSectionChanged) {
    // Generate new roll number if not provided
    if (!updateData.roll_no && newClassId && newSectionId) {
      newRollNo = await generateRollNoFromClassInfo(instituteId, {
        class_id: newClassId,
        section_id: newSectionId,
        academic_year_id: classSectionInfo.academic_year_id
      });
    }
    
    // Add new academic session
    const newSession = {
      academic_year_id: classSectionInfo.academic_year_id || existingDetails.academic_year_id,
      class_id: newClassId || existingDetails.class_id,
      class_name: classSectionInfo.class_name || existingDetails.class_name,
      section_id: newSectionId || existingDetails.section_id,
      section_name: classSectionInfo.section_name || existingDetails.section_name,
      roll_no: newRollNo,
      status: 'active',
      start_date: new Date(),
      end_date: null
    };
    
    // Deactivate current active session (do not assume index 0 is active)
    existingSessions.forEach((session) => {
      if (String(session?.status || '').toLowerCase() === 'active') {
        session.status = 'completed';
        session.end_date = new Date();
      }
    });
    
    existingSessions.unshift(newSession);
  } else {
    // Keep active session metadata aligned with currently selected class/section.
    existingSessions.forEach((session) => {
      if (String(session?.status || '').toLowerCase() === 'active') {
        session.class_id = newClassId || session.class_id || null;
        session.class_name = classSectionInfo.class_name || session.class_name || existingDetails.class_name || null;
        session.section_id = newSectionId || session.section_id || null;
        session.section_name = classSectionInfo.section_name || session.section_name || existingDetails.section_name || null;
        session.roll_no = updateData.roll_no || session.roll_no || newRollNo || null;
        session.academic_year_id = classSectionInfo.academic_year_id || session.academic_year_id || existingDetails.academic_year_id || null;
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
    ...(updateData.blood_group !== undefined && { blood_group: updateData.blood_group }),
    ...(updateData.religion !== undefined && { religion: updateData.religion }),
    ...(updateData.nationality !== undefined && { nationality: updateData.nationality }),
    ...(updateData.cnic !== undefined && { cnic: updateData.cnic }),
    
    // Academic - use new values if changed
    ...(newClassId && { class_id: newClassId }),
    class_name: classSectionInfo.class_name || existingDetails.class_name || null,
    ...(newSectionId && { section_id: newSectionId }),
    section_name: classSectionInfo.section_name || existingDetails.section_name || null,
    ...(updateData.roll_no && { roll_no: updateData.roll_no }),
    ...(newRollNo && !updateData.roll_no && { roll_no: newRollNo }),
    ...(classSectionInfo.academic_year_id && { academic_year_id: classSectionInfo.academic_year_id }),
    ...(updateData.admission_date && { admission_date: updateData.admission_date }),
    
    // Parent info
    ...(updateData.father_name !== undefined && { father_name: updateData.father_name }),
    ...(updateData.father_cnic !== undefined && { father_cnic: updateData.father_cnic }),
    ...(updateData.father_phone !== undefined && { father_phone: updateData.father_phone }),
    ...(updateData.father_occupation !== undefined && { father_occupation: updateData.father_occupation }),
    
    ...(updateData.mother_name !== undefined && { mother_name: updateData.mother_name }),
    ...(updateData.mother_phone !== undefined && { mother_phone: updateData.mother_phone }),
    
    ...(updateData.guardian_name !== undefined && { guardian_name: updateData.guardian_name }),
    ...(updateData.guardian_relation !== undefined && { guardian_relation: updateData.guardian_relation }),
    ...(updateData.guardian_phone !== undefined && { guardian_phone: updateData.guardian_phone }),
    
    // Address
    ...(updateData.present_address !== undefined && { present_address: updateData.present_address }),
    ...(updateData.permanent_address !== undefined && { permanent_address: updateData.permanent_address }),
    ...(updateData.city !== undefined && { city: updateData.city }),
    
    // Fee
    ...(updateData.monthly_fee !== undefined && { monthly_fee: updateData.monthly_fee }),
    ...(updateData.admission_fee !== undefined && { admission_fee: updateData.admission_fee }),
    ...(updateData.concession_type !== undefined && { concession_type: updateData.concession_type }),
    ...(updateData.concession_percentage !== undefined && { concession_percentage: updateData.concession_percentage }),
    
    // Medical
    ...(updateData.medical_conditions !== undefined && { medical_conditions: updateData.medical_conditions }),
    ...(updateData.allergies !== undefined && { allergies: updateData.allergies }),
    
    // Previous
    ...(updateData.previous_school !== undefined && { previous_school: updateData.previous_school }),
    ...(updateData.previous_class !== undefined && { previous_class: updateData.previous_class }),

    // Guardians (type is source of truth for relation)
    ...(updateData.guardians !== undefined && {
      guardians: (Array.isArray(updateData.guardians) ? updateData.guardians : []).map((g) => ({
        name: g.name,
        type: (g.type || g.relation || 'guardian').toLowerCase(),
        relation: (g.type || g.relation || 'guardian').toLowerCase(),
        phone: g.phone,
        cnic: g.cnic,
        email: g.email || null,
      }))
    }),
  };
  
  // Update documents if provided
  if (updateData.documents !== undefined) {
    try {
      const documents = Array.isArray(updateData.documents) 
        ? updateData.documents 
        : (typeof updateData.documents === 'string' ? JSON.parse(updateData.documents) : []);
      
      const newDocs = documents.map(doc => ({
        id: doc.id || uuidv4(),
        type: doc.type || 'other',
        title: doc.title || doc.file_name,
        file_name: doc.file_name,
        file_url: doc.file_url,
        public_id: doc.public_id,
        uploaded_at: doc.uploaded_at || new Date(),
        verified: doc.verified || false
      }));
      
      // Handle deletions from Cloudinary
      const existingDocs = user.documents || [];
      
      // Find deleted docs (present in existing but missing in new)
      for (const oldDoc of existingDocs) {
        // Match by public_id is safest if id is not reliable, or by id
        const isKept = newDocs.some(n => 
          (n.id && n.id === oldDoc.id) || 
          (n.public_id && n.public_id === oldDoc.public_id) ||
          (n.file_url && n.file_url === oldDoc.file_url)
        );
        
        if (!isKept && oldDoc.public_id) {
           console.log('🗑️ Deleting removed document:', oldDoc.public_id);
           await deleteFromCloudinary(oldDoc.public_id).catch(e => console.error('Cloudinary delete error:', e));
        }
      }
      
      user.documents = newDocs;
    } catch (error) {
      console.error('❌ Error parsing documents:', error);
    }
  } else if (updateData.documents === null) {
     // Explicitly clear documents if null
     const existingDocs = user.documents || [];
     for (const oldDoc of existingDocs) {
        if (oldDoc.public_id) {
           console.log('🗑️ Deleting removed document (clear all):', oldDoc.public_id);
           await deleteFromCloudinary(oldDoc.public_id).catch(e => console.error('Cloudinary delete error:', e));
        }
     }
     user.documents = [];
  }
  
  // Update details (Move academicSessions inside studentDetails)
  const newDetails = { ...user.details };
  delete newDetails.academicSessions; // Cleanup old location if present

  newDetails.studentDetails = {
    ...updatedStudentDetails,
    academicSessions: existingSessions
  };
  
  user.details = newDetails;
  
  user.changed('details', true);
  user.changed('documents', true);
  
  // Generate QR Code if missing
  if (!user.qr_code_url) {
    try {
      const fullUser = {
        ...user.toJSON(),
        details: user.details
      };
      
      // Removed generateAndUploadQRCode import check, assuming it exists based on line 856
      const qrCodeResult = await generateAndUploadQRCode(fullUser, instituteId);
      if (qrCodeResult) {
        user.qr_code_url = qrCodeResult.url;
        user.qr_code_public_id = qrCodeResult.public_id;
      }
    } catch (qrError) {
      console.error('⚠️ Failed to generate QR code on update:', qrError);
    }
  }
  
  await user.save({ transaction });
  
  return user;
};

/**
 * Add academic session (promote student)
 */
export const addAcademicSession = async (studentId, instituteId, sessionData, options = {}) => {
  const { transaction } = options;
  
  const user = await User.findOne({
    where: { id: studentId, school_id: instituteId, user_type: 'STUDENT' }
  });
  
  if (!user) {
    throw new Error('Student not found');
  }
  
  const existingSessions = user.details?.studentDetails?.academicSessions
    || user.details?.academicSessions
    || [];
  
  // Get class and section details
  const classSectionInfo = await getClassSectionDetails(
    sessionData.class_id, 
    sessionData.section_id
  );
  
  // Generate roll number if not provided
  let rollNo = sessionData.roll_no;
  if (!rollNo && sessionData.class_id && sessionData.section_id) {
    rollNo = await generateRollNoFromClassInfo(instituteId, {
      class_id: sessionData.class_id,
      section_id: sessionData.section_id,
      academic_year_id: classSectionInfo.academic_year_id
    });
  }
  
  // Deactivate current active session (do not assume index 0 is active)
  existingSessions.forEach((session) => {
    if (String(session?.status || '').toLowerCase() === 'active') {
      session.status = 'completed';
      session.end_date = new Date();
    }
  });
  
  // Add new session
  const newSession = {
    academic_year_id: classSectionInfo.academic_year_id || sessionData.academic_year_id,
    class_id: sessionData.class_id,
    class_name: classSectionInfo.class_name,
    section_id: sessionData.section_id,
    section_name: classSectionInfo.section_name,
    roll_no: rollNo,
    status: 'active',
    start_date: sessionData.start_date || new Date(),
    end_date: null
  };
  
  existingSessions.unshift(newSession);
  
  // Update current details
  if (user.details?.studentDetails) {
    user.details.studentDetails.class_id = sessionData.class_id;
    user.details.studentDetails.class_name = classSectionInfo.class_name;
    user.details.studentDetails.section_id = sessionData.section_id;
    user.details.studentDetails.section_name = classSectionInfo.section_name;
    user.details.studentDetails.roll_no = rollNo;
    user.details.studentDetails.academic_year_id = classSectionInfo.academic_year_id;
  }
  
  const existingDetails = user.details || {};
  const existingStudentDetails = existingDetails.studentDetails || {};

  user.details = {
    ...existingDetails,
    studentDetails: {
      ...existingStudentDetails,
      academicSessions: existingSessions
    }
  };
  
  user.changed('details', true);
  await user.save({ transaction });
  
  return user;
};

/**
 * Delete student (soft delete)
 */
export const deleteStudent = async (id, instituteId) => {
  const user = await User.findOne({
    where: { id, school_id: instituteId, user_type: 'STUDENT' }
  });
  
  if (!user) {
    throw new Error('Student not found');
  }
  
  await user.update({ is_active: false });
  return { message: 'Student deactivated successfully' };
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
        user_type: 'STUDENT'
      }
    }
  );
  
  return { deletedCount: result[0] };
};

/**
 * Toggle student status
 */
export const toggleStudentStatus = async (id, instituteId, isActive) => {
  const user = await User.findOne({
    where: { id, school_id: instituteId, user_type: 'STUDENT' }
  });
  
  if (!user) {
    throw new Error('Student not found');
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
    where: { school_id: instituteId, user_type: 'STUDENT' }
  });
  
  const active = await User.count({
    where: { school_id: instituteId, user_type: 'STUDENT', is_active: true }
  });
  
  const inactive = total - active;
  
  // Get gender distribution
  const maleCount = await User.count({
    where: { 
      school_id: instituteId, 
      user_type: 'STUDENT',
      'details.studentDetails.gender': 'male'
    }
  });
  
  const femaleCount = await User.count({
    where: { 
      school_id: instituteId, 
      user_type: 'STUDENT',
      'details.studentDetails.gender': 'female'
    }
  });
  
  return {
    total,
    active,
    inactive,
    gender: {
      male: maleCount,
      female: femaleCount,
      other: total - (maleCount + femaleCount)
    }
  };
};

// backend/src/services/student.service.js

/**
 * Bulk import students with full academic session handling
 * @param {Array} studentsData - Array of student objects from import file
 * @param {string} instituteId - Institute ID
 * @param {string} instituteType - school/coaching/academy/college/university
 * @param {object} options - Transaction options
 */
/**
 * Bulk import students - Simple version
 * Class ke ANDAR sections search honge
 */
// backend/src/services/student.service.js

export const bulkImportStudents = async (studentsData, instituteId, instituteType, options = {}) => {
  const results = {
    success: [],
    failed: [],
    total: studentsData.length,
    imported: 0,
    errors: []
  };

  const studentRole = await getStudentRole(instituteId);
  
  // Process each student in its OWN transaction
  for (let i = 0; i < studentsData.length; i++) {
    const student = studentsData[i];
    const transaction = await sequelize.transaction(); // New transaction for each row
    
    try {
      // Validate minimum required fields
      if (!student.first_name || !student.last_name) {
        results.failed.push({
          row: i + 1,
          data: student,
          error: 'First name and last name are required'
        });
        await transaction.rollback();
        continue;
      }
      
      // Get class info if class_name provided
      let classInfo = null;
      let classId = null;
      let matchedSection = null;
      
      if (student.class_name) {
        classInfo = await models.Class.findOne({
          where: {
            school_id: instituteId,
            name: student.class_name,
            is_active: true
          },
          transaction
        });
        
        if (classInfo) {
          classId = classInfo.id;
          
          // Match section from class.sections JSON
          if (student.section_name && classInfo.sections) {
            const sections = Array.isArray(classInfo.sections) ? classInfo.sections : [];
            matchedSection = sections.find(s => 
              s.name === student.section_name || s.section_name === student.section_name
            );
          }
        }
      }
      
      // Generate registration number
      let registrationNo = student.registration_no;
      if (!registrationNo) {
        registrationNo = await generateRegistrationNo(instituteId, instituteType);
      }
      
      // Generate roll number
      let rollNo = student.roll_no;
      if (!rollNo && classId && matchedSection && classInfo?.academic_year_id) {
        rollNo = await generateRollNoFromClassInfo(instituteId, {
          class_id: classId,
          section_id: matchedSection.id,
          academic_year_id: classInfo.academic_year_id
        });
      }
      
      // Generate password
      const password = generateRandomPassword(8);
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Prepare academic session
      const academicSessions = [{
        academic_year_id: classInfo?.academic_year_id || null,
        class_id: classId,
        class_name: classInfo?.name || student.class_name,
        section_id: matchedSection?.id || null,
        section_name: matchedSection?.name || student.section_name,
        roll_no: rollNo,
        status: 'active',
        start_date: student.admission_date || new Date()
      }];
      
      // Prepare guardians
      let guardians = [];
      if (student.guardian_name) {
        guardians = [{
          name: student.guardian_name,
          relation: student.guardian_relation || 'guardian',
          phone: student.guardian_phone,
          cnic: student.guardian_cnic,
          email: student.guardian_email
        }];
      }
      
      // Prepare student details
      const studentDetails = {
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        phone: student.phone,
        date_of_birth: student.dob || student.date_of_birth,
        gender: student.gender,
        class_id: classId,
        class_name: classInfo?.name || student.class_name,
        section_id: matchedSection?.id,
        section_name: matchedSection?.name || student.section_name,
        roll_no: rollNo,
        guardians: guardians,
        present_address: student.present_address || student.address,
        city: student.city,
        monthly_fee: student.monthly_fee,
        fee_status: student.fee_status,
        is_active: student.is_active !== false,
        academicSessions: academicSessions,
        ...student // Copy all other fields
      };
      
      // Create user
      const userData = {
        id: uuidv4(),
        school_id: instituteId,
        role_id: studentRole.id,
        user_type: 'STUDENT',
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email || null,
        phone: student.phone || null,
        password_hash: hashedPassword,
        registration_no: registrationNo,
        permissions: [],
        details: {
          studentDetails: studentDetails
        },
        is_active: student.is_active !== false,
        created_by: options.created_by
      };
      
      const user = await models.User.create(userData, { transaction });
      
      // Generate QR Code (optional, don't fail if it errors)
      try {
        const qrCodeResult = await generateAndUploadQRCode(user, instituteId);
        user.qr_code_url = qrCodeResult.url;
        user.qr_code_public_id = qrCodeResult.public_id;
        await user.save({ transaction });
      } catch (qrError) {
        console.warn(`QR code failed for ${student.first_name}:`, qrError.message);
      }
      
      await transaction.commit();
      
      results.success.push({
        row: i + 1,
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        registration_no: registrationNo,
        temp_password: password
      });
      
      results.imported++;
      
    } catch (error) {
      await transaction.rollback();
      console.error(`Row ${i + 1} error:`, error.message);
      
      results.failed.push({
        row: i + 1,
        data: {
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          class_name: student.class_name
        },
        error: error.message
      });
      results.errors.push(`Row ${i + 1}: ${error.message}`);
    }
  }
  
  return results;
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
  bulkImportStudents
};