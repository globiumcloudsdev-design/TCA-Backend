/**
 * The Clouds Academy — Institute Service
 * Complete with auto-branch creation, invoice generation and role-change permission sync
 */

import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import sequelize from '../config/database.js';
import Institute from '../models/postgres/Institute.model.js';
import InstituteType from '../models/postgres/InstituteType.model.js';
import SubscriptionPlan from '../models/postgres/SubscriptionPlan.model.js';
import Role from '../models/postgres/Role.model.js';
import User from '../models/postgres/User.model.js';
import Branch from '../models/postgres/Branch.model.js';
import Invoice from '../models/postgres/Invoice.model.js';
import { AppError } from '../utils/lib/AppError.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import fs from 'fs';
import {
  calculateProratedAmount,
  generateInvoiceNumber,
  calculateDueDate,
  getNextBillingDate,
  needsNewInvoice
} from '../utils/subscriptionUtils.js';
import { startOfMonth, endOfMonth } from 'date-fns';
import { getCloudinaryFolderSize } from '../config/cloudinary.js';
import { sendWelcomeEmailWithCredentials } from '../services/email.service.js';

// ─── Shared include config ────────────────────────────────────────────────────
const BASE_INCLUDE = [
  { model: InstituteType, as: 'type', attributes: ['id', 'name', 'slug', 'icon'] },
  { model: SubscriptionPlan, as: 'plan', attributes: ['id', 'name', 'code', 'price', 'cycle', 'trial_days'] },
  { model: Role, as: 'assignedRole', attributes: ['id', 'name', 'code'] },
  { 
    model: Invoice, 
    as: 'invoices',
    required: false,
    limit: 12,
    order: [['period_start', 'DESC']],
    attributes: ['id', 'invoice_number', 'amount', 'total_amount', 'status', 'due_date', 'period_start', 'period_end']
  }
];

// ─── Helper: Generate random password ─────────────────────────────────────────
const generateRandomPassword = () => {
  const length = 10;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// ─── Helper: Normalize location object (frontend → backend format) ────────────
const normalizeLocation = (location) => {
  if (!location) return {
    latitude: null,
    longitude: null,
    place_id: null,
    formatted_address: null,
    address: null
  };
  
  return {
    address: location.address || location.formatted_address || null,
    formatted_address: location.formatted_address || null,
    latitude: location.latitude || null,
    longitude: location.longitude || null,
    place_id: location.place_id || null,
  };
};

// ─── Helper: Create branch automatically when hasBranches = true ──────────────
const createAutoBranch = async (institute, adminUser, data, createdBy, transaction) => {
  try {
    // Generate branch code from institute code
    const branchCode = `${institute.institute_code}-MAIN`;
    
    // Check if branch already exists
    const existingBranch = await Branch.findOne({
      where: { institute_id: institute.id, is_main: true },
      transaction
    });
    
    if (existingBranch) {
      console.log(`✅ Main branch already exists for institute ${institute.institute_code}`);
      return existingBranch;
    }
    
    // 🔥 FIX: Normalize location data
    const locationData = normalizeLocation(data.location);
    
    // Create the main branch
    const branch = await Branch.create({
      institute_id: institute.id,
      name: `${institute.institute_name} - Main Campus`,
      code: branchCode,
      phone: institute.institute_contact,
      email: institute.institute_email,
      address: data.institute_address || institute.institute_address,
      city: data.institute_city || institute.institute_city,
      is_active: true,
      is_main: true,
      location: locationData, // ✅ Fixed location format
      settings: {
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
      created_by: createdBy,
      updated_by: createdBy
    }, { transaction });
    
    // ✅ Update branch head info in branch settings
    const branchSettings = branch.settings || {};
    branchSettings.head_user_id = adminUser.id;
    branchSettings.head_name = `${adminUser.first_name} ${adminUser.last_name}`;
    branchSettings.head_email = adminUser.email;
    await branch.update({ settings: branchSettings }, { transaction });
    
    console.log(`✅ Auto-created main branch for institute ${institute.institute_code}: ${branch.name}`);
    console.log(`✅ Branch head set: ${adminUser.email} (ID: ${adminUser.id})`);
    
    return branch;
  } catch (error) {
    console.error(`❌ Failed to create auto branch for institute ${institute.id}:`, error);
    throw error;
  }
};

// ─── Helper: Create or update institute admin user ───────────────────────────
const createOrUpdateInstituteAdmin = async (institute, data, createdBy, transaction) => {
  const isEdit = !!data.id; // If we're updating
  const hasBranches = data.settings?.has_branches || data.has_branches || false;
  
  // Determine admin email and password
  const adminEmail = data.admin_email || institute.institute_email;
  const adminPassword = data.admin_password || generateRandomPassword();
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  
  const nameParts = (data.principal_name || institute.principal_name || 'Admin').split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || 'Admin';
  
  let adminUser;
  
  if (isEdit && institute.principal_user_id) {
    // Update existing admin user
    adminUser = await User.findByPk(institute.principal_user_id, { transaction });
    if (adminUser) {
      await adminUser.update({
        first_name: firstName,
        last_name: lastName,
        email: adminEmail.toLowerCase(),
        phone: data.principal_phone || institute.principal_phone,
        updated_by: createdBy
      }, { transaction });
      console.log(`✅ Updated institute admin user for ${institute.institute_code}`);
    }
  } else {
    // Create new admin user
    adminUser = await User.create({
      school_id: institute.id,
      branch_id: null, // Will be updated after branch creation
      role_id: data.institute_role_id,
      user_type: 'INSTITUTE_ADMIN',
      first_name: firstName,
      last_name: lastName,
      email: adminEmail.toLowerCase(),
      phone: data.principal_phone || institute.principal_phone,
      password_hash: passwordHash,
      is_active: true,
      created_by: createdBy,
      updated_by: createdBy
    }, { transaction });
    
    console.log(`✅ Created institute admin user for ${institute.institute_code}`);
    
    // Send welcome email with credentials (only on create)
    if (!isEdit) {
      const userType = hasBranches ? 'Institute Admin & Branch Head' : 'Institute Admin';
    await sendWelcomeEmailWithCredentials(
        adminUser,
        adminPassword,
        institute.institute_name,
        null,
        userType
      ).catch(err => console.error('Email send failed:', err));
    }
  }
  
  return { adminUser, adminPassword };
};

// ─── Get by ID with Auto-Invoice Generation ───────────────────────────────────
export const getInstituteById = async (id) => {
  const inst = await Institute.findByPk(id, {
    include: [
      ...BASE_INCLUDE,
      { model: User, as: 'principal', attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'branch_id'] },
    ],
  });

  if (!inst) throw new AppError('Institute not found.', 404);

  // AUTO-GENERATE INVOICE IF NEEDED
  await checkAndGenerateInvoice(inst);

  // Fetch again with updated invoices
  const updatedInst = await Institute.findByPk(id, {
    include: [
      ...BASE_INCLUDE,
      { model: User, as: 'principal', attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'branch_id'] },
    ],
  });

  const activeBranches = await Branch.count({
    where: {
      institute_id: id,
      is_active: true
    }
  });

  const fallbackBranches = updatedInst?.settings?.has_branches ? 2 : 1;
  const branchCount = activeBranches > 0 ? activeBranches : fallbackBranches;
  updatedInst.setDataValue('branches', branchCount);
  updatedInst.setDataValue('branch_count', branchCount);

  return updatedInst;
};

// ─── List with Auto-Invoice Generation ────────────────────────────────────────
export const getAllInstitutes = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, parseInt(query.limit) || 15);
  const offset = (page - 1) * limit;

  const where = {};
  if (query.is_active !== undefined && query.is_active !== '') {
    where.is_active = query.is_active === 'true' || query.is_active === true;
  }
  if (query.institute_type_id) where.institute_type_id = parseInt(query.institute_type_id);
  if (query.subscription_status) where.subscription_status = query.subscription_status;

  if (query.search) {
    where[Op.or] = [
      { institute_name: { [Op.iLike]: `%${query.search}%` } },
      { institute_code: { [Op.iLike]: `%${query.search}%` } },
      { institute_email: { [Op.iLike]: `%${query.search}%` } },
      { principal_email: { [Op.iLike]: `%${query.search}%` } },
    ];
  }

  const { count, rows } = await Institute.findAndCountAll({
    where,
    include: BASE_INCLUDE,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  // AUTO-GENERATE INVOICES FOR ALL INSTITUTES IN BACKGROUND
  rows.forEach(institute => {
    checkAndGenerateInvoice(institute).catch(err => {
      console.error(`❌ Failed to generate invoice for institute ${institute.id}:`, err);
    });
  });

  return {
    rows,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
};

// ─── Core function to check and generate invoice ──────────────────────────────
const checkAndGenerateInvoice = async (institute) => {
  if (!institute.is_active || !institute.subscription_plan_id) {
    return false;
  }

  if (!await needsNewInvoice(institute.id)) {
    return false;
  }

  const t = await sequelize.transaction();
  try {
    const inst = await Institute.findByPk(institute.id, {
      include: [{ model: SubscriptionPlan, as: 'plan' }],
      transaction: t
    });

    if (!inst || !inst.plan) {
      if (t && !t.finished) await t.rollback();
      return false;
    }

    const lastInvoice = await Invoice.findOne({
      where: { institute_id: inst.id },
      order: [['period_end', 'DESC']],
      transaction: t
    });

    let periodStart, periodEnd;
    
    if (!lastInvoice) {
      const today = new Date();
      periodStart = startOfMonth(today);
      periodEnd = endOfMonth(today);
    } else {
      periodStart = getNextBillingDate(lastInvoice.period_end, inst.plan.cycle);
      periodEnd = endOfMonth(periodStart);
    }

    const amount = inst.plan.price;
    const dueDate = calculateDueDate(periodEnd);

    const invoice = await Invoice.create({
      institute_id: inst.id,
      subscription_plan_id: inst.subscription_plan_id,
      invoice_number: await generateInvoiceNumber(inst.institute_code),
      amount: amount,
      tax_amount: 0,
      total_amount: amount,
      status: 'PENDING',
      due_date: dueDate,
      period_start: periodStart,
      period_end: periodEnd,
      billing_cycle: inst.plan.cycle,
      metadata: {
        generated_at: new Date(),
        generated_on_get: true,
        is_first_invoice: !lastInvoice,
        last_invoice_id: lastInvoice?.id
      }
    }, { transaction: t });

    await t.commit();
    console.log(`✅ Invoice generated for institute ${inst.institute_code}: ${invoice.invoice_number}`);
    return true;
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error(`❌ Error generating invoice for institute ${institute.id}:`, error);
    return false;
  }
};

// 🔥 NEW FUNCTION: Update all users' permissions when institute role changes
const updateAllUsersPermissions = async (instituteId, newRoleId) => {
  const t = await sequelize.transaction();
  try {
    const newRole = await Role.findByPk(newRoleId, { transaction: t });
    if (!newRole) {
      console.error(`Role ${newRoleId} not found for permission update`);
      return;
    }

    console.log(`🔄 Updating permissions for all users in institute ${instituteId} to role ${newRole.code}`);

    const users = await User.findAll({
      where: { 
        school_id: instituteId,
        is_active: true
      },
      transaction: t
    });

    console.log(`Found ${users.length} users to update`);

    for (const user of users) {
      const userTypeKey = user.user_type.toLowerCase();
      let normalizedType = userTypeKey;
      if (userTypeKey === 'institute_admin') normalizedType = 'instituteadmin';
      if (userTypeKey === 'master_admin') normalizedType = 'masteradmin';
      
      let userPermissions = [];
      
      if (newRole.permissions && newRole.permissions[normalizedType]) {
        userPermissions = newRole.permissions[normalizedType];
      } else if (newRole.permissions && newRole.permissions[userTypeKey]) {
        userPermissions = newRole.permissions[userTypeKey];
      } else {
        const possibleKeys = Object.keys(newRole.permissions || {});
        const matchingKey = possibleKeys.find(key => 
          key.toLowerCase().includes(userTypeKey.replace('_', ''))
        );
        if (matchingKey) {
          userPermissions = newRole.permissions[matchingKey];
        }
      }

      await user.update({
        role_id: newRoleId,
        permissions: userPermissions
      }, { transaction: t });

      console.log(`✅ Updated ${user.user_type} ${user.first_name} with ${userPermissions.length} permissions`);
    }

    await t.commit();
    console.log(`🎉 Successfully updated all users permissions for institute ${instituteId}`);
    
  } catch (error) {
    await t.rollback();
    console.error(`❌ Failed to update user permissions:`, error);
    throw error;
  }
};

// ─── Create Institute with Subscription, Auto-Branch & Admin User ─────────────
export const createInstitute = async (data, createdBy, file = null) => {
  let logoUrl = null;
  let logoPublicId = null;

  const t = await sequelize.transaction();
  try {
    // Duplicate check
    const existing = await Institute.findOne({
      where: {
        [Op.or]: [
          { institute_code: data.institute_code.toUpperCase() },
          { institute_email: data.institute_email.toLowerCase() },
        ],
      },
      transaction: t,
    });
    if (existing) {
      const field = existing.institute_code === data.institute_code.toUpperCase() ? 'code' : 'email';
      throw new AppError(`Institute with this ${field} already exists.`, 409);
    }

    // Get subscription plan
    let plan = null;
    let hasTrial = false;
    
    if (data.subscription_plan_id) {
      plan = await SubscriptionPlan.findByPk(data.subscription_plan_id, { transaction: t });
      if (!plan) throw new AppError('Subscription plan not found.', 404);
      
      hasTrial = plan.trial_days > 0;
    }

    const joiningDate = data.joining_date ? new Date(data.joining_date) : new Date();

    let trialDays = hasTrial ? plan.trial_days : 0;
    let trialEndDate = null;
    let subscriptionStatus = 'active';

    if (hasTrial) {
      subscriptionStatus = 'trial';
      const d = new Date(joiningDate);
      d.setDate(d.getDate() + trialDays);
      trialEndDate = d;
    }

    // 🔥 Check if has_branches is enabled
    const hasBranches = data.settings?.has_branches || data.has_branches || false;

    // Create institute
    const inst = await Institute.create({
      institute_name: data.institute_name,
      institute_code: data.institute_code.toUpperCase(),
      institute_email: data.institute_email.toLowerCase(),
      institute_contact: data.institute_contact,
      institute_type_id: parseInt(data.institute_type_id),
      institute_address: data.institute_address,
      institute_city: data.institute_city,
      institute_country: data.institute_country || 'Pakistan',
      institute_zip_code: data.institute_zip_code || null,
      principal_name: data.principal_name,
      principal_email: data.principal_email.toLowerCase(),
      principal_phone: data.principal_phone,
      institute_role_id: data.institute_role_id,
      subscription_plan_id: data.subscription_plan_id || null,
      trial_days: trialDays,
      trial_start_date: hasTrial ? joiningDate : null,
      trial_end_date: trialEndDate,
      institute_logo_url: null,
      institute_logo_public_id: null,
      joining_date: joiningDate,
      is_active: data.is_active !== false,
      subscription_status: subscriptionStatus,
      has_used_trial: hasTrial,
      settings: {
        has_branches: hasBranches,
        enable_parent_portal: data.enable_parent_portal !== false,
        enable_teacher_portal: data.enable_teacher_portal !== false,
        enable_student_portal: data.enable_student_portal !== false,
        enable_sms_notifications: !!data.enable_sms_notifications,
      },
    }, { transaction: t });

    // Upload logo after institute exists
    if (file) {
      try {
        const result = await uploadToCloudinary(file.path, `the-clouds-academy/${inst.id}/logos`, {
          transformation: [{ width: 600, height: 600, crop: 'limit' }, { quality: 'auto' }],
        });
        logoUrl = result.url;
        logoPublicId = result.public_id;
        await inst.update({
          institute_logo_url: logoUrl,
          institute_logo_public_id: logoPublicId
        }, { transaction: t });
      } finally {
        fs.unlink(file.path, () => {});
      }
    }

    // 🔥 STEP 1: Create institute admin user first
    const { adminUser, adminPassword } = await createOrUpdateInstituteAdmin(
      inst, 
      data, 
      createdBy, 
      t
    );

    // 🔥 STEP 2: Update institute with principal_user_id
    await inst.update({ principal_user_id: adminUser.id }, { transaction: t });

    // 🔥 STEP 3: Create branch if hasBranches = true
    let branch = null;
    if (hasBranches) {
      branch = await createAutoBranch(inst, adminUser, data, createdBy, t);
      
      // ✅ Update admin user's branch_id
      if (branch) {
        await adminUser.update({ branch_id: branch.id }, { transaction: t });
        console.log(`✅ Updated admin user branch_id to ${branch.id}`);
      }
    }

    // GENERATE FIRST INVOICE IF NOT IN TRIAL
    if (plan && !hasTrial) {
      await generateFirstInvoice(inst, plan, joiningDate, t);
    }

    await t.commit();
    
    const result = await getInstituteById(inst.id);
    result.dataValues.auto_branch_created = !!branch;
    result.dataValues.branch = branch;
    result.dataValues.admin_password = adminPassword; // For response (optional)
    
    return result;
  } catch (err) {
    await t.rollback();
    if (logoPublicId) deleteFromCloudinary(logoPublicId).catch(() => {});
    throw err;
  }
};

// ─── Generate first invoice ──────────────────────────────────────────
const generateFirstInvoice = async (institute, plan, startDate, transaction) => {
  const firstMonthStart = startOfMonth(startDate);
  const firstMonthEnd = endOfMonth(startDate);
  
  let periodStart, periodEnd, amount;
  
  if (startDate > firstMonthStart) {
    periodStart = startDate;
    periodEnd = firstMonthEnd;
    amount = calculateProratedAmount(plan.price, startDate, firstMonthEnd);
  } else {
    periodStart = firstMonthStart;
    periodEnd = firstMonthEnd;
    amount = plan.price;
  }

  const dueDate = calculateDueDate(periodEnd);

  const invoice = await Invoice.create({
    institute_id: institute.id,
    subscription_plan_id: plan.id,
    invoice_number: await generateInvoiceNumber(institute.institute_code),
    amount: amount,
    tax_amount: 0,
    total_amount: amount,
    status: 'PENDING',
    due_date: dueDate,
    period_start: periodStart,
    period_end: periodEnd,
    billing_cycle: plan.cycle,
    metadata: {
      is_first_invoice: true,
      is_prorated: startDate > firstMonthStart,
      original_plan_price: plan.price
    }
  }, { transaction });

  return invoice;
};

// ─── Update Institute with Auto-Branch Handling ───────────────────────────────
export const updateInstitute = async (id, data, file = null) => {
  const inst = await Institute.findByPk(id, {
    include: [{ model: Role, as: 'assignedRole' }]
  });
  if (!inst) throw new AppError('Institute not found.', 404);

  const updates = { ...data };
  const oldRoleId = inst.institute_role_id;
  
  // 🔥 Check if has_branches setting is changing
  const oldHasBranches = inst.settings?.has_branches || false;
  const newHasBranches = data.settings?.has_branches || data.has_branches || oldHasBranches;
  const hasBranchesChanged = oldHasBranches !== newHasBranches;

  // ── Cloudinary logo upload
  if (file) {
    try {
      const result = await uploadToCloudinary(file.path, `the-clouds-academy/${inst.id}/logos`, {
        transformation: [{ width: 600, height: 600, crop: 'limit' }, { quality: 'auto' }],
      });
      if (inst.institute_logo_public_id) {
        deleteFromCloudinary(inst.institute_logo_public_id).catch(() => {});
      }
      updates.institute_logo_url = result.url;
      updates.institute_logo_public_id = result.public_id;
    } finally {
      fs.unlink(file.path, () => {});
    }
  }

  // 🔥 FIXED: Trial dates ko sirf tab update karo agar explicitly provide kiye gaye hain
  if (data.trial_days === undefined) {
    delete updates.trial_days;
  }
  if (data.trial_end_date === undefined) {
    delete updates.trial_end_date;
  }
  
  // Agar plan change ho raha hai to trial status preserve karo
  if (data.subscription_plan_id && data.subscription_plan_id !== inst.subscription_plan_id) {
    updates.has_used_trial = inst.has_used_trial;
    updates.subscription_status = 'active';
  }

  // Merge JSONB settings
  if (data.settings) {
    updates.settings = { ...inst.settings, ...data.settings };
    delete updates.has_branches;
  } else if (data.has_branches !== undefined) {
    updates.settings = { ...inst.settings, has_branches: !!data.has_branches };
    delete updates.has_branches;
  }

  if (data.institute_code)  updates.institute_code  = data.institute_code.toUpperCase();
  if (data.institute_email) updates.institute_email  = data.institute_email.toLowerCase();
  if (data.principal_email) updates.principal_email  = data.principal_email.toLowerCase();
  if (data.institute_type_id) updates.institute_type_id = parseInt(data.institute_type_id);

  // Fields not on model
  delete updates.admin_email;
  delete updates.admin_password;

  const t = await sequelize.transaction();
  
  try {
    // Pehle institute update karo
    await inst.update(updates, { transaction: t });

    // 🔥 UPDATE OR CREATE INSTITUTE ADMIN USER
    const { adminUser } = await createOrUpdateInstituteAdmin(
      inst,
      { ...data, id: inst.id },
      data.updated_by || inst.principal_user_id,
      t
    );
    
    // Ensure institute has principal_user_id set
    if (!inst.principal_user_id && adminUser) {
      await inst.update({ principal_user_id: adminUser.id }, { transaction: t });
    }

    // 🔥 HANDLE BRANCH CREATION IF hasBranches CHANGED FROM false TO true
    if (hasBranchesChanged && newHasBranches === true) {
      const existingBranch = await Branch.findOne({
        where: { institute_id: inst.id, is_main: true },
        transaction: t
      });
      
      if (!existingBranch) {
        const branch = await createAutoBranch(inst, adminUser, data, data.updated_by || inst.principal_user_id, t);
        
        // Update admin user's branch_id
        if (branch && adminUser) {
          await adminUser.update({ branch_id: branch.id }, { transaction: t });
          console.log(`✅ Updated admin user branch_id to ${branch.id}`);
        }
      }
    }

    // 🔥 AGAR ROLE CHANGE HUA HAI TO SARE USERS KI PERMISSIONS UPDATE KARO
    if (data.institute_role_id && data.institute_role_id !== oldRoleId) {
      await updateAllUsersPermissions(inst.id, data.institute_role_id);
    }

    // CHECK AND GENERATE INVOICE AFTER UPDATE
    if (data.subscription_plan_id || data.subscription_status) {
      await checkAndGenerateInvoice(inst).catch(err => {
        console.error(`❌ Post-update invoice check failed for ${id}:`, err);
      });
    }

    await t.commit();
    
  } catch (err) {
    await t.rollback();
    throw err;
  }

  return await getInstituteById(id);
};

// ─── Update subscription plan ─────────────────────────────────────────────────
export const updateInstitutePlan = async (id, newPlanId, effectiveDate = new Date()) => {
  const inst = await Institute.findByPk(id, {
    include: [{ model: SubscriptionPlan, as: 'plan' }]
  });
  if (!inst) throw new AppError('Institute not found.', 404);

  const newPlan = await SubscriptionPlan.findByPk(newPlanId);
  if (!newPlan) throw new AppError('Subscription plan not found.', 404);

  const t = await sequelize.transaction();
  try {
    const hadTrialBefore = inst.has_used_trial;
    
    await inst.update({
      subscription_plan_id: newPlanId,
      subscription_status: 'active',
      has_used_trial: hadTrialBefore
    }, { transaction: t });

    await generateFirstInvoice(inst, newPlan, effectiveDate, t);

    await t.commit();
    return await getInstituteById(id);
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────
export const deleteInstitute = async (id) => {
  const inst = await Institute.findByPk(id);
  if (!inst) throw new AppError('Institute not found.', 404);
  await inst.destroy();
};

// ─── Toggle active ────────────────────────────────────────────────────────────
export const toggleInstituteStatus = async (id, is_active) => {
  const inst = await Institute.findByPk(id);
  if (!inst) throw new AppError('Institute not found.', 404);
  await inst.update({ is_active: !!is_active });
  return await getInstituteById(id);
};

// ─── Update subscription status ───────────────────────────────────────────────
export const updateSubscriptionStatus = async (id, subscription_status) => {
  const inst = await Institute.findByPk(id);
  if (!inst) throw new AppError('Institute not found.', 404);
  await inst.update({ subscription_status });
  return await getInstituteById(id);
};

// ─── Get Institute Invoices ──────────────────────────────────────────────
export const getInstituteInvoices = async (instituteId, query = {}) => {
  const page   = Math.max(1, parseInt(query.page)  || 1);
  const limit  = Math.min(100, parseInt(query.limit) || 20);
  const offset = (page - 1) * limit;

  const where = { institute_id: instituteId };
  if (query.status) where.status = query.status;

  const { count, rows } = await Invoice.findAndCountAll({
    where,
    include: [
      { model: SubscriptionPlan, as: 'plan', attributes: ['id', 'name', 'code', 'price', 'cycle'] },
    ],
    order: [['period_start', 'DESC']],
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

// ─── Get ALL Invoices across all institutes ───────────────────────────────────
export const getAllInvoices = async (query = {}) => {
  const page   = Math.max(1, parseInt(query.page)  || 1);
  const limit  = Math.min(100, parseInt(query.limit) || 20);
  const offset = (page - 1) * limit;

  const where = {};
  if (query.status) where.status = query.status;

  if (query.date_from || query.date_to) {
    where.created_at = {};
    if (query.date_from) where.created_at[Op.gte] = new Date(query.date_from);
    if (query.date_to)   where.created_at[Op.lte] = new Date(query.date_to + 'T23:59:59');
  } else if (query.month && query.year) {
    const start = new Date(parseInt(query.year), parseInt(query.month) - 1, 1);
    const end   = new Date(parseInt(query.year), parseInt(query.month), 0, 23, 59, 59);
    where.period_start = { [Op.between]: [start, end] };
  }

  const { count, rows } = await Invoice.findAndCountAll({
    where,
    include: [
      {
        model: Institute,
        as: 'institute',
        attributes: ['id', 'institute_name', 'institute_code', 'institute_logo_url'],
      },
      {
        model: SubscriptionPlan,
        as: 'plan',
        attributes: ['id', 'name', 'code', 'price', 'cycle'],
      },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  const summaryRaw = await Invoice.findAll({
    where: query.status ? where : {},
    attributes: [
      'status',
      [Invoice.sequelize.fn('COUNT', Invoice.sequelize.col('id')), 'count'],
      [Invoice.sequelize.fn('SUM', Invoice.sequelize.cast(Invoice.sequelize.col('total_amount'), 'DECIMAL')), 'total'],
    ],
    group: ['status'],
    raw: true,
  });

  const summary = { PENDING: 0, PAID: 0, OVERDUE: 0, total_paid_amount: 0, total_due_amount: 0 };
  summaryRaw.forEach(r => {
    summary[r.status] = parseInt(r.count) || 0;
    if (r.status === 'PAID')    summary.total_paid_amount += parseFloat(r.total) || 0;
    if (r.status === 'PENDING' || r.status === 'OVERDUE') summary.total_due_amount += parseFloat(r.total) || 0;
  });

  return {
    rows,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
    summary,
  };
};

// ─── Mark Invoice as Paid ─────────────────────────────────────────────────────
export const markInvoicePaid = async (invoiceId, { payment_method, payment_reference, notes, paid_by }) => {
  const invoice = await Invoice.findByPk(invoiceId, {
    include: [{ model: Institute, as: 'institute', attributes: ['id', 'institute_name', 'subscription_status'] }],
  });
  if (!invoice) throw new AppError('Invoice not found.', 404);
  if (invoice.status === 'PAID') throw new AppError('Invoice is already paid.', 400);

  await invoice.update({
    status:            'PAID',
    paid_at:           new Date(),
    payment_method:    payment_method || 'MANUAL',
    payment_reference: payment_reference || null,
    notes:             notes || null,
    metadata: {
      ...invoice.metadata,
      paid_by,
      paid_manually: true,
      paid_at: new Date().toISOString(),
    },
  });

  if (invoice.institute?.subscription_status === 'expired') {
    await Institute.update({ subscription_status: 'active' }, { where: { id: invoice.institute_id } });
  }

  console.log(`✅ Invoice ${invoice.invoice_number} marked as PAID`);
  return invoice.reload();
};

// ─── Delete Invoice ───────────────────────────────────────────────────────────
export const deleteInvoice = async (id) => {
  const invoice = await Invoice.findByPk(id);
  if (!invoice) throw new AppError('Invoice not found.', 404);
  await invoice.destroy();
  return true;
};

// ─── Bulk Delete Invoices ─────────────────────────────────────────────────────
export const bulkDeleteInvoices = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('Invalid or empty invoice IDs array', 400);
  }
  await Invoice.destroy({
    where: {
      id: ids
    }
  });
  return true;
};

// ─── Subscription History ─────────────────────────────────────────────────────
export const getSubscriptionHistory = async (instituteId) => {
  const invoices = await Invoice.findAll({
    where: { institute_id: instituteId },
    include: [{ model: SubscriptionPlan, as: 'plan', attributes: ['id', 'name', 'code', 'price', 'cycle'] }],
    order: [['period_start', 'DESC']],
  });

  const institute = await Institute.findByPk(instituteId, {
    attributes: ['id', 'institute_name', 'subscription_status', 'trial_end_date', 'joining_date'],
    include: [{ model: SubscriptionPlan, as: 'plan', attributes: ['id', 'name', 'code', 'price', 'cycle'] }],
  });

  return {
    institute,
    invoices,
    total_invoices: invoices.length,
    paid_count:     invoices.filter(i => i.status === 'PAID').length,
    pending_count:  invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE').length,
    total_paid:     invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0),
    total_due:      invoices.filter(i => i.status !== 'PAID').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0),
  };
};

// ─── Get subscription details ─────────────────────────────────────────────────
export const getSubscriptionDetails = async (instituteId) => {
  const inst = await Institute.findByPk(instituteId, {
    attributes: ['id', 'subscription_status', 'trial_days', 'trial_start_date', 'trial_end_date', 'has_used_trial'],
    include: [{ model: SubscriptionPlan, as: 'plan' }]
  });

  if (!inst) throw new AppError('Institute not found.', 404);

  return {
    status: inst.subscription_status,
    plan: inst.plan,
    trial: {
      days: inst.trial_days,
      start_date: inst.trial_start_date,
      end_date: inst.trial_end_date,
      has_used_trial: inst.has_used_trial,
      days_remaining: inst.trial_end_date 
        ? Math.max(0, Math.ceil((new Date(inst.trial_end_date) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0
    }
  };
};

/**
 * Get institute storage usage from Cloudinary
 */
export const getInstituteStorageUsage = async (instituteId) => {
  try {
    const institute = await Institute.findByPk(instituteId);
    if (!institute) throw new AppError('Institute not found', 404);

    const folderPath = `the-clouds-academy/${instituteId}`;
    
    const folderInfo = await getCloudinaryFolderSize(folderPath);

    const usageByType = {
      students: { total_bytes: 0, total_files: 0 },
      teachers: { total_bytes: 0, total_files: 0 },
      parents: { total_bytes: 0, total_files: 0 },
      staff: { total_bytes: 0, total_files: 0 },
      assignments: { total_bytes: 0, total_files: 0 },
      documents: { total_bytes: 0, total_files: 0 },
      qrcodes: { total_bytes: 0, total_files: 0 },
      logos: { total_bytes: 0, total_files: 0 },
      other: { total_bytes: 0, total_files: 0 }
    };

    const resources = Array.isArray(folderInfo.resources) ? folderInfo.resources : [];
    resources.forEach((resource) => {
      const publicId = String(resource.public_id || '');
      const relative = publicId.startsWith(`${folderPath}/`)
        ? publicId.slice(`${folderPath}/`.length)
        : publicId;
      const top = String(relative.split('/')[0] || '').toLowerCase();

      let bucket = 'other';
      if (['students', 'student'].includes(top)) bucket = 'students';
      else if (['teachers', 'teacher'].includes(top)) bucket = 'teachers';
      else if (['parents', 'parent'].includes(top)) bucket = 'parents';
      else if (['staff'].includes(top)) bucket = 'staff';
      else if (['assignments', 'assignment'].includes(top)) bucket = 'assignments';
      else if (['documents', 'document'].includes(top)) bucket = 'documents';
      else if (['qrcodes', 'qrcode', 'qr'].includes(top)) bucket = 'qrcodes';
      else if (['logos', 'logo'].includes(top)) bucket = 'logos';

      usageByType[bucket].total_bytes += Number(resource.bytes || 0);
      usageByType[bucket].total_files += 1;
    });
    
    const students = await User.count({
      where: { school_id: instituteId, user_type: 'STUDENT' }
    });
    
    const teachers = await User.count({
      where: { school_id: instituteId, user_type: 'TEACHER' }
    });
    
    const parents = await User.count({
      where: { school_id: instituteId, user_type: 'PARENT' }
    });
    
    const staff = await User.count({
      where: { 
        school_id: instituteId, 
        user_type: { [Op.in]: ['STAFF', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN'] }
      }
    });
    
    return {
      total_bytes: folderInfo.total_bytes,
      total_files: folderInfo.total_files,
      formatted_size: formatBytes(folderInfo.total_bytes),
      usage_by_type: usageByType,
      records_count: {
        students,
        teachers,
        parents,
        staff,
        total: students + teachers + parents + staff
      }
    };
  } catch (error) {
    console.error('❌ Storage usage error:', error);
    return {
      total_bytes: 0,
      total_files: 0,
      formatted_size: '0 B',
      usage_by_type: {},
      records_count: { students: 0, teachers: 0, parents: 0, staff: 0, total: 0 }
    };
  }
};

/**
 * Get institute dashboard stats with real counts
 */
export const getInstituteDashboardStats = async (instituteId) => {
  const students = await User.count({
    where: { school_id: instituteId, user_type: 'STUDENT' }
  });

  const teachers = await User.count({
    where: { school_id: instituteId, user_type: 'TEACHER' }
  });

  const parents = await User.count({
    where: { school_id: instituteId, user_type: 'PARENT' }
  });

  const staff = await User.count({
    where: {
      school_id: instituteId,
      user_type: { [Op.in]: ['STAFF', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN'] }
    }
  });

  const activeStudents = await User.count({
    where: { school_id: instituteId, user_type: 'STUDENT', is_active: true }
  });

  const inactiveStudents = await User.count({
    where: { school_id: instituteId, user_type: 'STUDENT', is_active: false }
  });

  const activeTeachers = await User.count({
    where: { school_id: instituteId, user_type: 'TEACHER', is_active: true }
  });

  const inactiveTeachers = await User.count({
    where: { school_id: instituteId, user_type: 'TEACHER', is_active: false }
  });

  const activeParents = await User.count({
    where: { school_id: instituteId, user_type: 'PARENT', is_active: true }
  });

  const inactiveParents = await User.count({
    where: { school_id: instituteId, user_type: 'PARENT', is_active: false }
  });

  const activeStaff = await User.count({
    where: {
      school_id: instituteId,
      user_type: { [Op.in]: ['STAFF', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN'] },
      is_active: true
    }
  });

  const inactiveStaff = await User.count({
    where: {
      school_id: instituteId,
      user_type: { [Op.in]: ['STAFF', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN'] },
      is_active: false
    }
  });
  
  const maleStudents = await User.count({
    where: { 
      school_id: instituteId, 
      user_type: 'STUDENT',
      'details.studentDetails.gender': 'male'
    }
  });
  
  const femaleStudents = await User.count({
    where: { 
      school_id: instituteId, 
      user_type: 'STUDENT',
      'details.studentDetails.gender': 'female'
    }
  });
  
  return {
    counts: {
      students,
      teachers,
      parents,
      staff,
      total_users: students + teachers + parents + staff
    },
    active: {
      students: activeStudents,
      teachers: activeTeachers,
      parents: activeParents,
      staff: activeStaff
    },
    inactive: {
      students: inactiveStudents,
      teachers: inactiveTeachers,
      parents: inactiveParents,
      staff: inactiveStaff
    },
    gender_distribution: {
      male: maleStudents,
      female: femaleStudents,
      other: students - (maleStudents + femaleStudents)
    },
    storage: await getInstituteStorageUsage(instituteId)
  };
};

/**
 * Get real institute students with pagination
 */
export const getInstituteStudents = async (instituteId, options = {}) => {
  const { page = 1, limit = 10, search = '', status } = options;
  const offset = (page - 1) * limit;
  
  const where = { 
    school_id: instituteId, 
    user_type: 'STUDENT'
  };
  
  if (search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${search}%` } },
      { last_name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { registration_no: { [Op.iLike]: `%${search}%` } }
    ];
  }
  
  if (status === 'active') where.is_active = true;
  if (status === 'inactive') where.is_active = false;
  
  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'registration_no', 'is_active', 'details', 'created_at'],
    order: [['created_at', 'DESC']],
    limit,
    offset
  });
  
  const formattedStudents = rows.map(student => ({
    id: student.id,
    name: `${student.first_name} ${student.last_name}`,
    father: student.details?.studentDetails?.father_name || '—',
    email: student.email,
    phone: student.phone,
    class: student.details?.studentDetails?.class_name || '—',
    roll: student.details?.studentDetails?.roll_no || student.registration_no || '—',
    fee_status: student.details?.studentDetails?.fee_status || 'pending',
    status: student.is_active ? 'active' : 'inactive',
    admission_date: student.details?.studentDetails?.admission_date || student.created_at,
    address: student.details?.studentDetails?.present_address,
    gender: student.details?.studentDetails?.gender
  }));
  
  return {
    data: formattedStudents,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    }
  };
};

/**
 * Get real institute teachers with pagination
 */
export const getInstituteTeachers = async (instituteId, options = {}) => {
  const { page = 1, limit = 10, search = '', status } = options;
  const offset = (page - 1) * limit;
  
  const where = { 
    school_id: instituteId, 
    user_type: 'TEACHER'
  };
  
  if (search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${search}%` } },
      { last_name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } }
    ];
  }
  
  if (status === 'active') where.is_active = true;
  if (status === 'inactive') where.is_active = false;
  
  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'registration_no', 'is_active', 'details', 'created_at'],
    order: [['created_at', 'DESC']],
    limit,
    offset
  });
  
  const formattedTeachers = rows.map(teacher => ({
    id: teacher.id,
    name: `${teacher.first_name} ${teacher.last_name}`,
    email: teacher.email,
    phone: teacher.phone,
    subject: teacher.details?.teacherDetails?.subjects?.[0] || teacher.details?.teacherDetails?.specialization || '—',
    qualification: teacher.details?.teacherDetails?.qualification || '—',
    experience: teacher.details?.teacherDetails?.experience_years ? `${teacher.details.teacherDetails.experience_years} yrs` : '—',
    join_date: teacher.details?.teacherDetails?.joining_date || teacher.created_at,
    salary: teacher.details?.teacherDetails?.salary,
    status: teacher.is_active ? 'active' : 'inactive'
  }));
  
  return {
    data: formattedTeachers,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    }
  };
};

/**
 * Get real institute parents with pagination
 */
export const getInstituteParents = async (instituteId, options = {}) => {
  const { page = 1, limit = 10, search = '', status } = options;
  const offset = (page - 1) * limit;
  
  const where = { 
    school_id: instituteId, 
    user_type: 'PARENT'
  };
  
  if (search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${search}%` } },
      { last_name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } }
    ];
  }
  
  if (status === 'active') where.is_active = true;
  if (status === 'inactive') where.is_active = false;
  
  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'registration_no', 'is_active', 'details', 'created_at'],
    order: [['created_at', 'DESC']],
    limit,
    offset
  });
  
  const formattedParents = rows.map(parent => {
    const parentDetails = parent.details?.parentDetails || {};
    const students = Array.isArray(parentDetails.students) ? parentDetails.students : [];
    const studentIds = Array.isArray(parentDetails.student_ids) ? parentDetails.student_ids : [];
    const childrenCount = students.length || studentIds.length;
    const childrenNames = students
      .map((child) => child?.name)
      .filter(Boolean)
      .join(', ');

    return {
      id: parent.id,
      name: `${parent.first_name} ${parent.last_name}`,
      email: parent.email,
      phone: parent.phone,
      cnic: parentDetails.cnic || '—',
      children: childrenCount,
      children_names: childrenNames || '—',
      address: parentDetails.address,
      status: parent.is_active ? 'active' : 'inactive'
    };
  });
  
  return {
    data: formattedParents,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    }
  };
};

/**
 * Get real institute staff with pagination
 */
export const getInstituteStaff = async (instituteId, options = {}) => {
  const { page = 1, limit = 10, search = '', status } = options;
  const offset = (page - 1) * limit;
  
  const where = { 
    school_id: instituteId, 
    user_type: { [Op.in]: ['STAFF', 'INSTITUTE_ADMIN', 'BRANCH_ADMIN'] }
  };
  
  if (search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${search}%` } },
      { last_name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } }
    ];
  }
  
  if (status === 'active') where.is_active = true;
  if (status === 'inactive') where.is_active = false;
  
  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'registration_no', 'is_active', 'details', 'created_at', 'user_type'],
    order: [['created_at', 'DESC']],
    limit,
    offset
  });
  
  const formattedStaff = rows.map(staff => ({
    id: staff.id,
    name: `${staff.first_name} ${staff.last_name}`,
    email: staff.email,
    phone: staff.phone,
    role: staff.user_type === 'INSTITUTE_ADMIN'
      ? 'Institute Admin'
      : staff.user_type === 'BRANCH_ADMIN'
        ? 'Branch Admin'
        : 'Staff',
    department: staff.details?.staffDetails?.department || '—',
    join_date: staff.details?.staffDetails?.joining_date || staff.created_at,
    salary: staff.details?.staffDetails?.salary,
    status: staff.is_active ? 'active' : 'inactive'
  }));
  
  return {
    data: formattedStaff,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    }
  };
};

export const getMasterAdminReports = async (query = {}) => {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  
  const prevMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const prevMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  // 1. Revenue This Month
  const thisMonthRevenue = await Invoice.sum('total_amount', {
    where: {
      status: 'PAID',
      paid_at: {
        [Op.between]: [currentMonthStart, currentMonthEnd]
      }
    }
  }) || 0;

  // 2. Revenue Previous Month
  const prevMonthRevenue = await Invoice.sum('total_amount', {
    where: {
      status: 'PAID',
      paid_at: {
        [Op.between]: [prevMonthStart, prevMonthEnd]
      }
    }
  }) || 0;

  // 3. Revenue Breakdown by Plan
  const planBreakdown = await Invoice.findAll({
    where: { status: 'PAID' },
    attributes: [
      'subscription_plan_id',
      [Invoice.sequelize.fn('SUM', Invoice.sequelize.cast(Invoice.sequelize.col('total_amount'), 'DECIMAL')), 'total'],
      [Invoice.sequelize.fn('COUNT', Invoice.sequelize.col('Invoice.id')), 'count']
    ],
    include: [{
      model: SubscriptionPlan,
      as: 'plan',
      attributes: ['name']
    }],
    group: ['subscription_plan_id', 'plan.id'],
    raw: true,
    nest: true
  });

  // 4. Revenue Breakdown by Institute
  const instituteBreakdown = await Invoice.findAll({
    where: { status: 'PAID' },
    attributes: [
      'institute_id',
      [Invoice.sequelize.fn('SUM', Invoice.sequelize.cast(Invoice.sequelize.col('total_amount'), 'DECIMAL')), 'total'],
      [Invoice.sequelize.fn('COUNT', Invoice.sequelize.col('Invoice.id')), 'count']
    ],
    include: [{
      model: Institute,
      as: 'institute',
      attributes: ['institute_name']
    }],
    group: ['institute_id', 'institute.id'],
    raw: true,
    nest: true
  });

  // 5. Overall Invoice Status Breakdown (Counts and Totals)
  const statusBreakdown = await Invoice.findAll({
    attributes: [
      'status',
      [Invoice.sequelize.fn('SUM', Invoice.sequelize.cast(Invoice.sequelize.col('total_amount'), 'DECIMAL')), 'total'],
      [Invoice.sequelize.fn('COUNT', Invoice.sequelize.col('Invoice.id')), 'count']
    ],
    group: ['status'],
    raw: true
  });

  // 6. Summary Counts
  const activeInstitutes = await Institute.count({ where: { is_active: true } }) || 0;
  const overduePayments = await Invoice.count({ where: { status: 'OVERDUE' } }) || 0;
  
  const newInstitutesMTD = await Institute.count({
    where: {
      created_at: {
        [Op.between]: [currentMonthStart, currentMonthEnd]
      }
    }
  }) || 0;

  return {
    thisMonthRevenue: parseFloat(thisMonthRevenue),
    prevMonthRevenue: parseFloat(prevMonthRevenue),
    activeInstitutes,
    overduePayments,
    newInstitutesMTD,
    planBreakdown: planBreakdown.map(p => ({
      plan_id: p.subscription_plan_id,
      plan_name: p.plan?.name || 'Unknown',
      total: parseFloat(p.total) || 0,
      count: parseInt(p.count) || 0
    })),
    instituteBreakdown: instituteBreakdown.map(i => ({
      institute_id: i.institute_id,
      institute_name: i.institute?.institute_name || 'Unknown',
      total: parseFloat(i.total) || 0,
      count: parseInt(i.count) || 0
    })),
    statusBreakdown: statusBreakdown.map(s => ({
      status: s.status,
      total: parseFloat(s.total) || 0,
      count: parseInt(s.count) || 0
    }))
  };
};

// Helper function
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}