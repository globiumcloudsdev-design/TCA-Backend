// src/routes/v1/expense.routes.js
import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import * as expenseController from '../../controllers/expense.controller.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
} from '../../validators/expense.validator.js';

const router = Router();

router.use(protect);

// Stats route (before /:id to avoid conflict)
router.get('/stats', expenseController.getExpenseStats);

// Categories route (for creatable select dropdown)
router.get('/categories', expenseController.getExpenseCategories);

router.route('/')
  .get(expenseController.getAllExpenses)
  .post(validate(createExpenseSchema), expenseController.createExpense);

router.route('/:id')
  .get(expenseController.getExpenseById)
  .put(validate(updateExpenseSchema), expenseController.updateExpense)
  .delete(expenseController.deleteExpense);

export default router;