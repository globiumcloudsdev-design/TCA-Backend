// /**
//  * The Clouds Academy — Institute Service
//  * Master Admin CRUD for institutes (schools, colleges, academies…)
//  */

// import { Op } from 'sequelize';
// import bcrypt from 'bcryptjs';
// import sequelize from '../config/database.js';
// import Institute     from '../models/postgres/Institute.modal.js';
// import InstituteType from '../models/postgres/InstituteType.model.js';
// import SubscriptionPlan from '../models/postgres/SubscriptionPlan.model.js';
// import Role    from '../models/postgres/Role.model.js';
// import User    from '../models/postgres/User.model.js';
// import { AppError } from '../utils/lib/AppError.js';
// import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
// import fs from 'fs';

// // ─── Shared include config ────────────────────────────────────────────────────
// const BASE_INCLUDE = [
//   { model: InstituteType,     as: 'type',         attributes: ['id', 'name', 'slug', 'icon'] },
//   { model: SubscriptionPlan,  as: 'plan',         attributes: ['id', 'name', 'code', 'price', 'cycle', 'trial_days'] },
//   { model: Role,              as: 'assignedRole', attributes: ['id', 'name', 'code'] },
// ];

// // ─── List ─────────────────────────────────────────────────────────────────────
// export const getAllInstitutes = async (query = {}) => {
//   const page   = Math.max(1, parseInt(query.page)  || 1);
//   const limit  = Math.min(100, parseInt(query.limit) || 15);
//   const offset = (page - 1) * limit;

//   const where = {};
//   if (query.is_active !== undefined && query.is_active !== '') {
//     where.is_active = query.is_active === 'true' || query.is_active === true;
//   }
//   if (query.institute_type_id) where.institute_type_id = parseInt(query.institute_type_id);
//   if (query.subscription_status) where.subscription_status = query.subscription_status;

//   if (query.search) {
//     where[Op.or] = [
//       { institute_name:  { [Op.iLike]: `%${query.search}%` } },
//       { institute_code:  { [Op.iLike]: `%${query.search}%` } },
//       { institute_email: { [Op.iLike]: `%${query.search}%` } },
//       { principal_email: { [Op.iLike]: `%${query.search}%` } },
//     ];
//   }

//   const { count, rows } = await Institute.findAndCountAll({
//     where,
//     include: BASE_INCLUDE,
//     order: [['created_at', 'DESC']],
//     limit,
//     offset,
//   });

//   return {
//     rows,
//     total:      count,
//     page,
//     limit,
//     totalPages: Math.ceil(count / limit),
//   };
// };

// // ─── Get by ID ────────────────────────────────────────────────────────────────
// export const getInstituteById = async (id) => {
//   const inst = await Institute.findByPk(id, {
//     include: [
//       ...BASE_INCLUDE,
//       { model: User, as: 'principal', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
//     ],
//   });
//   if (!inst) throw new AppError('Institute not found.', 404);
//   return inst;
// };

// // ─── Create ───────────────────────────────────────────────────────────────────
// export const createInstitute = async (data, createdBy, file = null) => {
//   // ── Cloudinary logo upload (before transaction — cleanup on DB error)
//   let logoUrl = null;
//   let logoPublicId = null;
//   if (file) {
//     try {
//       const result = await uploadToCloudinary(file.path, 'institutes/logos', {
//         transformation: [{ width: 500, height: 500, crop: 'limit' }, { quality: 'auto' }],
//       });
//       logoUrl = result.url;
//       logoPublicId = result.public_id;
//     } finally {
//       fs.unlink(file.path, () => {}); // cleanup temp file regardless
//     }
//   }

//   const t = await sequelize.transaction();
//   try {
//     // Duplicate check
//     const existing = await Institute.findOne({
//       where: {
//         [Op.or]: [
//           { institute_code:  data.institute_code.toUpperCase() },
//           { institute_email: data.institute_email.toLowerCase() },
//         ],
//       },
//       transaction: t,
//     });
//     if (existing) {
//       const field = existing.institute_code === data.institute_code.toUpperCase() ? 'code' : 'email';
//       throw new AppError(`Institute with this ${field} already exists.`, 409);
//     }

//     // Auto-fill trial info from plan
//     let trialDays          = parseInt(data.trial_days) || 30;
//     let trialEndDate       = data.trial_end_date  || null;
//     let subscriptionStatus = data.subscription_status || 'trial';

//     if (data.subscription_plan_id) {
//       const plan = await SubscriptionPlan.findByPk(data.subscription_plan_id, { transaction: t });
//       if (!plan) throw new AppError('Subscription plan not found.', 404);
//       if (!data.trial_days) trialDays = plan.trial_days ?? 30;
//       subscriptionStatus = plan.trial_days > 0 ? 'trial' : 'active';
//     }
//     if (!trialEndDate) {
//       const d = new Date();
//       d.setDate(d.getDate() + trialDays);
//       trialEndDate = d;
//     }

//     // Create institute
//     const inst = await Institute.create({
//       institute_name:     data.institute_name,
//       institute_code:     data.institute_code.toUpperCase(),
//       institute_email:    data.institute_email.toLowerCase(),
//       institute_contact:  data.institute_contact,
//       institute_type_id:  parseInt(data.institute_type_id),
//       institute_address:  data.institute_address,
//       institute_city:     data.institute_city,
//       institute_country:  data.institute_country || 'Pakistan',
//       institute_zip_code: data.institute_zip_code || null,
//       principal_name:     data.principal_name,
//       principal_email:    data.principal_email.toLowerCase(),
//       principal_phone:    data.principal_phone,
//       institute_role_id:  data.institute_role_id,
//       subscription_plan_id: data.subscription_plan_id || null,
//       trial_days:          trialDays,
//       trial_start_date:    new Date(),
//       trial_end_date:      trialEndDate,
//       institute_logo_url:       logoUrl,
//       institute_logo_public_id: logoPublicId,
//       joining_date:        data.joining_date || new Date(),
//       is_active:           data.is_active !== false,
//       subscription_status: subscriptionStatus,
//       settings: {
//         has_branches:             !!data.has_branches,
//         enable_parent_portal:     data.enable_parent_portal  !== false,
//         enable_student_portal:    data.enable_student_portal !== false,
//         enable_sms_notifications: !!data.enable_sms_notifications,
//       },
//     }, { transaction: t });

//     // Create principal admin user
//     if (data.admin_email && data.admin_password) {
//       const nameParts    = (data.principal_name || 'Admin').split(' ');
//       const passwordHash = await bcrypt.hash(data.admin_password, 12);
//       const user = await User.create({
//         school_id:     inst.id,
//         role_id:       data.institute_role_id,
//         user_type:     'INSTITUTE_ADMIN',
//         first_name:    nameParts[0],
//         last_name:     nameParts.slice(1).join(' ') || 'Admin',
//         email:         data.admin_email.toLowerCase(),
//         phone:         data.principal_phone,
//         password_hash: passwordHash,
//         is_active:     true,
//         created_by:    createdBy,
//       }, { transaction: t });
//       await inst.update({ principal_user_id: user.id }, { transaction: t });
//     }

//     await t.commit();
//     return await getInstituteById(inst.id);
//   } catch (err) {
//     await t.rollback();
//     // Delete orphaned Cloudinary file if DB insert failed
//     if (logoPublicId) deleteFromCloudinary(logoPublicId).catch(() => {});
//     throw err;
//   }
// };

// // ─── Update ───────────────────────────────────────────────────────────────────
// export const updateInstitute = async (id, data, file = null) => {
//   const inst = await Institute.findByPk(id);
//   if (!inst) throw new AppError('Institute not found.', 404);

//   const updates = { ...data };

//   // ── Cloudinary logo upload (delete old, upload new)
//   if (file) {
//     try {
//       const result = await uploadToCloudinary(file.path, 'institutes/logos', {
//         transformation: [{ width: 500, height: 500, crop: 'limit' }, { quality: 'auto' }],
//       });
//       // Delete previous logo from Cloudinary (fire-and-forget)
//       if (inst.institute_logo_public_id) {
//         deleteFromCloudinary(inst.institute_logo_public_id).catch(() => {});
//       }
//       updates.institute_logo_url = result.url;
//       updates.institute_logo_public_id = result.public_id;
//     } finally {
//       fs.unlink(file.path, () => {}); // cleanup temp file
//     }
//   }

//   // ❌ REMOVED: Auto-sync trial_days on plan change to prevent overwriting manual/previous trial info
//   // trial_days and trial_end_date should only be updated if explicitly passed in data

//   // Merge JSONB settings
//   if (data.settings) {
//     updates.settings = { ...inst.settings, ...data.settings };
//     delete updates.has_branches;
//   } else if (data.has_branches !== undefined) {
//     updates.settings = { ...inst.settings, has_branches: !!data.has_branches };
//     delete updates.has_branches;
//   }

//   if (data.institute_code)  updates.institute_code  = data.institute_code.toUpperCase();
//   if (data.institute_email) updates.institute_email  = data.institute_email.toLowerCase();
//   if (data.principal_email) updates.principal_email  = data.principal_email.toLowerCase();
//   if (data.institute_type_id) updates.institute_type_id = parseInt(data.institute_type_id);

//   // Fields not on model
//   delete updates.admin_email;
//   delete updates.admin_password;

//   await inst.update(updates);
//   return await getInstituteById(id);
// };

// // ─── Delete ───────────────────────────────────────────────────────────────────
// export const deleteInstitute = async (id) => {
//   const inst = await Institute.findByPk(id);
//   if (!inst) throw new AppError('Institute not found.', 404);
//   await inst.destroy();
// };

// // ─── Toggle active ────────────────────────────────────────────────────────────
// export const toggleInstituteStatus = async (id, is_active) => {
//   const inst = await Institute.findByPk(id);
//   if (!inst) throw new AppError('Institute not found.', 404);
//   await inst.update({ is_active: !!is_active });
//   return await getInstituteById(id);
// };

// // ─── Update subscription status ───────────────────────────────────────────────
// export const updateSubscriptionStatus = async (id, subscription_status) => {
//   const inst = await Institute.findByPk(id);
//   if (!inst) throw new AppError('Institute not found.', 404);
//   await inst.update({ subscription_status });
//   return await getInstituteById(id);
// };

/**
 * The Clouds Academy — Institute Service
 * Complete with auto-invoice generation on GET
 */

import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import sequelize from '../config/database.js';
import Institute from '../models/postgres/Institute.model.js';
import InstituteType from '../models/postgres/InstituteType.model.js';
import SubscriptionPlan from '../models/postgres/SubscriptionPlan.model.js';
import Role from '../models/postgres/Role.model.js';
import User from '../models/postgres/User.model.js';
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
import { startOfMonth, endOfMonth, isSameMonth, isBefore } from 'date-fns';

// ─── Shared include config ────────────────────────────────────────────────────
const BASE_INCLUDE = [
  { model: InstituteType, as: 'type', attributes: ['id', 'name', 'slug', 'icon'] },
  { model: SubscriptionPlan, as: 'plan', attributes: ['id', 'name', 'code', 'price', 'cycle', 'trial_days'] },
  { model: Role, as: 'assignedRole', attributes: ['id', 'name', 'code'] },
//   {
//     model: Invoice,
//     as: 'invoices',
//     required: false,
//     separate: true,
//     limit: 12,
//     order: [['period_start', 'DESC']]
//   }
 { 
    model: Invoice, 
    as: 'invoices',  // This must match the 'as' in the association
    required: false,
    limit: 12,
    order: [['period_start', 'DESC']],
    attributes: ['id', 'invoice_number', 'amount', 'total_amount', 'status', 'due_date', 'period_start', 'period_end']
  }
];

// ─── Get by ID with Auto-Invoice Generation ───────────────────────────────────
export const getInstituteById = async (id) => {
  const inst = await Institute.findByPk(id, {
    include: [
      ...BASE_INCLUDE,
      { model: User, as: 'principal', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
    ],
  });

  if (!inst) throw new AppError('Institute not found.', 404);

  // 🔥 AUTO-GENERATE INVOICE IF NEEDED (without cron job)
  await checkAndGenerateInvoice(inst);

  // Fetch again with updated invoices
  const updatedInst = await Institute.findByPk(id, {
    include: [
      ...BASE_INCLUDE,
      { model: User, as: 'principal', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
    ],
  });

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

  // 🔥 AUTO-GENERATE INVOICES FOR ALL INSTITUTES IN BACKGROUND
  // Don't await to avoid slowing down response
  rows.forEach(institute => {
    console.log(`Checking/Generating invoice for: ${institute.institute_name} (${institute.id})`);
    checkAndGenerateInvoice(institute).then(result => {
      if (result) console.log(`✅ Invoice generated for ${institute.institute_name}`);
    }).catch(err => {
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
  // Only proceed if institute is active and has a subscription plan
  if (!institute.is_active || !institute.subscription_plan_id) {
    return false;
  }

  // Check if we need a new invoice
  if (!await needsNewInvoice(institute.id)) {
    return false;
  }

  const t = await sequelize.transaction();
  try {
    // Get fresh institute data with plan
    const inst = await Institute.findByPk(institute.id, {
      include: [{ model: SubscriptionPlan, as: 'plan' }],
      transaction: t
    });

    if (!inst || !inst.plan) {
      if (t && !t.finished) await t.rollback();
      return false;
    }

    // Get the last invoice
    const lastInvoice = await Invoice.findOne({
      where: { institute_id: inst.id },
      order: [['period_end', 'DESC']],
      transaction: t
    });

    // Determine next billing period
    let periodStart, periodEnd;

    // 🔥 MODIFIED: Trial ho ya Active, agar occurs check pass ho gaya hai (needsNewInvoice se),
    // toh hum is month ki invoice generate karenge.
    
    if (!lastInvoice) {
      // Pehli invoice: Current month ki dates set karte hain
      const today = new Date();
      periodStart = startOfMonth(today);
      periodEnd = endOfMonth(today);
    } else {
      // Agli billing period
      periodStart = getNextBillingDate(lastInvoice.period_end, inst.plan.cycle);
      periodEnd = endOfMonth(periodStart);
    }

    // Calculate amount (Plan price)
    const amount = inst.plan.price;

    // Calculate due date (5th-8th of next month)
    const dueDate = calculateDueDate(periodEnd);

    // Create invoice
    const invoice = await Invoice.create({
      institute_id: inst.id,
      subscription_plan_id: inst.subscription_plan_id,
      invoice_number: await generateInvoiceNumber(inst.institute_code),
      amount: amount,
      tax_amount: 0, // Add tax if needed
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

// ─── Create Institute with Subscription & First Invoice ───────────────────────
export const createInstitute = async (data, createdBy, file = null) => {
  // Logo upload code (same as before) ...
  let logoUrl = null;
  let logoPublicId = null;
  if (file) {
    try {
      const result = await uploadToCloudinary(file.path, 'institutes/logos', {
        transformation: [{ width: 500, height: 500, crop: 'limit' }, { quality: 'auto' }],
      });
      logoUrl = result.url;
      logoPublicId = result.public_id;
    } finally {
      fs.unlink(file.path, () => {});
    }
  }

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
      
      // 🔥 IMPORTANT: Trial sirf first subscription par milega
      hasTrial = plan.trial_days > 0;
    }

    // Joining date
    const joiningDate = data.joining_date ? new Date(data.joining_date) : new Date();

    // Trial dates - sirf pehli bar
    let trialDays = hasTrial ? plan.trial_days : 0;
    let trialEndDate = null;
    let subscriptionStatus = 'active';

    if (hasTrial) {
      subscriptionStatus = 'trial';
      const d = new Date(joiningDate);
      d.setDate(d.getDate() + trialDays);
      trialEndDate = d;
    }

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
      institute_logo_url: logoUrl,
      institute_logo_public_id: logoPublicId,
      joining_date: joiningDate,
      is_active: data.is_active !== false,
      subscription_status: subscriptionStatus,
      has_used_trial: hasTrial, // 🔥 NEW FIELD: track if trial was ever used
      settings: {
        has_branches: !!data.has_branches,
        enable_parent_portal: data.enable_parent_portal !== false,
        enable_student_portal: data.enable_student_portal !== false,
        enable_sms_notifications: !!data.enable_sms_notifications,
      },
    }, { transaction: t });

    // Create principal admin user
    if (data.admin_email && data.admin_password) {
      const nameParts = (data.principal_name || 'Admin').split(' ');
      const passwordHash = await bcrypt.hash(data.admin_password, 12);
      const user = await User.create({
        school_id: inst.id,
        role_id: data.institute_role_id,
        user_type: 'INSTITUTE_ADMIN',
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(' ') || 'Admin',
        email: data.admin_email.toLowerCase(),
        phone: data.principal_phone,
        password_hash: passwordHash,
        is_active: true,
        created_by: createdBy,
      }, { transaction: t });
      await inst.update({ principal_user_id: user.id }, { transaction: t });
    }

    // 🔥 GENERATE FIRST INVOICE IF NOT IN TRIAL
    if (plan && !hasTrial) {
      await generateFirstInvoice(inst, plan, joiningDate, t);
    }

    await t.commit();
    return await getInstituteById(inst.id);
  } catch (err) {
    await t.rollback();
    if (logoPublicId) deleteFromCloudinary(logoPublicId).catch(() => {});
    throw err;
  }
};

// ─── Generate first invoice (prorated if mid-month) ──────────────────────────
const generateFirstInvoice = async (institute, plan, startDate, transaction) => {
  const firstMonthStart = startOfMonth(startDate);
  const firstMonthEnd = endOfMonth(startDate);
  
  let periodStart, periodEnd, amount;
  
  if (startDate > firstMonthStart) {
    // Prorated for remaining days
    periodStart = startDate;
    periodEnd = firstMonthEnd;
    amount = calculateProratedAmount(plan.price, startDate, firstMonthEnd);
  } else {
    // Full month
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
    // 🔥 IMPORTANT: Plan change par trial nahi milega (sirf pehli bar)
    const hadTrialBefore = inst.has_used_trial;
    
    await inst.update({
      subscription_plan_id: newPlanId,
      subscription_status: 'active', // Direct active, no trial on plan change
      has_used_trial: hadTrialBefore // Preserve trial status
    }, { transaction: t });

    // Generate invoice for plan change
    await generateFirstInvoice(inst, newPlan, effectiveDate, t);

    await t.commit();
    return await getInstituteById(id);
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// ─── Update ───────────────────────────────────────────────────────────────────
export const updateInstitute = async (id, data, file = null) => {
  const inst = await Institute.findByPk(id);
  if (!inst) throw new AppError('Institute not found.', 404);

  const updates = { ...data };

  // ── Cloudinary logo upload (delete old, upload new)
  if (file) {
    try {
      const result = await uploadToCloudinary(file.path, 'institutes/logos', {
        transformation: [{ width: 500, height: 500, crop: 'limit' }, { quality: 'auto' }],
      });
      // Delete previous logo from Cloudinary (fire-and-forget)
      if (inst.institute_logo_public_id) {
        deleteFromCloudinary(inst.institute_logo_public_id).catch(() => {});
      }
      updates.institute_logo_url = result.url;
      updates.institute_logo_public_id = result.public_id;
    } finally {
      fs.unlink(file.path, () => {}); // cleanup temp file
    }
  }

  // ❌ REMOVED: Auto-sync trial_days on plan change to prevent overwriting manual/previous trial info
  // trial_days and trial_end_date should only be updated if explicitly passed in data

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

  await inst.update(updates);

  // 🔥 CHECK AND GENERATE INVOICE AFTER UPDATE (if plan or status changed)
  if (data.subscription_plan_id || data.subscription_status) {
    await checkAndGenerateInvoice(inst).catch(err => {
      console.error(`❌ Post-update invoice check failed for ${id}:`, err);
    });
  }

  return await getInstituteById(id);
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

// ─── Get Institute Invoices (paid/unpaid filter) ──────────────────────────────
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

  // Date filter — support both legacy month/year and explicit date_from/date_to
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

  // Summary counts
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

  // If institute was expired, auto-activate it on payment
  if (invoice.institute?.subscription_status === 'expired') {
    await Institute.update({ subscription_status: 'active' }, { where: { id: invoice.institute_id } });
  }

  console.log(`✅ Invoice ${invoice.invoice_number} marked as PAID`);
  return invoice.reload();
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
