
// backend/src/services/teacher.service.js (UPDATED with QR Cloudinary)

import models, { sequelize } from '../models/postgres/index.js';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { generateRandomPassword } from '../utils/passwordGenerator.js';
import { generateAndUploadQRCode } from '../utils/qrCodeGenerator.js';
import { sendWelcomeEmailWithCredentials } from './email.service.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';

const { User, Role, Institute, StaffAttendance, Payslip, LeaveRequest, Timetable } = models;

/**
 * Get teacher role for institute
 */
const getTeacherRole = async (instituteId) => {
  
  // Institute-specific roles
  const instituteRoles = await Role.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    }
  });
  
  const teacherInstituteRole = instituteRoles.find(role => 
    role.permissions && 
    (Array.isArray(role.permissions.teacher) || role.permissions.teacher === 'ALL')
  );
  
  if (teacherInstituteRole) {
    return teacherInstituteRole;
  }
  
  // Template roles
  const templateRoles = await Role.findAll({
    where: {
      school_id: null,
      is_template: true,
      is_active: true
    }
  });
  
  const teacherTemplateRole = templateRoles.find(role => 
    role.permissions && 
    (Array.isArray(role.permissions.teacher) || role.permissions.teacher === 'ALL')
  );
  
  if (teacherTemplateRole) {
    return teacherTemplateRole;
  }
  
  console.log('❌ No teacher role found with permissions.teacher array');
  return null;
};

/**
 * Get teacher roles for dropdown
 */
export const getTeacherRoles = async (instituteId) => {
  const instituteRoles = await Role.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    },
    attributes: ['id', 'name', 'code', 'permissions']
  });
  
  const templateRoles = await Role.findAll({
    where: {
      school_id: null,
      is_template: true,
      is_active: true
    },
    attributes: ['id', 'name', 'code', 'permissions']
  });
  
  const allRoles = [...instituteRoles, ...templateRoles];
  
  const teacherRoles = allRoles.filter(role => 
    role.permissions && 
    (Array.isArray(role.permissions.teacher) || role.permissions.teacher === 'ALL')
  );
  
  
  return teacherRoles.map(role => ({
    id: role.id,
    name: role.name,
    code: role.code,
    permissions: role.permissions?.teacher || []
  }));
};

/**
 * Create teacher with complete details
 */
export const createTeacher = async (data, options = {}) => {
  const { transaction } = options;
  
  try {
    
    // 1. Get teacher role
    const teacherRole = await getTeacherRole(data.institute_id);
    if (!teacherRole) {
      throw new Error('Teacher role not found for this institute. Please create a role with teacher permissions first.');
    }
    // 2. Generate password
    const password = data.password || generateRandomPassword(10);
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 3. Generate employee ID
    const employeeId = data.employee_id || `TCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // 4. Get role permissions
    let rolePermissions = [];
    if (teacherRole.permissions) {
      if (teacherRole.permissions.teacher === 'ALL') {
        rolePermissions = ['ALL'];
      } else if (Array.isArray(teacherRole.permissions.teacher)) {
        rolePermissions = teacherRole.permissions.teacher;
      }
    }
    
    // 5. Prepare teacher details
    const teacherDetails = {
      employee_id: employeeId,
      qualification: data.qualification,
      specialization: data.specialization,
      experience_years: data.experience_years,
      previous_institution: data.previous_institution,
      subjects: data.subjects || [],
      joining_date: data.joining_date,
      contract_start_date: data.contract_start_date,
      contract_end_date: data.contract_end_date,
      salary: data.salary,
      bank_name: data.bank_name,
      bank_account_no: data.bank_account_no,
      bank_branch: data.bank_branch,
      designation: data.designation,
      department: data.department,
      employment_type: data.employment_type,
      emergency_contact_name: data.emergency_contact_name,
      emergency_contact_relation: data.emergency_contact_relation,
      emergency_contact_phone: data.emergency_contact_phone,
      present_address: data.present_address,
      permanent_address: data.permanent_address,
      city: data.city,
      date_of_birth: data.date_of_birth,
      gender: data.gender,
      blood_group: data.blood_group,
      religion: data.religion,
      nationality: data.nationality || 'Pakistani',
      cnic: data.cnic,
      status: data.status || 'active',
      // ✅ Map photo_url to avatar_url (from Cloudinary upload)
      avatar_url: data.photo_url || data.avatar_url || null,
      avatar_public_id: data.photo_public_id || data.avatar_public_id || null,
    };
    
    // 6. Prepare documents
    const documents = (data.documents || []).map(doc => ({
      id: doc.id || uuidv4(),
      type: doc.type,
      title: doc.title,
      file_name: doc.file_name,
      file_url: doc.file_url,
      uploaded_at: new Date(),
      verified: doc.verified || false
    }));
    
    // 7. Create user (without QR code first)
    const userData = {
      id: uuidv4(),
      school_id: data.institute_id,
      branch_id: data.branch_id || null,
      role_id: teacherRole.id,
      user_type: 'TEACHER',
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      password_hash: hashedPassword,
      registration_no: employeeId,
      permissions: rolePermissions,
      avatar_url: data.photo_url || data.avatar_url || null,
      avatar_public_id: data.photo_public_id || data.avatar_public_id || null,
      details: {
        teacherDetails: teacherDetails,
      },
      documents: documents,
      is_active: true,
      created_by: data.created_by
    };
    
    const user = await User.create(userData, { transaction });
    
    // 8. Generate and upload QR Code to Cloudinary
    const institute = await Institute.findByPk(data.institute_id);
        
    const qrCodeResult = await generateAndUploadQRCode(
      user, 
      data.institute_id
      // No oldPublicId for new teacher
    );
    
    // 9. Update user with QR code URL and public_id
    user.qr_code_url = qrCodeResult.url;
    user.qr_code_public_id = qrCodeResult.public_id; // Add this field to User model if not exists
    await user.save({ transaction });
    
    // 10. Send welcome email
    if (user.email && data.send_email !== false) {
      await sendWelcomeEmailWithCredentials(
        user, 
        password, 
        institute?.name || 'The Clouds Academy',
        qrCodeResult.url,
        teacherRole.name
      ).catch(err => console.error('Email sending failed:', err));
    }
    
    return {
      user,
      password,
      role: teacherRole
    };
    
  } catch (error) {
    console.error('❌ Teacher creation failed:', error);
    throw error;
  }
};

/**
 * Update teacher
 */
export const updateTeacher = async (id, instituteId, updateData, options = {}) => {
  const { transaction } = options;

  const user = await User.findOne({
    where: { id, school_id: instituteId, user_type: 'TEACHER' },
    include: [{ model: Role, as: 'Role' }],
    transaction
  });
  if (!user) throw new Error('Teacher not found');

  // Update basic user fields
  const basicFields = ['first_name', 'last_name', 'email', 'phone', 'is_active'];
  for (const field of basicFields) {
    if (updateData[field] !== undefined && updateData[field] !== 'undefined') {
      user[field] = updateData[field];
    }
  }

  // Update role if needed
  if (updateData.role_id && updateData.role_id !== user.role_id) {
    const newRole = await Role.findOne({
      where: {
        id: updateData.role_id,
        [Op.or]: [{ school_id: instituteId }, { school_id: null, is_template: true }]
      },
      transaction
    });
    if (newRole) {
      user.role_id = newRole.id;
      user.permissions = newRole.permissions?.teacher === 'ALL' 
        ? ['ALL'] 
        : (Array.isArray(newRole.permissions?.teacher) ? newRole.permissions.teacher : []);
    }
  }

  // Get existing teacher details
  const existingDetails = user.details?.teacherDetails || {};
  
  // Delete old avatar if new one uploaded
  if (updateData.photo_public_id && existingDetails.avatar_public_id) {
    await deleteFromCloudinary(existingDetails.avatar_public_id).catch(console.warn);
  }

  // Create updated details by merging (existing + provided)
  const updatedDetails = { ...existingDetails };

  // Fields that can be updated
  const detailFields = [
    'employee_id', 'qualification', 'specialization', 'experience_years',
    'subjects', 'salary', 'designation', 'department', 'employment_type',
    'joining_date', 'contract_start_date', 'contract_end_date',
    'bank_name', 'bank_account_no', 'bank_branch',
    'emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone',
    'present_address', 'permanent_address', 'city', 'date_of_birth',
    'gender', 'blood_group', 'religion', 'nationality', 'cnic', 'status',
    'avatar_url', 'avatar_public_id'
  ];

  for (const field of detailFields) {
    // Determine source value
    let value = updateData[field];
    if (field === 'avatar_url') {
      if (updateData.photo_url !== undefined) value = updateData.photo_url;
      if (value !== undefined && value !== 'undefined') user.avatar_url = value === '' ? null : value; // Update base table
    } else if (field === 'avatar_public_id') {
      if (updateData.photo_public_id !== undefined) value = updateData.photo_public_id;
      if (value !== undefined && value !== 'undefined') user.avatar_public_id = value === '' ? null : value; // Update base table
    } else if (field === 'date_of_birth' && updateData.dob !== undefined) {
      value = updateData.dob;
    }

    // If field is present in updateData (including null or empty string), update it
    if (value !== undefined && value !== 'undefined') {
      // Convert empty string to null for optional fields
      if (value === '') value = null;
      updatedDetails[field] = value;
    }
    // If field not present, keep existing value (do nothing)
  }

  // Save updated details
  user.details = {
    ...user.details,
    teacherDetails: updatedDetails
  };

  // Update documents if provided
  if (updateData.documents !== undefined) {
    const docs = Array.isArray(updateData.documents) ? updateData.documents : [];
    user.documents = docs.map(doc => ({
      id: doc.id || uuidv4(),
      type: doc.type,
      title: doc.title,
      file_name: doc.file_name,
      file_url: doc.file_url,
      uploaded_at: doc.uploaded_at || new Date(),
      verified: doc.verified || false
    }));
  }

  user.changed('details', true);
  user.changed('documents', true);
  await user.save({ transaction });

  // Reload
  return User.findByPk(user.id, {
    include: [{ model: Role, as: 'Role' }],
    transaction
  });
};

/**
 * Get all teachers
 */
export const getAllTeachers = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;
  
  const where = { 
    school_id: filters.institute_id,
    user_type: 'TEACHER'
  };

  if (filters.branch_id) {
    where.branch_id = filters.branch_id;
  }
  
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
  
  if (filters.role_id) where.role_id = filters.role_id;
  
  const { count, rows } = await User.findAndCountAll({
    where,
    include: [
      {
        model: Role,
        as: 'Role',
        attributes: ['id', 'name', 'code', 'permissions']
      }
    ],
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

/**
 * Get teacher by ID with role
 */
export const getTeacherById = async (id, instituteId) => {
  const teacher = await User.findOne({
    where: { id, school_id: instituteId, user_type: 'TEACHER' },
    include: [
      {
        model: Role,
        as: 'Role',
        attributes: ['id', 'name', 'code', 'permissions']
      },
      {
        model: StaffAttendance,
        as: 'staffAttendances',
        attributes: ['id', 'date', 'status', 'check_in', 'check_out', 'remarks']
      },
      {
        model: Payslip,
        as: 'payslips',
        attributes: ['id', 'month', 'year', 'basic_salary', 'total_allowances', 'total_deductions', 'net_salary', 'status', 'paid_on']
      },
      {
        model: LeaveRequest,
        as: 'leaveRequests',
        attributes: ['id', 'from_date', 'to_date', 'status', 'reason', 'leave_type_id']
      }
    ],
    order: [
      [{ model: StaffAttendance, as: 'staffAttendances' }, 'date', 'DESC'],
      [{ model: Payslip, as: 'payslips' }, 'year', 'DESC'],
      [{ model: Payslip, as: 'payslips' }, 'month', 'DESC']
    ]
  });

  if (!teacher) return null;

  // Fetch all active timetables for this institute
  const timetables = await Timetable.findAll({
    where: {
      school_id: instituteId,
      is_active: true
    },
    attributes: ['id', 'name', 'slots', 'period_config']
  });

  // Extract relevant slots for this teacher manually to avoid complex JSONB query issues
  const teacherSlots = [];
  timetables.forEach(tt => {
    if (tt.slots && Array.isArray(tt.slots)) {
      const periodMap = {};
      if (tt.period_config?.periods) {
        tt.period_config.periods.forEach(p => {
          periodMap[p.period] = p;
        });
      }

      tt.slots.forEach(slot => {
        if (slot.teacher_id === id) {
          // Fallback to period config timings if slot timings are missing
          const periodInfo = periodMap[slot.period] || {};
          teacherSlots.push({
            ...slot,
            start_time: slot.start_time || periodInfo.start_time,
            end_time: slot.end_time || periodInfo.end_time,
            timetable_name: tt.name,
            timetable_id: tt.id
          });
        }
      });
    }
  });

  const teacherJson = teacher.toJSON();
  teacherJson.timetableSlots = teacherSlots;

  return teacherJson;
};

/**
 * Regenerate QR code - DELETE OLD, UPLOAD NEW
 */
export const regenerateQRCode = async (id, instituteId) => {
  const transaction = await sequelize.transaction();
  
  try {
    const user = await User.findOne({
      where: { id, school_id: instituteId, user_type: 'TEACHER' }
    });
    
    if (!user) {
      throw new Error('Teacher not found');
    }
    
    // 1. Store old public_id before generating new
    const oldPublicId = user.qr_code_public_id;
    
    // 2. Generate and upload new QR code (old will be deleted inside function)
    const qrCodeResult = await generateAndUploadQRCode(
      user, 
      instituteId,
      oldPublicId // Pass old public_id for deletion
    );
    
    // 3. Update user with new QR code info
    user.qr_code_url = qrCodeResult.url;
    user.qr_code_public_id = qrCodeResult.public_id;
    
    await user.save({ transaction });
    await transaction.commit();
    
    return qrCodeResult.url;
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ QR code regeneration failed:', error);
    throw error;
  }
};

/**
 * Search teachers with space-insensitive logic
 */
export const searchTeachers = async (instituteId, query = {}) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, parseInt(query.limit) || 20);
  const offset = (page - 1) * limit;
  const searchTerm = (query.search || '').trim().replace(/\s+/g, ' '); // Normalize spaces
  const searchTermNoSpaces = searchTerm.replace(/\s+/g, ''); // Remove all spaces

  const where = {
    school_id: instituteId,
    user_type: 'TEACHER'
  };

  if (searchTerm) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${searchTerm}%` } },
      { last_name: { [Op.iLike]: `%${searchTerm}%` } },
      { email: { [Op.iLike]: `%${searchTerm}%` } },
      { registration_no: { [Op.iLike]: `%${searchTerm}%` } },
      // Concatenated name search (space-insensitive)
      sequelize.where(
        sequelize.fn('replace', 
          sequelize.fn('concat', sequelize.col('first_name'), sequelize.col('last_name')), 
          ' ', ''
        ),
        { [Op.iLike]: `%${searchTermNoSpaces}%` }
      )
    ];
  }

  if (query.is_active !== undefined && query.is_active !== '') {
    where.is_active = query.is_active === 'true' || query.is_active === true;
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: { exclude: ['password_hash', 'password_reset_token', 'password_reset_expires'] },
    include: [{
      model: Role,
      as: 'Role',
      attributes: ['id', 'name', 'code']
    }],
    order: [['first_name', 'ASC']],
    limit,
    offset
  });

  return {
    rows,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit)
  };
};

export default {
  createTeacher,
  updateTeacher,
  getAllTeachers,
  getTeacherById,
  getTeacherRoles,
  regenerateQRCode,
  searchTeachers
};