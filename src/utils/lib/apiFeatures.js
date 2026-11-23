/**
 * The Clouds Academy - API Query Features
 * Filter, sort, paginate, search for Sequelize
 */

import { Op } from 'sequelize';

class APIFeatures {
  constructor(modelQuery, queryString) {
    this.modelQuery = modelQuery; // base where (e.g. { school_id }) OR { where: {...} }
    // SECURITY: the base where (tenant filter) is always merged last in build()
    // so user-supplied query params can never widen or override it.
    this.baseWhere = { ...((modelQuery && modelQuery.where) || (modelQuery && !modelQuery.where ? modelQuery : {})) };
    this.queryString = queryString || {};
    this.allowedSort = null;
    this.whereClause = {};
    this.orderClause = [];
    this.offsetVal = 0;
    this.limitVal = 50;
    this.pagination = {};
  }

  /**
   * Filter - only keys listed in `allowedFields` are applied (default: none).
   * Values must be primitives or { like | gte | lte } objects.
   * @param {string[]} allowedFields - whitelisted column names
   */
  filter(allowedFields = []) {
    const queryObj = {};
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(this.queryString, key)) queryObj[key] = this.queryString[key];
    }

    Object.keys(queryObj).forEach((key) => {
      const val = queryObj[key];
      if (val === null || val === undefined || val === '') return;
      if (typeof val === 'object' && !val.like && !val.gte && !val.lte) return; // ignore unknown operator objects
      if (typeof val === 'object' && val.like) {
        this.whereClause[key] = { [Op.like]: `%${val.like}%` };
      } else if (typeof val === 'object' && val.gte) {
        this.whereClause[key] = { [Op.gte]: val.gte };
      } else if (typeof val === 'object' && val.lte) {
        this.whereClause[key] = { [Op.lte]: val.lte };
      } else {
        this.whereClause[key] = val;
      }
    });

    return this;
  }

  /**
   * Restrict ?sort= to known column names
   */
  allowSort(fields = []) {
    this.allowedSort = fields;
    return this;
  }

  /**
   * Search across multiple fields
   * @param {string[]} fields - Fields to search in
   */
  search(fields = ['name']) {
    if (this.queryString.search) {
      const term = `%${String(this.queryString.search).replace(/[%_\\]/g, '\\$&')}%`;
      this.whereClause[Op.or] = fields.map((f) => ({ [f]: { [Op.iLike]: term } }));
    }
    return this;
  }

  /**
   * Sort - ?sort=name,-created_at
   */
  sort() {
    if (this.queryString.sort) {
      const parsed = String(this.queryString.sort).split(',').map((field) => {
        const desc = field.startsWith('-');
        const name = desc ? field.substring(1) : field;
        return { name, desc };
      }).filter(({ name }) => /^[a-zA-Z_]+$/.test(name) && (!this.allowedSort || this.allowedSort.includes(name)));
      this.orderClause = parsed.length
        ? parsed.map(({ name, desc }) => [name, desc ? 'DESC' : 'ASC'])
        : [['created_at', 'DESC']];
    } else {
      this.orderClause = [['created_at', 'DESC']];
    }
    return this;
  }

  /**
   * Paginate - ?page=2&limit=20
   */
  paginate() {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = Math.min(parseInt(this.queryString.limit, 10) || 20, 100);
    const offset = (page - 1) * limit;

    this.offsetVal = offset;
    this.limitVal = limit;
    this.pagination = { page, limit, offset };

    return this;
  }

  /**
   * Build final Sequelize options
   */
  build() {
    return {
      where: { ...this.whereClause, ...this.baseWhere },
      order: this.orderClause,
      offset: this.offsetVal,
      limit: this.limitVal,
    };
  }

  /**
   * Get pagination metadata
   * @param {number} total - Total records
   */
  getPaginationMeta(total) {
    const { page, limit } = this.pagination;
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}

export default APIFeatures;
