/**
 * The Clouds Academy - API Query Features
 * Filter, sort, paginate, search for Sequelize
 */

import { Op } from 'sequelize';

class APIFeatures {
  constructor(modelQuery, queryString) {
    this.modelQuery = modelQuery; // Sequelize findAll options object
    this.queryString = queryString;
    this.whereClause = {};
    this.orderClause = [];
    this.offsetVal = 0;
    this.limitVal = 50;
    this.pagination = {};
  }

  /**
   * Filter - exclude reserved params
   */
  filter() {
    const excludedFields = ['page', 'limit', 'sort', 'fields', 'search'];
    const queryObj = { ...this.queryString };
    excludedFields.forEach((f) => delete queryObj[f]);

    Object.keys(queryObj).forEach((key) => {
      const val = queryObj[key];
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
   * Search across multiple fields
   * @param {string[]} fields - Fields to search in
   */
  search(fields = ['name']) {
    if (this.queryString.search) {
      const term = `%${this.queryString.search}%`;
      this.whereClause[Op.or] = fields.map((f) => ({ [f]: { [Op.iLike]: term } }));
    }
    return this;
  }

  /**
   * Sort - ?sort=name,-created_at
   */
  sort() {
    if (this.queryString.sort) {
      this.orderClause = this.queryString.sort.split(',').map((field) => {
        if (field.startsWith('-')) return [field.substring(1), 'DESC'];
        return [field, 'ASC'];
      });
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
      where: this.whereClause,
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
