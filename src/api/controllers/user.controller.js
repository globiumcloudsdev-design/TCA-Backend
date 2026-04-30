import { AppError } from '../../utils/lib/AppError.js';
import { sendSuccess } from '../../utils/helpers/response.helper.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';
import { unlink } from 'fs/promises';
import { Op } from 'sequelize';
import User from '../../models/postgres/User.model.js';
import { createPlatformUser } from '../../services/user.service.js';

/**
 * Get current user's profile (same as /auth/me)
 */
export const getMyProfile = async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ['password_hash', 'password_reset_token'] }
  });
  sendSuccess(res, user, 'Profile fetched');
};

/**
 * Update current user's profile
 * Allowed fields: first_name, last_name, email, phone, details (JSONB)
 */
export const updateMyProfile = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) throw new AppError('User not found', 404);

  // Upload new avatar if provided
  let avatarUrl = user.avatar_url;
  let avatarPublicId = user.avatar_public_id;
  if (req.file) {
    try {
      const folder = `the-clouds-academy/${user.school_id}/users/avatars`;
      const result = await uploadToCloudinary(req.file.path, folder, {
        transformation: [{ width: 300, height: 300, crop: 'thumb' }]
      });
      avatarUrl = result.url;
      if (user.avatar_public_id) {
        await deleteFromCloudinary(user.avatar_public_id).catch(() => {});
      }
      avatarPublicId = result.public_id;
    } finally {
      try { await unlink(req.file.path); } catch {}
    }
  }

  // Update basic fields
  const updatable = ['first_name', 'last_name', 'email', 'phone'];
  for (const field of updatable) {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  }

  // Update details JSONB (safe merge)
  if (req.body.details) {
    user.details = { ...user.details, ...req.body.details };
    user.changed('details', true);
  }

  if (avatarUrl) {
    user.avatar_url = avatarUrl;
    user.avatar_public_id = avatarPublicId;
  }

  await user.save();

  // Return updated user
  const updated = await User.findByPk(user.id, {
    attributes: { exclude: ['password_hash', 'password_reset_token'] }
  });
  sendSuccess(res, updated, 'Profile updated');
};

/**
 * Add a new Platform User (Master Admin Level)
 */
export const addPlatformUser = async (req, res) => {
  
  const newUser = await createPlatformUser(req.body, req.user.id);
  
  // Return user without password hash
  const createdUser = await User.findByPk(newUser.id, {
    attributes: { exclude: ['password_hash'] }
  });
  
  sendSuccess(res, createdUser, 'Platform user created successfully');
};

/**
 * Get all users across the platform (Master Admin)
 */
export const getAllUsers = async (req, res) => {
  const { page = 1, limit = 15, search, is_active } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const where = {};
  
  if (search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${search}%` } },
      { last_name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } }
    ];
  }
  
  if (is_active !== undefined) {
    where.is_active = is_active === 'true';
  }

  // ONLY fetch platform users (school_id is null) as requested by user
  where.school_id = null;
  where.user_type = {
    [Op.in]: ['MASTER_ADMIN', 'SUPPORT_STAFF', 'SYSTEM_ADMIN']
  };

  const { count, rows } = await User.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [['created_at', 'DESC']],
    include: [
      { association: 'institute', attributes: ['id', 'institute_name'] },
      { association: 'Role', attributes: ['id', 'name', 'code'] }
    ]
  });

  sendSuccess(res, {
    rows,
    total: count,
    page: parseInt(page),
    totalPages: Math.ceil(count / parseInt(limit))
  }, 'All users fetched');
};

/**
 * Update a Platform User (Master Admin Level)
 */
export const updatePlatformUser = async (req, res) => {
  const { id } = req.params;
  const user = await User.findOne({ where: { id, school_id: null } });
  
  if (!user) throw new AppError('Platform user not found', 404);

  const { first_name, last_name, email, phone, user_type, is_active, permissions } = req.body;
  
  if (first_name) user.first_name = first_name;
  if (last_name) user.last_name = last_name;
  if (email) user.email = email;
  if (phone) user.phone = phone;
  if (user_type) user.user_type = user_type;
  if (is_active !== undefined) user.is_active = is_active;
  if (permissions) user.permissions = permissions;

  // if password provided
  if (req.body.password) {
    const bcrypt = await import('bcryptjs');
    user.password_hash = await bcrypt.default.hash(req.body.password, 12);
  }

  await user.save();
  
  const updatedUser = await User.findByPk(id, {
    attributes: { exclude: ['password_hash'] }
  });
  
  sendSuccess(res, updatedUser, 'Platform user updated successfully');
};

/**
 * Toggle active status of a Platform User
 */
export const togglePlatformUserStatus = async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  
  const user = await User.findOne({ where: { id, school_id: null } });
  if (!user) throw new AppError('Platform user not found', 404);

  user.is_active = is_active;
  await user.save();

  sendSuccess(res, null, `User ${is_active ? 'activated' : 'deactivated'} successfully`);
};
