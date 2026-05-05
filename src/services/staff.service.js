//backend/src/services/staff.service.js
/**
 * The Clouds Academy — Staff Service
 * 
 * Staff are users with user_type = 'STAFF'
 * Permissions come from institute's assigned role (staff section)
 * Admin can override permissions when creating/updating staff
 */

import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import sequelize from '../config/database.js';
import models from '../models/postgres/index.js';
import { AppError } from '../utils/lib/AppError.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { generateAndUploadQRCode } from '../utils/qrCodeGenerator.js';
import { sendWelcomeEmailWithCredentials } from './email.service.js';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { generateRandomPassword, generateNumericPassword } from '../utils/passwordGenerator.js';

const { User, Role, Institute, StaffAttendance, Payslip, LeaveRequest } = models;

// Staff Types (from User model enum)
export const STAFF_TYPES = ['Accountant', 'Clerk', 'Librarian', 'Peon', 'Other', 'GateKeeper'];

// ─── Get available roles for staff (from institute's assigned role) ───────────
export const getAvailableRoles = async (instituteId) => {
  // First get the institute to find its assigned role
  const institute = await Institute.findByPk(instituteId, {
    include: [{
      model: Role,
      as: 'assignedRole',
      attributes: ['id', 'name', 'code', 'permissions']
    }]
  });

  if (!institute) {
    throw new AppError('Institute not found', 404);
  }

  // Get the institute's assigned role
  const instituteRole = institute.assignedRole;

  if (!instituteRole) {
    throw new AppError('Institute has no assigned role', 404);
  }

  // Extract staff permissions from the role's JSONB
  const staffPermissions = instituteRole.permissions?.staff || [];

  // Create role objects for each staff type
  const availableRoles = STAFF_TYPES.map(type => ({
    id: `staff-${type.toLowerCase()}`,
    name: type,
    code: `STAFF_${type.toUpperCase()}`,
    type: type,
    permissions: staffPermissions,
    is_virtual: true,
    description: `${type} staff member with institute-defined permissions`
  }));

  // Also include any custom staff roles if they exist in the database
  const customStaffRoles = await Role.findAll({
    where: {
      school_id: instituteId,
      code: { [Op.iLike]: 'STAFF_%' }
    }
  });

  // Merge virtual and custom roles
  const allRoles = [...availableRoles];

  customStaffRoles.forEach(customRole => {
    const existingIndex = allRoles.findIndex(r => r.code === customRole.code);
    if (existingIndex >= 0) {
      allRoles[existingIndex] = {
        ...customRole.toJSON(),
        is_virtual: false
      };
    } else {
      allRoles.push({
        ...customRole.toJSON(),
        is_virtual: false
      });
    }
  });

  return allRoles;
};

// ─── List all staff members for an institute ─────────────────────────────────
export const getAllStaff = async (instituteId, query = {}) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, parseInt(query.limit) || 20);
  const offset = (page - 1) * limit;

  const where = {
    school_id: instituteId,
    user_type: 'STAFF'
  };

  // Apply filters
  if (query.staff_type) {
    where.staff_type = query.staff_type;
  }

  if (query.is_active !== undefined && query.is_active !== '') {
    where.is_active = query.is_active === 'true' || query.is_active === true;
  }

  if (query.search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${query.search}%` } },
      { last_name: { [Op.iLike]: `%${query.search}%` } },
      { email: { [Op.iLike]: `%${query.search}%` } },
      { phone: { [Op.iLike]: `%${query.search}%` } },
      sequelize.where(
        sequelize.fn('concat', sequelize.col('first_name'), ' ', sequelize.col('last_name')),
        { [Op.iLike]: `%${query.search}%` }
      )
    ];
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: { exclude: ['password_hash', 'password_reset_token', 'password_reset_expires'] },
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return {
    rows,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
};

// ─── Get single staff member by ID ───────────────────────────────────────────
export const getStaffById = async (id, instituteId) => {
  const staff = await User.findOne({
    where: {
      id,
      school_id: instituteId,
      user_type: 'STAFF'
    },
    attributes: { exclude: ['password_hash', 'password_reset_token', 'password_reset_expires'] },
    include: [
      {
        model: Role,
        as: 'Role',
        attributes: ['id', 'name', 'code', 'permissions']
      },
      {
        model: StaffAttendance,
        as: 'staffAttendances',
        attributes: ['id', 'date', 'status', 'check_in', 'check_out', 'remarks'],
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

  if (!staff) {
    throw new AppError('Staff member not found', 404);
  }

  return staff;
};

// ─── Upload documents to Cloudinary ─────────────────────────────────────────
const uploadDocuments = async (files, instituteId, staffId) => {
  const uploadedDocs = [];

  if (!files?.length) return uploadedDocs;

  for (const file of files) {
    try {
      // ✅ Institute-specific folder: the-clouds-academy/{instituteId}/staff/{staffId}/documents
      const folder = `the-clouds-academy/${instituteId}/staff/${staffId}/documents`;

      const result = await uploadToCloudinary(file.path, folder, {
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true,
        transformation: [{ quality: 'auto' }]
      });

      uploadedDocs.push({
        id: uuidv4(),
        type: 'document',
        title: file.originalname,
        file_name: file.originalname,
        file_url: result.url,
        file_size: file.size,
        mime_type: file.mimetype,
        public_id: result.public_id,
        uploaded_at: new Date()
      });

      console.log(`✅ Document uploaded: ${result.url}`);

    } catch (error) {
      console.error('❌ Document upload failed:', error);
    } finally {
      // Clean up temp file
      try {
        if (fs.existsSync(file.path)) {
          await fs.promises.unlink(file.path);
        }
      } catch { /* ignore */ }
    }
  }

  return uploadedDocs;
};

// ─── Create new staff member ─────────────────────────────────────────────────
export const createStaff = async (instituteId, data, createdBy, file = null, documentFiles = []) => {
  let avatarUrl = null;
  let avatarPublicId = null;
  let qrCodeUrl = null;
  let qrCodePublicId = null;

  // Upload avatar if provided
  if (file) {
    try {
      const folder = `the-clouds-academy/${instituteId}/staff/avatars`;
      const result = await uploadToCloudinary(file.path, folder, {
        transformation: [{ width: 300, height: 300, crop: 'thumb' }, { quality: 'auto' }],
      });
      avatarUrl = result.url;
      avatarPublicId = result.public_id;
    } finally {
      try {
        if (fs.existsSync(file.path)) {
          await fs.promises.unlink(file.path);
        }
      } catch { }
    }
  }

  const t = await sequelize.transaction();

  try {
    // Check if email already exists (if provided)
    if (data.email) {
      // const existingEmail = await User.findOne({
      //   where: { email: data.email.toLowerCase() },
      //   transaction: t
      // });
      // if (existingEmail) {
      //   throw new AppError('Email already exists', 409);
      // }
      // Only check within STAFF type, not across all users
      const existingStaff = await User.findOne({
        where: {
          email: data.email.toLowerCase(),
          user_type: 'STAFF',
          school_id: instituteId
        },
        transaction: t
      });
      if (existingStaff) {
        throw new AppError('A staff member with this email already exists in this institute', 409);
      }
    }

    // Check if registration_no already exists (if provided)
    if (data.registration_no) {
      const existingRegNo = await User.findOne({
        where: {
          registration_no: data.registration_no,
          school_id: instituteId
        },
        transaction: t
      });
      if (existingRegNo) {
        throw new AppError('Registration number already exists', 409);
      }
    }

    // ✅ Generate 6-digit numeric password
    const password = data.password || generateNumericPassword(6);
    const passwordHash = await bcrypt.hash(password, 12);

    // Parse staff details if it's a string
    let staffDetails = {};
    if (data.staff_details) {
      try {
        staffDetails = typeof data.staff_details === 'string'
          ? JSON.parse(data.staff_details)
          : data.staff_details;
      } catch (e) {
        staffDetails = {};
      }
    }

    // Parse permissions if it's a string
    let permissions = [];
    if (data.permissions) {
      try {
        permissions = typeof data.permissions === 'string'
          ? JSON.parse(data.permissions)
          : data.permissions;
      } catch (e) {
        permissions = [];
      }
    }

    // Parse documents if it's a string
    let documents = [];
    if (data.documents) {
      try {
        documents = typeof data.documents === 'string'
          ? JSON.parse(data.documents)
          : data.documents;
      } catch (e) {
        documents = [];
      }
    }

    // Upload documents if any
    if (documentFiles?.length) {
      console.log(`📎 Uploading ${documentFiles.length} documents for staff`);
      let newDocsMeta = [];
      try {
        if (data.new_documents_meta) {
          newDocsMeta = typeof data.new_documents_meta === 'string'
            ? JSON.parse(data.new_documents_meta)
            : data.new_documents_meta;
        }
      } catch { newDocsMeta = []; }
      const uploadedDocs = await uploadDocuments(documentFiles, instituteId, 'temp');
      const enhancedDocs = uploadedDocs.map((uploaded, idx) => {
        const meta = newDocsMeta[idx] || {};
        return {
          ...uploaded,
          type: meta.type || uploaded.type,
          title: meta.title || uploaded.title,
          verified: meta.verified || false,
        };
      });
      documents = [...documents, ...enhancedDocs];
    }

    // Prepare staff details object
    const finalStaffDetails = {
      employee_id: data.employee_id || staffDetails.employee_id,
      cnic: data.cnic || staffDetails.cnic,
      dob: data.dob || staffDetails.dob,
      gender: data.gender || staffDetails.gender,
      blood_group: data.blood_group || staffDetails.blood_group,
      religion: data.religion || staffDetails.religion,
      nationality: data.nationality || staffDetails.nationality || 'Pakistani',
      present_address: data.present_address || staffDetails.present_address,
      permanent_address: data.permanent_address || staffDetails.permanent_address,
      city: data.city || staffDetails.city,
      alternate_phone: data.alternate_phone || staffDetails.alternate_phone,
      qualification: data.qualification || staffDetails.qualification,
      specialization: data.specialization || staffDetails.specialization,
      experience_years: data.experience_years || staffDetails.experience_years,
      previous_institution: data.previous_institution || staffDetails.previous_institution,
      designation: data.designation || staffDetails.designation,
      department: data.department || staffDetails.department,
      employment_type: data.employment_type || staffDetails.employment_type,
      joining_date: data.joining_date || staffDetails.joining_date,
      contract_start_date: data.contract_start_date || staffDetails.contract_start_date,
      contract_end_date: data.contract_end_date || staffDetails.contract_end_date,
      salary: data.salary ? Number(data.salary) : (staffDetails.salary ? Number(staffDetails.salary) : null),
      bank_name: data.bank_name || staffDetails.bank_name,
      bank_account_no: data.bank_account_no || staffDetails.bank_account_no,
      bank_branch: data.bank_branch || staffDetails.bank_branch,
      emergency_contact_name: data.emergency_contact_name || staffDetails.emergency_contact_name,
      emergency_contact_relation: data.emergency_contact_relation || staffDetails.emergency_contact_relation,
      emergency_contact_phone: data.emergency_contact_phone || staffDetails.emergency_contact_phone,
    };

    // Create staff user
    const staff = await User.create({
      school_id: instituteId,
      user_type: 'STAFF',
      staff_type: data.staff_type,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email?.toLowerCase(),
      registration_no: data.registration_no || finalStaffDetails.employee_id,
      phone: data.phone,
      password_hash: passwordHash,

      // Permissions from request or from institute role
      permissions: permissions,

      details: finalStaffDetails,
      documents: documents,
      avatar_url: avatarUrl,
      avatar_public_id: avatarPublicId,
      is_active: data.is_active !== false,
      created_by: createdBy,
    }, { transaction: t });

    // If no permissions provided, get from institute's role
    if (!permissions || permissions.length === 0) {
      const institute = await Institute.findByPk(instituteId, {
        include: [{ model: Role, as: 'assignedRole' }],
        transaction: t
      });

      if (institute?.assignedRole?.permissions?.staff) {
        staff.permissions = institute.assignedRole.permissions.staff;
        await staff.save({ transaction: t });
      }
    }

    // ✅ Generate QR Code
    try {
      const qrCodeResult = await generateAndUploadQRCode(staff, instituteId);

      staff.qr_code_url = qrCodeResult.url;
      staff.qr_code_public_id = qrCodeResult.public_id;
      await staff.save({ transaction: t });

      qrCodeUrl = qrCodeResult.url;
      qrCodePublicId = qrCodeResult.public_id;

      console.log(`✅ QR Code generated for staff ${staff.id}`);
    } catch (qrError) {
      console.error('❌ QR Code generation failed:', qrError);
      // Continue without QR code
    }

    await t.commit();

    // ✅ SEND WELCOME EMAIL - OUTSIDE TRANSACTION
    // Email should be sent after transaction commits
    if (staff.email) {
      try {
        const institute = await Institute.findByPk(instituteId);

        // Use setTimeout to not block response
        setTimeout(async () => {
          try {
            await sendWelcomeEmailWithCredentials(
              staff,
              password,
              institute?.name || 'The Clouds Academy',
              qrCodeUrl,
              'Staff Member'
            );
            console.log(`📧 Welcome email sent to ${staff.email}`);
          } catch (emailError) {
            console.error('❌ Email sending failed:', emailError);
          }
        }, 100);
      } catch (error) {
        console.error('❌ Failed to prepare email:', error);
      }
    }

    const createdStaff = await getStaffById(staff.id, instituteId);

    return {
      staff: createdStaff,
      password: password,
      qr_code: qrCodeUrl
    };

  } catch (error) {
    await t.rollback();

    // Clean up uploaded files on error
    if (avatarPublicId) {
      await deleteFromCloudinary(avatarPublicId).catch(() => { });
    }
    if (qrCodePublicId) {
      await deleteFromCloudinary(qrCodePublicId).catch(() => { });
    }

    throw error;
  }
};

// ─── Update staff member ─────────────────────────────────────────────────────
export const updateStaff = async (id, instituteId, data, updatedBy, file = null, documentFiles = []) => {
  const staff = await User.findOne({
    where: {
      id,
      school_id: instituteId,
      user_type: 'STAFF'
    }
  });

  if (!staff) {
    throw new AppError('Staff member not found', 404);
  }

  let avatarUrl = staff.avatar_url;
  let avatarPublicId = staff.avatar_public_id;

  // Upload new avatar if provided
  if (file) {
    try {
      const folder = `the-clouds-academy/${instituteId}/staff/avatars`;
      const result = await uploadToCloudinary(file.path, folder, {
        transformation: [{ width: 300, height: 300, crop: 'thumb' }, { quality: 'auto' }],
      });
      avatarUrl = result.url;

      // Delete old avatar
      if (staff.avatar_public_id) {
        await deleteFromCloudinary(staff.avatar_public_id).catch(() => { });
      }
      avatarPublicId = result.public_id;
    } finally {
      try {
        if (fs.existsSync(file.path)) {
          await fs.promises.unlink(file.path);
        }
      } catch { }
    }
  }

  const updates = { ...data };

  // Handle email uniqueness
  if (data.email && data.email.toLowerCase() !== staff.email) {
    // const existing = await User.findOne({ where: { email: data.email.toLowerCase() } });
    // if (existing && existing.id !== staff.id) {
    //   throw new AppError('Email already exists', 409);
    // }
    // Only check within STAFF type, not across all users
    const existingStaff = await User.findOne({
      where: {
        email: data.email.toLowerCase(),
        user_type: 'STAFF',
        school_id: instituteId
      }
    });
    if (existingStaff) {
      throw new AppError('A staff member with this email already exists in this institute', 409);
    }
    updates.email = data.email.toLowerCase();
  }

  // Handle registration_no uniqueness
  if (data.registration_no && data.registration_no !== staff.registration_no) {
    const existing = await User.findOne({
      where: {
        registration_no: data.registration_no,
        school_id: instituteId
      }
    });
    if (existing && existing.id !== staff.id) {
      throw new AppError('Registration number already exists', 409);
    }
    updates.registration_no = data.registration_no;
  }

  // Handle password update
  if (data.password) {
    updates.password_hash = await bcrypt.hash(data.password, 12);
  }

  // Update avatar
  if (avatarUrl) {
    updates.avatar_url = avatarUrl;
    updates.avatar_public_id = avatarPublicId;
  }

  // Update permissions if provided
  if (data.permissions) {
    try {
      updates.permissions = typeof data.permissions === 'string'
        ? JSON.parse(data.permissions)
        : data.permissions;
    } catch (e) {
      updates.permissions = data.permissions;
    }
  }

  // Handle documents - REPLACE with the incoming list (not merge, to avoid duplicates on edit)
  if (data.documents !== undefined) {
    try {
      updates.documents = typeof data.documents === 'string'
        ? JSON.parse(data.documents)
        : data.documents;
    } catch (e) {
      updates.documents = staff.documents || [];
    }
  }

  // Upload new document files
  if (documentFiles?.length) {
    console.log(`📎 Uploading ${documentFiles.length} new documents for staff ${id}`);
    let newDocsMeta = [];
    try {
      if (data.new_documents_meta) {
        newDocsMeta = typeof data.new_documents_meta === 'string'
          ? JSON.parse(data.new_documents_meta)
          : data.new_documents_meta;
      }
    } catch { newDocsMeta = []; }
    const uploadedDocs = await uploadDocuments(documentFiles, instituteId, id);
    const enhancedDocs = uploadedDocs.map((uploaded, idx) => {
      const meta = newDocsMeta[idx] || {};
      return {
        ...uploaded,
        type: meta.type || uploaded.type,
        title: meta.title || uploaded.title,
        verified: meta.verified || false,
      };
    });
    const baseDocs = updates.documents ?? staff.documents ?? [];
    updates.documents = [...baseDocs, ...enhancedDocs];
  }

  // Update staff details
  if (data.staff_details) {
    try {
      const newDetails = typeof data.staff_details === 'string'
        ? JSON.parse(data.staff_details)
        : data.staff_details;

      updates.details = {
        ...staff.details,
        ...newDetails
      };
    } catch (e) {
      // Keep existing
    }
  }

  updates.updated_by = updatedBy;

  await staff.update(updates);
  return await getStaffById(staff.id, instituteId);
};

// ─── Delete staff member ─────────────────────────────────────────────────────
export const deleteStaff = async (id, instituteId) => {
  const staff = await User.findOne({
    where: {
      id,
      school_id: instituteId,
      user_type: 'STAFF'
    }
  });

  if (!staff) {
    throw new AppError('Staff member not found', 404);
  }

  // Delete avatar from Cloudinary if exists
  if (staff.avatar_public_id) {
    await deleteFromCloudinary(staff.avatar_public_id).catch(() => { });
  }

  // Delete QR code from Cloudinary if exists
  if (staff.qr_code_public_id) {
    await deleteFromCloudinary(staff.qr_code_public_id).catch(() => { });
  }

  // Delete all document files from Cloudinary
  if (staff.documents && Array.isArray(staff.documents)) {
    for (const doc of staff.documents) {
      if (doc.public_id) {
        await deleteFromCloudinary(doc.public_id).catch(() => { });
      }
    }
  }

  await staff.destroy();
  return { message: 'Staff member deleted successfully' };
};

// ─── Toggle staff active status ──────────────────────────────────────────────
export const toggleStaffStatus = async (id, instituteId, is_active) => {
  const staff = await User.findOne({
    where: {
      id,
      school_id: instituteId,
      user_type: 'STAFF'
    }
  });

  if (!staff) {
    throw new AppError('Staff member not found', 404);
  }

  await staff.update({ is_active: !!is_active });
  return await getStaffById(staff.id, instituteId);
};

// ─── Update staff permissions ─────────────────────────────────────────────────
export const updateStaffPermissions = async (id, instituteId, permissions) => {
  const staff = await User.findOne({
    where: {
      id,
      school_id: instituteId,
      user_type: 'STAFF'
    }
  });

  if (!staff) {
    throw new AppError('Staff member not found', 404);
  }

  await staff.update({ permissions });
  return await getStaffById(staff.id, instituteId);
};

// ─── Regenerate QR code ─────────────────────────────────────────────────────
export const regenerateQRCode = async (id, instituteId) => {
  const staff = await User.findOne({
    where: {
      id,
      school_id: instituteId,
      user_type: 'STAFF'
    }
  });

  if (!staff) {
    throw new AppError('Staff member not found', 404);
  }

  // Generate new QR code with old public_id for deletion
  const oldPublicId = staff.qr_code_public_id;

  const qrCodeResult = await generateAndUploadQRCode(staff, instituteId, oldPublicId);

  staff.qr_code_url = qrCodeResult.url;
  staff.qr_code_public_id = qrCodeResult.public_id;

  await staff.save();

  return qrCodeResult.url;
};

/**
 * Search staff with space-insensitive logic
 */
export const searchStaff = async (instituteId, query = {}) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, parseInt(query.limit) || 20);
  const offset = (page - 1) * limit;
  const searchTerm = (query.search || '').trim().replace(/\s+/g, ' '); // Normalize spaces
  const searchTermNoSpaces = searchTerm.replace(/\s+/g, ''); // Remove all spaces

  const where = {
    school_id: instituteId,
    user_type: 'STAFF'
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

  if (query.staff_type) {
    where.staff_type = query.staff_type;
  }

  if (query.is_active !== undefined && query.is_active !== '') {
    where.is_active = query.is_active === 'true' || query.is_active === true;
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: { exclude: ['password_hash', 'password_reset_token', 'password_reset_expires'] },
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
