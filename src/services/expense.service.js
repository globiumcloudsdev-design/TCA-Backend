// src/services/expense.service.js
import models from '../models/postgres/index.js';
import { Op } from 'sequelize';
import { generateExpenseNumber, generateReceiptUrl } from '../utils/expenseNumberGenerator.js';

const { Expense, Vendor, ExpenseCategory, User, sequelize } = models;

/**
 * Create expense with auto-generated number and receipt URL
 */
export const createExpense = async (data, options = {}) => {
  const { transaction } = options;
  
  // Clean vendor_id - remove if it's not a valid UUID (should have been handled in validator but double check)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (data.vendor_id && !uuidPattern.test(data.vendor_id)) {
    // If vendor_id is not a UUID, move it to vendor_name and clear vendor_id
    if (!data.vendor_name) {
      data.vendor_name = data.vendor_id;
    }
    data.vendor_id = null;
  }
  
  // Generate expense number (EXP-YYYY-00001-XXXX format)
  const expenseDate = new Date(data.date);
  const year = expenseDate.getFullYear();
  const count = await Expense.count({ transaction });
  const uniqueSuffix = Date.now().toString().slice(-5);
  const expenseNumber = `EXP-${year}-${String(count + 1).padStart(5, '0')}-${uniqueSuffix}`;
  
  // Prepare data for creation
  const expenseData = {
    ...data,
    expense_number: expenseNumber,
  };
  
  const expense = await Expense.create(expenseData, { transaction });
  
  // Generate receipt URL with expense ID
  const receiptUrl = generateReceiptUrl(expense.id);
  await expense.update({ receipt_url: receiptUrl }, { transaction });
  
  // Fetch with associations
  return await Expense.findByPk(expense.id, {
    include: [
      { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'type', 'phone'] },
      { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] },
    ],
    transaction,
  });
};

/**
 * Get all expenses with filters
 */
export const getAllExpenses = async (filters = {}, pagination = {}) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'date', 
    sortOrder = 'DESC' 
  } = pagination;
  const offset = (page - 1) * limit;

  const where = { institute_id: filters.institute_id };
  
  if (filters.branch_id) where.branch_id = filters.branch_id;
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  if (filters.vendor_id) where.vendor_id = filters.vendor_id;
  
  if (filters.search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${filters.search}%` } },
      { vendor_name: { [Op.iLike]: `%${filters.search}%` } },
      { description: { [Op.iLike]: `%${filters.search}%` } },
    ];
  }
  
  if (filters.start_date && filters.end_date) {
    where.date = {
      [Op.between]: [filters.start_date, filters.end_date]
    };
  } else if (filters.start_date) {
    where.date = { [Op.gte]: filters.start_date };
  } else if (filters.end_date) {
    where.date = { [Op.lte]: filters.end_date };
  }

  const { count, rows } = await Expense.findAndCountAll({
    where,
    include: [
      { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'type', 'phone'] },
      { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] },
      { model: User, as: 'approver', attributes: ['id', 'first_name', 'last_name'] },
      { model: User, as: 'payer', attributes: ['id', 'first_name', 'last_name'] },
    ],
    order: [[sortBy, sortOrder]],
    limit,
    offset,
  });

  return {
    data: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    }
  };
};

/**
 * Get expense by ID
 */
export const getExpenseById = async (id, instituteId, branchId = null) => {
  const where = { id, institute_id: instituteId };
  if (branchId) where.branch_id = branchId;
  
  const expense = await Expense.findOne({
    where,
    include: [
      { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'type', 'phone', 'email', 'address', 'assigned_student_ids'] },
      { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'email'] },
      { model: User, as: 'approver', attributes: ['id', 'first_name', 'last_name'] },
      { model: User, as: 'payer', attributes: ['id', 'first_name', 'last_name'] },
    ],
  });
  return expense;
};

/**
 * Update expense
 */
export const updateExpense = async (id, instituteId, updateData, options = {}) => {
  const { transaction } = options;
  
  const expense = await Expense.findOne({
    where: { id, institute_id: instituteId }
  });
  
  if (!expense) {
    throw new Error('Expense not found');
  }
  
  // If status is being changed to approved
  if (updateData.status === 'approved' && expense.status !== 'approved') {
    updateData.approved_by = updateData.updated_by;
    updateData.approved_at = new Date();
  }
  
  // If status is being changed to paid
  if (updateData.status === 'paid' && expense.status !== 'paid') {
    updateData.paid_by = updateData.updated_by;
    updateData.paid_at = new Date();
  }
  
  await expense.update(updateData, { transaction });
  
  return await Expense.findByPk(expense.id, {
    include: [
      { model: Vendor, as: 'vendor', attributes: ['id', 'name'] },
    ],
    transaction,
  });
};

/**
 * Delete expense
 */
export const deleteExpense = async (id, instituteId, options = {}) => {
  const { transaction } = options;
  
  const expense = await Expense.findOne({
    where: { id, institute_id: instituteId }
  });
  
  if (!expense) {
    throw new Error('Expense not found');
  }
  
  await expense.destroy({ transaction });
  return { message: 'Expense deleted successfully' };
};

/**
 * Get expense statistics
 */
export const getExpenseStats = async (instituteId, branchId = null, year = null) => {
  const where = { institute_id: instituteId };
  if (branchId) where.branch_id = branchId;
  
  const currentYear = year || new Date().getFullYear();
  where.date = {
    [Op.between]: [`${currentYear}-01-01`, `${currentYear}-12-31`]
  };
  
  // Total by status
  const statusStats = await Expense.findAll({
    where,
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
    ],
    group: ['status']
  });
  
  // Total by category
  const categoryStats = await Expense.findAll({
    where,
    attributes: [
      'category',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
    ],
    group: ['category'],
    order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']],
    limit: 10
  });
  
  // Monthly totals
  const monthlyStats = await Expense.findAll({
    where,
    attributes: [
      [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('date')), 'month'],
      [sequelize.fn('SUM', sequelize.col('amount')), 'total']
    ],
    group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('date'))],
    order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('date')), 'ASC']]
  });
  
  return {
    status_stats: statusStats,
    category_stats: categoryStats,
    monthly_stats: monthlyStats,
    total_expenses: await Expense.sum('amount', { where }),
    total_count: await Expense.count({ where })
  };
};