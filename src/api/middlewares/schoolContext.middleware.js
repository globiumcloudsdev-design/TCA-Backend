/**
 * The Clouds Academy - Institute Context Middleware
 *
 * Resolves institute from header (X-School-Code) or user's school_id
 * and attaches:
 *   req.institute   → the resolved Institute record
 *   req.school      → alias for req.institute (backward compatibility)
 *   req.branch_id   → optional UUID (null when institute has no branches)
 *
 * Branch resolution order:
 *   1. X-Branch-ID request header  (explicit override)
 *   2. req.user.branch_id           (user's default branch)
 *   3. null                         (institute-wide scope)
 *
 * Consumers: any service that builds a `where` clause should spread
 *   ...(req.branch_id && { branch_id: req.branch_id })
 * so the filter is applied only when a branch is in context.
 */

import { AppError } from '../../utils/lib/AppError.js';
import catchAsync from '../../utils/lib/catchAsync.js';
import Institute from '../../models/postgres/Institute.modal.js';

export const schoolContext = catchAsync(async (req, res, next) => {
  // Master Admin doesn't need institute context
  if (req.user?.user_type === 'MASTER_ADMIN') return next();

  let institute = null;

  // Try to resolve from user's assigned institute (school_id column)
  if (req.user?.school_id) {
    institute = await Institute.findByPk(req.user.school_id);
  }

  // Try header (X-School-Code)
  if (!institute && req.headers['x-school-code']) {
    institute = await Institute.findOne({
      where: { institute_code: req.headers['x-school-code'], is_active: true },
    });
  }

  if (!institute) throw new AppError('Institute not found or inactive.', 403);
  if (!institute.is_active) throw new AppError('Institute subscription is inactive.', 403);

  req.institute = institute;
  req.school    = institute; // backward-compat alias

  // ── Branch context (optional) ────────────────────────────────────────────
  const hasBranches = institute.settings?.has_branches ?? institute.has_branches ?? false;
  if (hasBranches) {
    const headerBranchId = req.headers['x-branch-id'];
    if (headerBranchId) {
      req.branch_id = headerBranchId;
    } else if (req.user?.branch_id) {
      req.branch_id = req.user.branch_id;
    } else {
      req.branch_id = null;
    }
  } else {
    req.branch_id = null;
  }

  next();
});

export default schoolContext;

