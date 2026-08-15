import { Router } from 'express';
import {
  getExpenseTemplates,
  createExpenseTemplate,
  updateExpenseTemplate,
  deleteExpenseTemplate,
  getMonthExpenses,
  createMonthlyExpense,
  updateMonthlyExpense,
  deleteMonthlyExpense
} from '../controllers/expensesController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Templates
router.get('/templates', requireAuth, getExpenseTemplates);
router.post('/templates', requireAuth, createExpenseTemplate);
router.put('/templates/:id', requireAuth, updateExpenseTemplate);
router.delete('/templates/:id', requireAuth, deleteExpenseTemplate);

// Monthly Expenses
router.get('/month/:month', requireAuth, getMonthExpenses);
router.post('/month', requireAuth, createMonthlyExpense);
router.put('/record/:id', requireAuth, updateMonthlyExpense);
router.delete('/record/:id', requireAuth, deleteMonthlyExpense);

export default router;
