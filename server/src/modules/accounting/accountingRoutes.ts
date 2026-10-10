import { Router } from 'express';
import {
  listAccounts,
  createAccount,
  transferFunds,
  listExpenseCategories,
  listExpenses,
  createExpense,
  listAdCosts,
  createAdCost,
  getProfitLossStatement,
  createExpenseCategory,
  voidExpense,
} from './accountingController';
import { getFinanceOverview } from './financeOverviewController';
import { authenticateToken, requireRole } from '../../middlewares/auth';

const router = Router();

router.get('/accounts', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTANT']), listAccounts);
router.post('/accounts', authenticateToken, requireRole(['SUPER_ADMIN', 'ACCOUNTANT']), createAccount);
router.post('/transfer', authenticateToken, requireRole(['SUPER_ADMIN', 'ACCOUNTANT']), transferFunds);

router.get('/expense-categories', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTANT']), listExpenseCategories);
router.post('/expense-categories', authenticateToken, requireRole(['SUPER_ADMIN', 'ACCOUNTANT']), createExpenseCategory);
router.get('/expenses', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTANT']), listExpenses);
router.post('/expenses', authenticateToken, requireRole(['SUPER_ADMIN', 'ACCOUNTANT']), createExpense);
router.post('/expenses/:id/void', authenticateToken, requireRole(['SUPER_ADMIN', 'ACCOUNTANT']), voidExpense);

router.get('/ad-costs', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTANT']), listAdCosts);
router.post('/ad-costs', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTANT']), createAdCost);

router.get('/profit-loss', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTANT']), getProfitLossStatement);
router.get('/overview', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTANT']), getFinanceOverview);

export default router;
