import { Router } from 'express';
import { getDashboardSummary, getActionCenterSummary } from './dashboardController';
import { authenticateToken } from '../../middlewares/auth';

const router = Router();

router.get('/summary', authenticateToken, getDashboardSummary);
router.get('/action-center', authenticateToken, getActionCenterSummary);

export default router;
