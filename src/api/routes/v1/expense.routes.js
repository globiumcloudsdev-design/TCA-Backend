// src/routes/v1/expense.routes.js
import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import * as expenseController from '../../controllers/expense.controller.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
} from '../../validators/expense.validator.js';

const router = Router();

router.use(protect);

// Stats route (before /:id to avoid conflict)
router.get('/stats', hasPermission('expense.read'), expenseController.getExpenseStats);

// Categories route (for creatable select dropdown)
router.get('/categories', hasPermission('expense.read'), expenseController.getExpenseCategories);

router.route('/')
  .get(hasPermission('expense.read'), expenseController.getAllExpenses)
  .post(hasPermission('expense.create'), validate(createExpenseSchema), expenseController.createExpense);

router.route('/:id')
  .get(hasPermission('expense.read'), expenseController.getExpenseById)
  .put(hasPermission('expense.update'), validate(updateExpenseSchema), expenseController.updateExpense)
  .delete(hasPermission('expense.delete'), expenseController.deleteExpense);

export default router;