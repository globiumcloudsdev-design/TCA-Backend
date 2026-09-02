// backend/src/api/services/branch.service.js

import { Op } from 'sequelize';
import models from '../models/postgres/index.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const { Branch, User, Class, FeeTemplate } = models;

/**
 * Get all branches with filters
 */
export const getAllBranches = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const where = { institute_id: filters.institute_id };

  // Search filter
  if (filters.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${filters.search}%` } },
      { code: { [Op.iLike]: `%${filters.search}%` } },
      { address: { [Op.iLike]: `%${filters.search}%` } },
      { city: { [Op.iLike]: `%${filters.search}%` } }
    ];
  }

  // Status filter
  if (filters.status === 'active') {
    where.is_active = true;
  } else if (filters.status === 'inactive') {
    where.is_active = false;
  }

  // City filter
  if (filters.city) {
    where.city = filters.city;
  }

  // Main branch filter
  if (filters.is_main !== undefined) {
    where.is_main = filters.is_main;
  }

  const { count, rows } = await Branch.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'users',
        where: {
          user_type: 'BRANCH_ADMIN',
          staff_type: 'Branch Head'
        },
        required: false,
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'permissions']
      }
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset
  });

  // Format response to include head from users array
  const formattedRows = rows.map(branch => {
    const branchData = branch.toJSON();
    const head = branchData.users?.[0] || null;

    return {
      ...branchData,
      head: head ? {
        id: head.id,
        first_name: head.first_name,
        last_name: head.last_name,
        email: head.email,
        phone: head.phone,
        permissions: head.permissions || []
      } : null,
      users: undefined // Remove users array from response
    };
  });

  return {
    data: formattedRows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    }
  };
};

/**
 * Get branch options for dropdown
 */
export const getBranchOptions = async (institute_id) => {
  const branches = await Branch.findAll({
    where: {
      institute_id,
      is_active: true
    },
    attributes: ['id', 'name', 'code', 'city'],
    order: [['name', 'ASC']]
  });

  return branches.map(b => ({
    value: b.id,
    label: b.name,
    code: b.code,
    city: b.city
  }));
};

/**
 * Get branch by ID
 */
export const getBranchById = async (id, institute_id) => {
  const branch = await Branch.findOne({
    where: {
      id,
      institute_id
    },
    include: [
      {
        model: User,
        as: 'users',
        where: {
          user_type: 'BRANCH_ADMIN',
          staff_type: 'Branch Head'
        },
        required: false,
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'permissions']
      },
      {
        model: Class,
        as: 'classes',
        attributes: ['id', 'name'],
        limit: 10
      }
    ]
  });

  if (!branch) return null;

  const branchData = branch.toJSON();
  const head = branchData.users?.[0] || null;

  return {
    ...branchData,
    head: head ? {
      id: head.id,
      first_name: head.first_name,
      last_name: head.last_name,
      email: head.email,
      phone: head.phone,
      permissions: head.permissions || []
    } : null,
    users: undefined
  };
};

/**
 * Create new branch with head user
 */
export const createBranch = async (data) => {
  const transaction = await models.sequelize.transaction();

  try {
    // Check if branch with same code exists
    if (data.code) {
      const existing = await Branch.findOne({
        where: {
          institute_id: data.institute_id,
          code: data.code
        },
        transaction
      });

      if (existing) {
        throw new Error('Branch with this code already exists');
      }
    }

    // If this is main branch, unset any existing main branch
    if (data.is_main) {
      await Branch.update(
        { is_main: false },
        {
          where: {
            institute_id: data.institute_id,
            is_main: true
          },
          transaction
        }
      );
    }

    // 1. CREATE BRANCH
    const branchData = {
      id: uuidv4(),
      institute_id: data.institute_id,
      name: data.name,
      code: data.code || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,

      // Location with lat/lng
      location: data.location || {
        latitude: null,
        longitude: null,
        place_id: null,
        formatted_address: data.address || null
      },

      // Statistics (initially 0)
      student_count: 0,
      teacher_count: 0,
      class_count: 0,

      // Settings
      settings: data.settings || {
        has_hostel: false,
        has_transport: false,
        has_library: true,
        has_lab: true,
        has_playground: false,
        has_cafeteria: false,
        has_mosque: false,
        has_parking: false,
        working_hours: {
          monday: { open: '08:00', close: '16:00' },
          tuesday: { open: '08:00', close: '16:00' },
          wednesday: { open: '08:00', close: '16:00' },
          thursday: { open: '08:00', close: '16:00' },
          friday: { open: '08:00', close: '12:30' },
          saturday: { open: null, close: null },
          sunday: { open: null, close: null }
        }
      },

      is_active: data.is_active !== undefined ? data.is_active : true,
      is_main: data.is_main || false,

      created_by: data.created_by,
      updated_by: data.updated_by,

      created_at: new Date(),
      updated_at: new Date()
    };

    const branch = await Branch.create(branchData, { transaction });

    // 2. CREATE HEAD USER (if provided)
    if (data.head && data.head.first_name && data.head.last_name && data.head.email) {

      // Check if user with this email already exists
      const existingUser = await User.findOne({
        where: { email: data.head.email },
        transaction
      });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Generate password if not provided
      const password = data.head.password || Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(password, 10);

      const userData = {
        id: uuidv4(),
        school_id: data.institute_id,
        branch_id: branch.id, // ✅ Branch ID set here
        role_id: null, // 👈 NULL because we're using custom permissions
        user_type: 'BRANCH_ADMIN',
        staff_type: 'Branch Head',
        first_name: data.head.first_name,
        last_name: data.head.last_name,
        email: data.head.email,
        phone: data.head.phone || null,
        password_hash: hashedPassword,
        permissions: data.head.permissions || [], // 👈 Custom permissions
        is_active: true,
        created_by: data.created_by,
        updated_by: data.updated_by,
        details: {
          designation: 'Branch Head',
          joining_date: new Date().toISOString().split('T')[0]
        }
      };

      await User.create(userData, { transaction });
    }

    await transaction.commit();

    // Return branch with head info
    const result = branch.toJSON();
    if (data.head) {
      result.head = {
        first_name: data.head.first_name,
        last_name: data.head.last_name,
        email: data.head.email,
        phone: data.head.phone
      };
    }

    return result;

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Update branch
 */
export const updateBranch = async (id, institute_id, updateData) => {
  const branch = await Branch.findOne({
    where: { id, institute_id }
  });

  if (!branch) {
    return null;
  }

  // Check code uniqueness if changing
  if (updateData.code && updateData.code !== branch.code) {
    const existing = await Branch.findOne({
      where: {
        institute_id,
        code: updateData.code,
        id: { [Op.ne]: id }
      }
    });

    if (existing) {
      throw new Error('Branch with this code already exists');
    }
  }

  // If setting as main, unset other main branches
  if (updateData.is_main && !branch.is_main) {
    await Branch.update(
      { is_main: false },
      {
        where: {
          institute_id,
          is_main: true,
          id: { [Op.ne]: id }
        }
      }
    );
  }

  // Update fields
  const updatableFields = [
    'name', 'code', 'phone', 'email', 'address', 'city',
    'location', 'settings', 'is_active', 'is_main',
    'updated_by', 'updated_at'
  ];

  updatableFields.forEach(field => {
    if (updateData[field] !== undefined) {
      branch[field] = updateData[field];
    }
  });

  await branch.save();

  // Update head user if provided (optional)
  if (updateData.head && updateData.head.email) {
    const [headUser, created] = await User.findOrCreate({
      where: {
        branch_id: id,
        user_type: 'BRANCH_ADMIN',
        staff_type: 'Branch Head'
      },
      defaults: {
        id: uuidv4(),
        school_id: institute_id,
        branch_id: id,
        role_id: null,
        user_type: 'BRANCH_ADMIN',
        staff_type: 'Branch Head',
        first_name: updateData.head.first_name,
        last_name: updateData.head.last_name,
        email: updateData.head.email,
        phone: updateData.head.phone || null,
        password_hash: await bcrypt.hash(updateData.head.password || Math.random().toString(36).slice(-8), 10),
        permissions: updateData.head.permissions || [],
        created_by: updateData.updated_by,
        details: { designation: 'Branch Head' }
      }
    });

    if (!created) {
      // Update existing head
      await headUser.update({
        first_name: updateData.head.first_name,
        last_name: updateData.head.last_name,
        phone: updateData.head.phone,
        permissions: updateData.head.permissions || []
      });
    }
  }

  return branch;
};

/**
 * Delete branch (soft delete)
 */
export const deleteBranch = async (id, institute_id, deleted_by) => {
  const branch = await Branch.findOne({
    where: { id, institute_id }
  });

  if (!branch) {
    return null;
  }

  // Check if branch has any active classes/students
  if (branch.class_count > 0 || branch.student_count > 0) {
    throw new Error('Cannot delete branch with active classes or students');
  }

  // Soft delete
  await branch.destroy();
  return true;
};

/**
 * Toggle branch status
 */
export const toggleBranchStatus = async (id, institute_id, is_active) => {
  const branch = await Branch.findOne({
    where: { id, institute_id }
  });

  if (!branch) {
    return null;
  }

  branch.is_active = is_active;
  branch.updated_at = new Date();
  await branch.save();

  return branch;
};

/**
 * Update branch settings only
 */
export const updateBranchSettings = async (id, institute_id, settings) => {
  const branch = await Branch.findOne({
    where: { id, institute_id }
  });

  if (!branch) {
    return null;
  }

  branch.settings = {
    ...branch.settings,
    ...settings
  };
  branch.updated_at = new Date();
  await branch.save();

  return branch;
};

/**
 * Get branch statistics
 */
export const getBranchStats = async (institute_id) => {
  const total = await Branch.count({ where: { institute_id } });
  const active = await Branch.count({ where: { institute_id, is_active: true } });
  const mainBranch = await Branch.findOne({
    where: { institute_id, is_main: true }
  });

  const totalStudents = await Branch.sum('student_count', { where: { institute_id } });
  const totalTeachers = await Branch.sum('teacher_count', { where: { institute_id } });
  const totalClasses = await Branch.sum('class_count', { where: { institute_id } });

  // Get city-wise distribution
  const cityStats = await Branch.findAll({
    where: { institute_id },
    attributes: [
      'city',
      [models.sequelize.fn('COUNT', models.sequelize.col('city')), 'count']
    ],
    group: ['city']
  });

  return {
    total,
    active,
    inactive: total - active,
    total_students: totalStudents || 0,
    total_teachers: totalTeachers || 0,
    total_classes: totalClasses || 0,
    main_branch: mainBranch ? {
      id: mainBranch.id,
      name: mainBranch.name
    } : null,
    cities: cityStats.map(c => ({
      city: c.city || 'Unknown',
      count: parseInt(c.dataValues.count)
    }))
  };
};