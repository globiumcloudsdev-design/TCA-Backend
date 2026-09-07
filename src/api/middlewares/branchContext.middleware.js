// src/api/middlewares/branchContext.middleware.js

export const branchIsolation = (req, res, next) => {
  if (!req.user) {
    if (typeof next === 'function') next();
    return;
  }

  const userType = String(req.user.user_type || '').toUpperCase();
  const userBranchId = req.user.branch_id;

  // Check if assigned branch is the Main Branch
  const isMainBranch = req.user.branch?.is_main === true ||
    String(req.user.branch?.code || '').toUpperCase().endsWith('-MAIN') ||
    String(req.user.branch?.name || '').toLowerCase().includes('main');

  // Explicit branch admin / branch restricted role check
  const isExplicitBranchAdmin = [
    'BRANCH_ADMIN',
    'CAMPUS_ADMIN',
    'BRANCH ADMIN',
    'CAMPUS ADMIN',
    'BRANCH_STAFF',
    'STAFF',
    'TEACHER',
    'STUDENT',
    'PARENT'
  ].includes(userType) ||
    req.user.staff_type === 'Branch Head' ||
    req.user.role_code === 'BRANCH_ADMIN';

  // Platform and Institute Admins (Super Admins) have global multi-branch view capabilities
  const isGlobalSuperAdmin = !isExplicitBranchAdmin && (
    [
      'MASTER_ADMIN',
      'SYSTEM_ADMIN',
      'SUPPORT_STAFF',
      'INSTITUTE_ADMIN',
      'SUPER_ADMIN',
      'SUPER ADMIN'
    ].includes(userType) || isMainBranch
  );

  // Branch-scoped: non-global user who is a Branch Admin or restricted to an assigned branch
  const isBranchScoped = !isGlobalSuperAdmin && (
    isExplicitBranchAdmin ||
    Boolean(userBranchId)
  );

  if (isBranchScoped && userBranchId) {
    // Scenario A: Branch Admin / Branch-restricted user (The Master Lock)
    req.allowedBranchId = userBranchId;
    req.branch_id = userBranchId;
    req.isBranchRestricted = true;
    req.isSuperAdmin = false;

    // Hard override any attempts by client to access/manipulate another branch
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
    // Scenario B: Super Admin / Main Branch Admin (Global View or Targeted View)
    const rawBranch = req.query?.branch_id || req.headers?.['x-branch-id'] || req.params?.branchId || req.body?.branch_id || null;
    
    // Normalize: check if a valid branch ID string was passed (not 'all', 'null', 'undefined', '')
    const targetBranchId = (rawBranch && typeof rawBranch === 'string' && !['all', 'null', 'undefined', ''].includes(rawBranch.trim()))
      ? rawBranch.trim()
      : null;

    req.allowedBranchId = targetBranchId;
    req.branch_id = targetBranchId;
    req.isBranchRestricted = false;
    req.isSuperAdmin = true;

    // Clean up req.query.branch_id if client explicitly passed 'all' or 'null'
    if (req.query && (req.query.branch_id === 'all' || req.query.branch_id === 'null')) {
      delete req.query.branch_id;
    }
  }

  if (typeof next === 'function') {
    next();
  }
};

export const branchContext = branchIsolation;
export default branchIsolation;
