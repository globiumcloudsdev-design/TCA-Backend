/**
 * The Clouds Academy — Master Admin User Seeder
 *
 * Creates the platform super admin user using credentials from environment variables.
 * Linked to the MASTER_ADMIN template role.
 * Safe to re-run — skips creation if email already exists.
 */

import bcrypt from 'bcryptjs';
import config from '../config/index.js';

export const seedMasterAdmin = async (models) => {
  const { User, Role } = models;

  const email    = config.superAdmin.email;
  const password = config.superAdmin.password;
  const saltRounds = config.bcrypt.saltRounds;

  // Resolve MASTER_ADMIN template role
  const masterRole = await Role.findOne({ where: { code: 'MASTER_ADMIN', school_id: null }, paranoid: false });
  if (!masterRole) {
    throw new Error('MASTER_ADMIN role not found — ensure roles seeder ran first (01.roles.seed.js)');
  }

  const password_hash = await bcrypt.hash(password, saltRounds);

  let user = await User.scope('withPassword').findOne({
    where: { email },
    paranoid: false,
  });

  if (user) {
    if (user.deleted_at) {
      await user.restore();
    }
    await user.update({
      password_hash,
      role_id: masterRole.id,
      user_type: 'MASTER_ADMIN',
      email_verified: true,
      is_active: true,
    });
    console.log(`ℹ️  Master Admin already exists / updated: ${email}`);
  } else {
    await User.create({
      first_name:     'Master',
      last_name:      'Admin',
      email,
      password_hash,
      user_type:      'MASTER_ADMIN',
      role_id:        masterRole.id,
      school_id:      null,
      email_verified: true,
      is_active:      true,
      details:        {},
    });
    console.log(`✅ Master Admin created: ${email}`);
    console.log('─'.repeat(55));
    console.log('  🔐  MASTER ADMIN LOGIN CREDENTIALS');
    console.log(`  Email    : ${email}`);
    console.log(`  Password : ${password}`);
    console.log('─'.repeat(55));
  }
};
