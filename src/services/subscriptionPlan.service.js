/**
 * The Clouds Academy - Subscription Plan Service
 * Platform-level CRUD for subscription plans (managed by Master Admin)
 */

import { Op } from 'sequelize';
import SubscriptionPlan from '../models/postgres/SubscriptionPlan.model.js';
import AppError from '../utils/lib/AppError.js';

// ── List / Filter ─────────────────────────────────────────────────────────────

export const getAllPlans = async (query = {}, user = null) => {
  const {
    page = 1,
    limit = 20,
    search,
    cycle,
    is_active,
    is_published,
    is_popular,
  } = query;

  const where = {};

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { code: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (cycle) where.cycle = cycle;
  if (is_active !== undefined) where.is_active = is_active === 'true' || is_active === true;
  if (is_published !== undefined) where.is_published = is_published === 'true' || is_published === true;
  if (is_popular !== undefined) where.is_popular = is_popular === 'true' || is_popular === true;

  if (user?.details?.view_own_data) {
    const ownerCondition = {
      [Op.or]: [
        { created_by: user.id },
        { updated_by: user.id }
      ]
    };
    if (where[Op.or]) {
      where[Op.and] = [{ [Op.or]: where[Op.or] }, ownerCondition];
      delete where[Op.or];
    } else {
      where[Op.and] = [ownerCondition];
    }
  }

  const offset = (Number(page) - 1) * Number(limit);

  const { count, rows } = await SubscriptionPlan.findAndCountAll({
    where,
    order: [
      ['display_order', 'ASC'],
      ['created_at', 'DESC'],
    ],
    limit: Number(limit),
    offset,
  });

  return {
    plans: rows,
    pagination: {
      total: count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(count / Number(limit)),
    },
  };
};

// ── Public plans (for institute sign-up page — no auth needed) ────────────────

export const getPublicPlans = async () => {
  return SubscriptionPlan.findAll({
    where: { is_active: true, is_published: true },
    order: [['display_order', 'ASC']],
    // Exclude internal metadata from public response
    attributes: { exclude: ['metadata', 'default_role_code'] },
  });
};

// ── Single plan ───────────────────────────────────────────────────────────────

export const getPlanById = async (id) => {
  const plan = await SubscriptionPlan.findByPk(id);
  if (!plan) throw new AppError('Subscription plan not found', 404);
  return plan;
};

// ── Create ────────────────────────────────────────────────────────────────────

export const createPlan = async (data, createdBy = null) => {
  const {
    name, code, description, cycle, price, currency,
    trial_days, limits, is_popular, is_published, is_active,
    features, default_role_code, metadata, display_order,
  } = data;

  // Duplicate code check
  const existing = await SubscriptionPlan.findOne({ where: { code: code?.toUpperCase() } });
  if (existing) throw new AppError(`A plan with code "${code}" already exists`, 409);

  const plan = await SubscriptionPlan.create({
    name,
    code: code?.toUpperCase(),
    description,
    cycle,
    price,
    currency,
    trial_days,
    limits,
    is_popular,
    is_published,
    is_active,
    features,
    default_role_code,
    metadata,
    display_order,
    created_by: createdBy,
  });

  return plan;
};

// ── Update ────────────────────────────────────────────────────────────────────

export const updatePlan = async (id, data, updatedBy = null) => {
  const plan = await getPlanById(id);

  // If code is being changed, check for duplicate
  if (data.code && data.code.toUpperCase() !== plan.code) {
    const conflict = await SubscriptionPlan.findOne({
      where: { code: data.code.toUpperCase(), id: { [Op.ne]: id } },
    });
    if (conflict) throw new AppError(`A plan with code "${data.code}" already exists`, 409);
    data.code = data.code.toUpperCase();
  }

  const updates = { ...data };
  if (updatedBy) updates.updated_by = updatedBy;

  await plan.update(updates);
  await plan.reload();
  return plan;
};

// ── Delete (hard) ─────────────────────────────────────────────────────────────

export const deletePlan = async (id) => {
  const plan = await getPlanById(id);
  await plan.destroy();
};

// ── Toggle helpers ────────────────────────────────────────────────────────────

export const togglePublished = async (id, updatedBy = null) => {
  const plan = await getPlanById(id);
  const updates = { is_published: !plan.is_published };
  if (updatedBy) updates.updated_by = updatedBy;
  await plan.update(updates);
  await plan.reload();
  return plan;
};

export const togglePopular = async (id, updatedBy = null) => {
  const plan = await getPlanById(id);
  const updates = { is_popular: !plan.is_popular };
  if (updatedBy) updates.updated_by = updatedBy;
  await plan.update(updates);
  await plan.reload();
  return plan;
};

export const toggleActive = async (id, updatedBy = null) => {
  const plan = await getPlanById(id);
  const updates = { is_active: !plan.is_active };
  if (updatedBy) updates.updated_by = updatedBy;
  await plan.update(updates);
  await plan.reload();
  return plan;
};
