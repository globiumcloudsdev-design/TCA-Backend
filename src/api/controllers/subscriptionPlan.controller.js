/**
 * The Clouds Academy - Subscription Plan Controller
 * Permission-gated CRUD for platform-level subscription plans
 *
 * Permission codes:
 *   sub_template.create  → create
 *   sub_template.read    → list / get
 *   sub_template.update  → update / toggle
 *   sub_template.delete  → delete
 *
 * Master Admin automatically passes all permission checks (handled in hasPermission middleware).
 */

import catchAsync from '../../utils/lib/catchAsync.js';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendNoContent,
} from '../../utils/helpers/response.helper.js';
import {
  getAllPlans,
  getPublicPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  togglePublished,
  togglePopular,
  toggleActive,
} from '../../services/subscriptionPlan.service.js';

// ── GET /subscription-plans  (protected: sub_template.read) ──────────────────
export const getAllPlansController = catchAsync(async (req, res) => {
  const { plans, pagination } = await getAllPlans(req.query);
  sendPaginated(res, plans, pagination, 'Subscription plans retrieved successfully');
});

// ── GET /subscription-plans/public  (no auth — for sign-up page) ─────────────
export const getPublicPlansController = catchAsync(async (req, res) => {
  const plans = await getPublicPlans();
  sendSuccess(res, plans, 'Published subscription plans retrieved');
});

// ── GET /subscription-plans/:id  (protected: sub_template.read) ──────────────
export const getPlanByIdController = catchAsync(async (req, res) => {
  const plan = await getPlanById(req.params.id);
  sendSuccess(res, plan, 'Subscription plan retrieved successfully');
});

// ── POST /subscription-plans  (protected: sub_template.create) ───────────────
export const createPlanController = catchAsync(async (req, res) => {
  const plan = await createPlan(req.body);
  sendCreated(res, plan, 'Subscription plan created successfully');
});

// ── PUT /subscription-plans/:id  (protected: sub_template.update) ────────────
export const updatePlanController = catchAsync(async (req, res) => {
  const plan = await updatePlan(req.params.id, req.body);
  sendSuccess(res, plan, 'Subscription plan updated successfully');
});

// ── DELETE /subscription-plans/:id  (protected: sub_template.delete) ─────────
export const deletePlanController = catchAsync(async (req, res) => {
  await deletePlan(req.params.id);
  sendNoContent(res);
});

// ── PATCH /subscription-plans/:id/toggle-publish  (sub_template.update) ──────
export const togglePublishedController = catchAsync(async (req, res) => {
  const plan = await togglePublished(req.params.id);
  sendSuccess(
    res,
    plan,
    `Subscription plan ${plan.is_published ? 'published' : 'unpublished'} successfully`
  );
});

// ── PATCH /subscription-plans/:id/toggle-popular  (sub_template.update) ──────
export const togglePopularController = catchAsync(async (req, res) => {
  const plan = await togglePopular(req.params.id);
  sendSuccess(
    res,
    plan,
    `Subscription plan marked as ${plan.is_popular ? 'popular' : 'not popular'} successfully`
  );
});

// ── PATCH /subscription-plans/:id/toggle-active  (sub_template.update) ───────
export const toggleActiveController = catchAsync(async (req, res) => {
  const plan = await toggleActive(req.params.id);
  sendSuccess(
    res,
    plan,
    `Subscription plan ${plan.is_active ? 'activated' : 'deactivated'} successfully`
  );
});
