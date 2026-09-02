// src/api/middlewares/branchContext.middleware.js

/**
 * Branch Isolation Middleware
 * 
 * Implements strict horizontal multi-tenant data isolation:
 * 
 * 1. Scenario A: Branch Admin / Branch-assigned user:
 *    - Automatically locked to user's assigned branch_id from token/session.
 *    - Injects req.allowedBranchId = req.user.branch_id.
 *    - Sets req.isBranchRestricted = true.
 *    - Master Lock: Overrides any client-supplied branch_id in query, body, params, or headers.
 * 
 * 2. Scenario B: Super Admin / Institute Admin (Platform Super Admins or School Owner with no branch lock):
 *    - Global View: If no branch specified, req.allowedBranchId = null (returns all branches).
 *    - Targeted View: If branch specified via ?branch_id=..., headers['x-branch-id'], or body.branch_id,
 *      injects req.allowedBranchId = requestedBranchId.
 *    - Sets req.isBranchRestricted = false.
 */

export const branchIsolation = (req, res, next) => {
  if (!req.user) {
    return next();
  }

  const userType = req.user.user_type;
  const userBranchId = req.user.branch_id;

  // A user is branch-scoped if they are explicitly a BRANCH_ADMIN or have a branch_id assigned
  // Platform admins (MASTER_ADMIN, SYSTEM_ADMIN, SUPPORT_STAFF) and INSTITUTE_ADMIN without fixed branch are global
  const isGlobalRole = ['MASTER_ADMIN', 'SYSTEM_ADMIN', 'SUPPORT_STAFF'].includes(userType) ||
    (userType === 'INSTITUTE_ADMIN' && !userBranchId);

  const isBranchScoped = !isGlobalRole && (userType === 'BRANCH_ADMIN' || Boolean(userBranchId));

  if (isBranchScoped && userBranchId) {
    // Scenario A: Branch Admin / Branch-restricted user (The Master Lock)
    req.allowedBranchId = userBranchId;
    req.branch_id = userBranchId;
    req.isBranchRestricted = true;
    req.isSuperAdmin = false;

    // Override any attempts by the client to access/manipulate another branch
    if (req.query) {
      req.query.branch_id = userBranchId;
    }
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      req.body.branch_id = userBranchId;
    }
    if (req.headers) {
      req.headers['x-branch-id'] = userBranchId;
    }
  } else {
    // Scenario B: Super Admin / Institute Admin (Global View or Targeted View)
    const rawBranch = req.query?.branch_id || req.headers?.['x-branch-id'] || req.params?.branchId || req.body?.branch_id || null;
    
    // Normalize: check if a valid branch ID string was passed (not 'all', 'null', 'undefined', '')
    const targetBranchId = (rawBranch && typeof rawBranch === 'string' && !['all', 'null', 'undefined', ''].includes(rawBranch.trim()))
      ? rawBranch.trim()
      : null;

    req.allowedBranchId = targetBranchId;
    req.branch_id = targetBranchId;
    req.isBranchRestricted = false;
    req.isSuperAdmin = true;
  }

  next();
};

export const branchContext = branchIsolation;
export default branchIsolation;
