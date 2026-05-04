import models from '../models/postgres/index.js';
import { Op } from 'sequelize';
import bcrypt from 'bcrypt';
import { generateNumericPassword, generateRandomPassword } from '../utils/passwordGenerator.js';
import { generateAndUploadQRCode } from '../utils/qrCodeGenerator.js';
import { sendWelcomeEmailWithCredentials } from './email.service.js';

const { User, Role, Institute } = models;

const normalize = (v) => String(v || '').trim();
const normalizeLower = (v) => normalize(v).toLowerCase();
const digitsOnly = (v) => String(v || '').replace(/\D/g, '');

const tokenizedNameMatch = (candidate, query) => {
  const cand = normalizeLower(candidate);
  const q = normalizeLower(query);
  if (!q) return true;
  if (!cand) return false;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => cand.includes(t));
};

const phoneLikeMatch = (left, right) => {
  const a = digitsOnly(left);
  const b = digitsOnly(right);
  if (!a || !b) return false;
  if (a === b) return true;

  // Handle 03xxxxxxxxx vs 923xxxxxxxxx formatting differences
  const a10 = a.slice(-10);
  const b10 = b.slice(-10);
  return !!a10 && !!b10 && a10 === b10;
};

const getParentRole = async (instituteId) => {
  const instituteRoles = await Role.findAll({
    where: { school_id: instituteId, is_active: true },
    attributes: ['id', 'name', 'permissions']
  });

  const fromInstitute = instituteRoles.find((role) => role.permissions && (Array.isArray(role.permissions.parent) || role.permissions.parent === 'ALL'));
  if (fromInstitute) return fromInstitute;

  const templateRoles = await Role.findAll({
    where: { school_id: null, is_template: true, is_active: true },
    attributes: ['id', 'name', 'permissions']
  });

  const fromTemplate = templateRoles.find((role) => role.permissions && (Array.isArray(role.permissions.parent) || role.permissions.parent === 'ALL'));
  if (fromTemplate) return fromTemplate;

  return {
    id: null,
    permissions: { parent: ['dashboard.view.self', 'attendance.view.self', 'results.view.self'] }
  };
};

const getRolePermissions = (role) => {
  if (!role?.permissions) return [];
  if (role.permissions.parent === 'ALL') return ['ALL'];
  if (Array.isArray(role.permissions.parent)) return role.permissions.parent;
  return [];
};


const mapLinkedStudent = (student) => {
  const sd = student.details?.studentDetails || {};
  return {
    id: student.id,
    name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
    registration_no: student.registration_no || null,
    class_id: sd.class_id || null,
    class_name: sd.class_name || null,
    section_id: sd.section_id || null,
    section_name: sd.section_name || null,
    roll_no: sd.roll_no || sd.roll_number || null
  };
};

const resolveLinkedStudents = async (instituteId, studentIds = []) => {
  if (!Array.isArray(studentIds) || studentIds.length === 0) return [];
  const rows = await User.findAll({
    where: {
      school_id: instituteId,
      user_type: 'STUDENT',
      id: { [Op.in]: studentIds }
    },
    attributes: ['id', 'first_name', 'last_name', 'registration_no', 'details']
  });
  return rows.map(mapLinkedStudent);
};

const parentMatchesStudent = (studentDetails, input) => {
  const guardians = Array.isArray(studentDetails.guardians) ? studentDetails.guardians : [];

  const fullName = normalizeLower(input.full_name);
  const phone = digitsOnly(input.phone);
  const cnic = digitsOnly(input.cnic);
  const email = normalizeLower(input.email);

  const hasAnyQuery = !!(fullName || phone || cnic || email);
  if (!hasAnyQuery) return false;

  const byLegacyFields = {
    name: [studentDetails.father_name, studentDetails.mother_name, studentDetails.guardian_name],
    phone: [studentDetails.father_phone, studentDetails.mother_phone, studentDetails.guardian_phone],
    cnic: [studentDetails.father_cnic, studentDetails.cnic],
    email: [studentDetails.guardian_email]
  };

  const candidateNames = [
    ...guardians.map((g) => g?.name),
    ...byLegacyFields.name,
  ];

  const candidatePhones = [
    ...guardians.map((g) => g?.phone),
    ...byLegacyFields.phone,
  ];

  const candidateCnics = [
    ...guardians.map((g) => g?.cnic),
    ...byLegacyFields.cnic,
  ];

  const candidateEmails = [
    ...guardians.map((g) => g?.email),
    ...byLegacyFields.email,
  ];

  const matchName = !fullName || candidateNames.some((v) => tokenizedNameMatch(v, fullName));
  const matchPhone = !!phone && candidatePhones.some((v) => phoneLikeMatch(v, phone));
  const matchCnic = !!cnic && candidateCnics.some((v) => digitsOnly(v) === cnic);
  const matchEmail = !!email && candidateEmails.some((v) => normalizeLower(v) === email);

  const hasIdentifierQuery = !!(phone || cnic || email);
  const identifierMatched = matchPhone || matchCnic || matchEmail;

  // If identifier(s) provided, trust those primarily (name can vary in spelling/order).
  if (hasIdentifierQuery) return identifierMatched;

  // If only name is provided, use token-based name matching.
  return matchName;
};

export const findStudentsByParentInfo = async (instituteId, info = {}) => {
  const fullName = `${normalize(info.first_name)} ${normalize(info.last_name)}`.trim();

  const rows = await User.findAll({
    where: {
      school_id: instituteId,
      user_type: 'STUDENT',
      is_active: true
    },
    attributes: ['id', 'first_name', 'last_name', 'registration_no', 'details']
  });

  const matched = rows.filter((student) => parentMatchesStudent(student.details?.studentDetails || {}, {
    full_name: fullName,
    phone: info.phone,
    cnic: info.cnic,
    email: info.email
  }));

  return matched.map(mapLinkedStudent);
};

export const createParent = async (instituteId, data, createdBy) => {
  const role = await getParentRole(instituteId);
  const password = data.password || generateNumericPassword(8);
  const password_hash = await bcrypt.hash(password, 10);
  const rolePermissions = getRolePermissions(role);

  const requestedIds = Array.isArray(data.student_ids)
    ? data.student_ids
    : (typeof data.student_ids === 'string' ? JSON.parse(data.student_ids || '[]') : []);

  const linkedStudents = await resolveLinkedStudents(instituteId, requestedIds);

  const parent = await User.create({
    school_id: instituteId,
    role_id: role.id,
    user_type: 'PARENT',
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email || null,
    phone: data.phone || null,
    registration_no: data.registration_no || `PAR-${Date.now().toString().slice(-8)}`,
    password_hash,
    permissions: rolePermissions,
    is_active: String(data.status || 'active') !== 'inactive',
    created_by: createdBy,
    details: {
      parentDetails: {
        relation: data.relation || 'guardian',
        cnic: data.cnic || null,
        occupation: data.occupation || null,
        address: data.address || null,
        status: data.status || 'active',
        student_ids: linkedStudents.map((s) => s.id),
        students: linkedStudents
      }
    }
  });

  const qr = await generateAndUploadQRCode(parent, instituteId);
  parent.qr_code_url = qr.url;
  parent.qr_code_public_id = qr.public_id;
  await parent.save();

  if (parent.email) {
    const institute = await Institute.findByPk(instituteId);
    await sendWelcomeEmailWithCredentials(
      parent,
      password,
      institute?.name || 'The Clouds Academy',
      qr.url,
      'Parent'
    );
  }

  return {
    user: parent,
    temp_password: password,
    linked_students: linkedStudents
  };
};

export const getAllParents = async (instituteId, filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const where = {
    school_id: instituteId,
    user_type: 'PARENT'
  };

  if (filters.search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${filters.search}%` } },
      { last_name: { [Op.iLike]: `%${filters.search}%` } },
      { email: { [Op.iLike]: `%${filters.search}%` } },
      { phone: { [Op.iLike]: `%${filters.search}%` } }
    ];
  }

  if (filters.status === 'active') where.is_active = true;
  if (filters.status === 'inactive') where.is_active = false;

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'registration_no', 'is_active', 'details', 'created_at'],
    order: [['created_at', 'DESC']],
    limit,
    offset
  });

  const data = rows.map((row) => {
    const pd = row.details?.parentDetails || {};
    const studentIds = Array.isArray(pd.student_ids) ? pd.student_ids : [];
    return {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
      relation: pd.relation || 'guardian',
      cnic: pd.cnic || null,
      occupation: pd.occupation || null,
      address: pd.address || null,
      status: row.is_active ? 'active' : 'inactive',
      student_ids: studentIds,
      students: Array.isArray(pd.students) ? pd.students : [],
      children: studentIds.length,
      created_at: row.created_at
    };
  });

  return {
    data,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    }
  };
};

export const getParentById = async (id, instituteId) => {
  const row = await User.findOne({
    where: { id, school_id: instituteId, user_type: 'PARENT' },
    attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'registration_no', 'is_active', 'details', 'qr_code_url', 'qr_code_public_id', 'created_at']
  });
  if (!row) throw new Error('Parent not found');

  const pd = row.details?.parentDetails || {};
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    registration_no: row.registration_no,
    relation: pd.relation || 'guardian',
    cnic: pd.cnic || null,
    occupation: pd.occupation || null,
    address: pd.address || null,
    status: row.is_active ? 'active' : 'inactive',
    student_ids: Array.isArray(pd.student_ids) ? pd.student_ids : [],
    students: Array.isArray(pd.students) ? pd.students : [],
    qr_code_url: row.qr_code_url || null,
    qr_code_public_id: row.qr_code_public_id || null,
    details: row.details,
    created_at: row.created_at
  };
};

export const updateParent = async (id, instituteId, updateData) => {
  const row = await User.findOne({
    where: { id, school_id: instituteId, user_type: 'PARENT' }
  });
  if (!row) throw new Error('Parent not found');

  if (updateData.first_name !== undefined) row.first_name = updateData.first_name;
  if (updateData.last_name !== undefined) row.last_name = updateData.last_name;
  if (updateData.email !== undefined) row.email = updateData.email;
  if (updateData.phone !== undefined) row.phone = updateData.phone;

  const existing = row.details?.parentDetails || {};
  let studentIds = existing.student_ids || [];
  if (updateData.student_ids !== undefined) {
    studentIds = Array.isArray(updateData.student_ids)
      ? updateData.student_ids
      : (typeof updateData.student_ids === 'string' ? JSON.parse(updateData.student_ids || '[]') : []);
  }

  const linkedStudents = await resolveLinkedStudents(instituteId, studentIds);

  row.details = {
    ...row.details,
    parentDetails: {
      ...existing,
      ...(updateData.relation !== undefined && { relation: updateData.relation }),
      ...(updateData.cnic !== undefined && { cnic: updateData.cnic }),
      ...(updateData.occupation !== undefined && { occupation: updateData.occupation }),
      ...(updateData.address !== undefined && { address: updateData.address }),
      ...(updateData.status !== undefined && { status: updateData.status }),
      student_ids: linkedStudents.map((s) => s.id),
      students: linkedStudents
    }
  };

  if (updateData.status !== undefined) {
    row.is_active = String(updateData.status) === 'active';
  }

  if (!row.qr_code_url) {
    const qr = await generateAndUploadQRCode(row, instituteId);
    row.qr_code_url = qr.url;
    row.qr_code_public_id = qr.public_id;
  }

  row.changed('details', true);
  await row.save();

  return getParentById(id, instituteId);
};

export const deleteParent = async (id, instituteId) => {
  const row = await User.findOne({ where: { id, school_id: instituteId, user_type: 'PARENT' } });
  if (!row) throw new Error('Parent not found');
  row.is_active = false;
  await row.save();
  return { success: true };
};

/**
 * Global Search for Parents (Space-insensitive)
 */
export const searchParents = async (instituteId, query = {}) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, parseInt(query.limit) || 20);
  const offset = (page - 1) * limit;
  const searchTerm = (query.search || '').trim();
  const searchTermNoSpaces = searchTerm.replace(/\s+/g, '');

  const where = {
    school_id: instituteId,
    user_type: 'PARENT'
  };

  if (searchTerm) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${searchTerm}%` } },
      { last_name: { [Op.iLike]: `%${searchTerm}%` } },
      { email: { [Op.iLike]: `%${searchTerm}%` } },
      { phone: { [Op.iLike]: `%${searchTerm}%` } },
      { registration_no: { [Op.iLike]: `%${searchTerm}%` } },
      // Concatenated name search
      models.sequelize.where(
        models.sequelize.fn('replace', 
          models.sequelize.fn('concat', models.sequelize.col('first_name'), models.sequelize.col('last_name')), 
          ' ', ''
        ),
        { [Op.iLike]: `%${searchTermNoSpaces}%` }
      )
    ];
  }

  if (query.is_active !== undefined) {
    where.is_active = String(query.is_active) === 'true';
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'registration_no', 'is_active', 'details', 'created_at'],
    order: [['first_name', 'ASC']],
    limit,
    offset
  });

  const data = rows.map((row) => {
    const pd = row.details?.parentDetails || {};
    const studentIds = Array.isArray(pd.student_ids) ? pd.student_ids : [];
    return {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
      relation: pd.relation || 'guardian',
      cnic: pd.cnic || null,
      occupation: pd.occupation || null,
      address: pd.address || null,
      status: row.is_active ? 'active' : 'inactive',
      student_ids: studentIds,
      students: Array.isArray(pd.students) ? pd.students : [],
      children: studentIds.length,
      created_at: row.created_at
    };
  });

  return {
    data,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    }
  };
};

export default {
  findStudentsByParentInfo,
  createParent,
  getAllParents,
  getParentById,
  updateParent,
  deleteParent,
  searchParents
};
