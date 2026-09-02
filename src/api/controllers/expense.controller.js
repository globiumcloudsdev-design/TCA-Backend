import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound,
} from '../../utils/helpers/response.helper.js';
import * as expenseService from '../../services/expense.service.js';
import * as expenseCategoryService from '../../services/expenseCategory.service.js';
import models from '../../models/postgres/index.js';
import { getInstituteId, getBranchId } from '../../utils/helpers/request.helper.js';

const { sequelize } = models;

/**
 * Create expense
 */
export const createExpense = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const branchId = getBranchId(req);
    
    // Handle category: if new category, create it
    const { category, vendor_id, vendor_name, ...rest } = req.body;
    
    let finalCategory = category;
    if (category && !category.startsWith('existing_')) {
      // Check if category exists, if not create it
      const existingCategories = await expenseCategoryService.getExpenseCategories(instituteId, true, category);
      const exactMatch = existingCategories.find(c => c.value.toLowerCase() === category.toLowerCase());
      
      if (!exactMatch) {
        await expenseCategoryService.getOrCreateCategory(
          instituteId, 
          category, 
          req.user.id, 
          transaction
        );
      }
      finalCategory = category;
    }
    
    const expenseData = {
      ...rest,
      institute_id: instituteId,
      branch_id: branchId,
      category: finalCategory,
      vendor_id: vendor_id || null,
      vendor_name: !vendor_id ? vendor_name : null,
      created_by: req.user.id,
    };
    
    const expense = await expenseService.createExpense(expenseData, { transaction });
    await transaction.commit();
    return sendCreated(res, expense, 'Expense created successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Create expense error:', error);
    return sendError(res, error.message || 'Failed to create expense', 500);
  }
};

/**
 * Get all expenses
 */
export const getAllExpenses = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }

    const branchId = getBranchId(req);
    
    const filters = {
      institute_id: instituteId,
      branch_id: branchId,
      category: req.query.category,
      status: req.query.status,
      vendor_id: req.query.vendor_id,
      search: req.query.search,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
    };
    
    const pagination = {
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      sortBy: req.query.sortBy || 'date',
      sortOrder: req.query.sortOrder || 'DESC',
    };
    
    const result = await expenseService.getAllExpenses(filters, pagination);
    return sendPaginated(res, result.data, result.pagination, 'Expenses fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch expenses');
  }
};

/**
 * Get expense by ID
 */
export const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    const branchId = getBranchId(req);
    
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const expense = await expenseService.getExpenseById(id, instituteId, branchId);
    if (!expense) {
      return sendNotFound(res, 'Expense not found');
    }
    return sendSuccess(res, expense, 'Expense fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch expense');
  }
};

/**
 * Update expense
 */
export const updateExpense = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const updateData = {
      ...req.body,
      updated_by: req.user.id,
    };
    
    const expense = await expenseService.updateExpense(id, instituteId, updateData, { transaction });
    await transaction.commit();
    return sendSuccess(res, expense, 'Expense updated successfully');
  } catch (error) {
    await transaction.rollback();
    if (error.message === 'Expense not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to update expense');
  }
};

/**
 * Delete expense
 */
export const deleteExpense = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);
    
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const result = await expenseService.deleteExpense(id, instituteId, { transaction });
    await transaction.commit();
    return sendSuccess(res, null, result.message);
  } catch (error) {
    await transaction.rollback();
    if (error.message === 'Expense not found') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Failed to delete expense');
  }
};

/**
 * Get expense statistics
 */
export const getExpenseStats = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const branchId = getBranchId(req);
    const year = req.query.year;
    
    const stats = await expenseService.getExpenseStats(instituteId, branchId, year);
    return sendSuccess(res, stats, 'Expense stats fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch expense stats');
  }
};

/**
 * Get expense categories (for dropdown)
 */
export const getExpenseCategories = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID not found', 400);
    }
    
    const onlyActive = req.query.onlyActive !== 'false';
    const search = req.query.search || '';
    
    const categories = await expenseCategoryService.getExpenseCategories(instituteId, onlyActive, search);
    return sendSuccess(res, categories, 'Expense categories fetched successfully');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch expense categories');
  }
};