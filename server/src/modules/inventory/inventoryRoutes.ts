import { Router } from 'express';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  restoreProducts,
  permanentlyDeleteProducts,
  bulkUpdateProducts,
  adjustStock,
  listWarehouses,
  listStockMovements,
} from './inventoryController';
import { authenticateToken, requireRole } from '../../middlewares/auth';
import { createCategory, deleteCategory, listCategories, updateCategory } from './categoryController';
import { createAttribute, deleteAttribute, listAttributes, updateAttribute } from './attributeController';

const router = Router();

router.get('/products', authenticateToken, listProducts);
router.get('/products/:id', authenticateToken, getProductById);
router.post('/products', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), createProduct);
router.post('/products/bulk', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), bulkUpdateProducts);
router.put('/products/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), updateProduct);
router.delete('/products/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), deleteProduct);
router.post('/products/:id/restore', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), restoreProduct);
router.post('/products/bulk-restore', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), restoreProducts);
router.post('/products/permanent-delete', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), permanentlyDeleteProducts);
router.post('/stock-adjustment', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), adjustStock);
router.get('/stock-movements', authenticateToken, listStockMovements);
router.get('/warehouses', authenticateToken, listWarehouses);
router.get('/categories', authenticateToken, listCategories);
router.post('/categories', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), createCategory);
router.put('/categories/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), updateCategory);
router.delete('/categories/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), deleteCategory);
router.get('/attributes', authenticateToken, listAttributes);
router.post('/attributes', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), createAttribute);
router.put('/attributes/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), updateAttribute);
router.delete('/attributes/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), deleteAttribute);

export default router;
