// src/services/expenseCategory.service.js
import models from '../models/postgres/index.js';
import { Op } from 'sequelize';

const { ExpenseCategory, sequelize } = models;

/**
 * Create expense category
 */
export const createExpenseCategory = async (data, options = {}) => {
  const { transaction } = options;
  
  const category = await ExpenseCategory.create(data, { transaction });
  return category;
};

/**
 * Get all expense categories for dropdown/creatable select
 */
export const getExpenseCategories = async (instituteId, onlyActive = true, search = '') => {
  const where = { institute_id: instituteId };
  if (onlyActive) where.is_active = true;
  if (search) {
    where.name = { [Op.iLike]: `%${search}%` };
  }
  
  const categories = await ExpenseCategory.findAll({
    where,
    attributes: ['id', 'name', 'code', 'parent_category', 'budget_limit', 'is_active'],
    order: [['name', 'ASC']],
  });
  
  // Format for CreatableSelectField: { value: name, label: name }
  // Using name as value for easy creatable integration
  const options = categories.map(cat => ({
    value: cat.name,
    label: cat.name,
    id: cat.id,
    budget_limit: cat.budget_limit
  }));
  
  return options;
};

/**
 * Get or create category (for creatable select)
 */
export const getOrCreateCategory = async (instituteId, categoryName, createdBy, transaction) => {
  let category = await ExpenseCategory.findOne({
    where: {
      institute_id: instituteId,
      name: { [Op.iLike]: categoryName }
    }
  });
  
  if (!category) {
    category = await ExpenseCategory.create({
      institute_id: instituteId,
      name: categoryName,
      created_by: createdBy
    }, { transaction });
  }
  
  return category;
};

/**
 * Delete expense category
 */
export const deleteExpenseCategory = async (id, instituteId) => {
  const category = await ExpenseCategory.findOne({
    where: { id, institute_id: instituteId }
  });
  
  if (!category) {
    throw new Error('Category not found');
  }
  
  await category.destroy();
  return { message: 'Category deleted successfully' };
};