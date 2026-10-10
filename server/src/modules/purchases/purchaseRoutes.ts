import { Router } from 'express';
import {
  listSuppliers,
  createSupplier,
  listPurchases,
  createPurchaseOrder,
  getPurchaseById,
} from './purchaseController';
import { authenticateToken, requireRole } from '../../middlewares/auth';

const router = Router();

router.get('/suppliers', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER', 'ACCOUNTANT']), listSuppliers);
router.post('/suppliers', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER', 'ACCOUNTANT']), createSupplier);
router.get('/orders', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER', 'ACCOUNTANT']), listPurchases);
router.post('/orders', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER', 'ACCOUNTANT']), createPurchaseOrder);
router.get('/orders/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER', 'ACCOUNTANT']), getPurchaseById);

export default router;
