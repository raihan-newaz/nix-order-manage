import { Router } from 'express';
import {
  listCustomers,
  getCustomerProfile,
  updateCustomer,
} from './crmController';
import { authenticateToken, requireRole } from '../../middlewares/auth';

const router = Router();

router.get('/', authenticateToken, listCustomers);
router.get('/:id', authenticateToken, getCustomerProfile);
router.put('/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT']), updateCustomer);

export default router;
