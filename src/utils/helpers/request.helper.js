/**
 * The Clouds Academy - Request Helper
 * Common helpers to extract institute/branch IDs from authenticated requests
 */

/**
 * Get institute ID from request (supports multiple field names)
 * @param {Object} req - Express request object
 * @returns {String|null} institute_id or school_id or null
 */
export const getInstituteId = (req) => {
  return req.user?.institute_id || req.user?.school_id || req.user?.schoolId || null;
};

/**
 * Get branch ID from request context (enforces security middleware isolation)
 * @param {Object} req - Express request object
 * @returns {String|null} allowed branch_id or null
 */
export const getBranchId = (req) => {
  if (!req) return null;
  if (req.allowedBranchId !== undefined) {
    return req.allowedBranchId;
  }
  // If user is locked to a branch (Branch Admin), always return their branch
  if (req.user?.user_type === 'BRANCH_ADMIN' || req.user?.branch_id) {
    return req.user.branch_id;
  }
  // Super Admin view
  return req.query?.branch_id || req.headers?.['x-branch-id'] || req.body?.branch_id || null;
};

/**
 * Helper to build branch filter object for Sequelize queries
 * @param {Object} req - Express request object
 * @param {String} fieldName - DB column name (defaults to 'branch_id')
 * @returns {Object} { [fieldName]: branchId } or {}
 */
export const getBranchFilter = (req, fieldName = 'branch_id') => {
  const branchId = getBranchId(req);
  if (branchId && branchId !== 'all' && branchId !== 'null' && branchId !== 'undefined') {
    return { [fieldName]: branchId };
  }
  return {};
};

/**
 * Check if request is restricted to a single branch
 * @param {Object} req - Express request object
 * @returns {Boolean}
 */
export const isBranchRestricted = (req) => {
  if (req?.isBranchRestricted !== undefined) return Boolean(req.isBranchRestricted);
  return Boolean(req?.user?.user_type === 'BRANCH_ADMIN' || req?.user?.branch_id);
};

/**
 * Get user ID from request
 * @param {Object} req - Express request object
 * @returns {String|null} user id or null
 */
export const getUserId = (req) => {
  return req.user?.id || req.user?.user_id || null;
};

/**
 * Get user type from request
 * @param {Object} req - Express request object
 * @returns {String|null} user_type or null
 */
export const getUserType = (req) => {
  return req.user?.user_type || req.user?.role || null;
};

/**
 * Build common filters from request query
 * @param {Object} req - Express request object
 * @param {Array} allowedFields - List of allowed filter fields
 * @returns {Object} filters object
 */
export const buildFilters = (req, allowedFields = []) => {
  const filters = {};
  allowedFields.forEach((field) => {
    if (req.query[field] !== undefined && req.query[field] !== '') {
      filters[field] = req.query[field];
    }
  });
  return filters;
};

/**
 * Build pagination from request query
 * @param {Object} req - Express request object
 * @param {Number} defaultLimit
 * @returns {Object} { page, limit }
 */
export const buildPagination = (req, defaultLimit = 20) => {
  return {
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || defaultLimit,
  };
};

export default {
  getInstituteId,
  getBranchId,
  getBranchFilter,
  isBranchRestricted,
  getUserId,
  getUserType,
  buildFilters,
  buildPagination,
};

