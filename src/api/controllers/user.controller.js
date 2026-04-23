import { AppError } from '../../utils/lib/AppError.js';
import { sendSuccess } from '../../utils/helpers/response.helper.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';
import { unlink } from 'fs/promises';
import User from '../../models/postgres/User.model.js';

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