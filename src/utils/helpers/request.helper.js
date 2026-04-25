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
 * Get branch ID from request (supports user token, query params, and body)
 * @param {Object} req - Express request object
 * @returns {String|null} branch_id or null
 */
export const getBranchId = (req) => {
  return req.user?.branch_id || req.query?.branch_id || req.body?.branch_id || null;
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
  getUserId,
  getUserType,
  buildFilters,
  buildPagination,
};

