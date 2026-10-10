import { Router } from 'express';
import {
  handleWooWebhook,
  syncOrdersFromWoo,
  syncProductsFromWoo,
  testWooConnection,
  getStoreConfig,
  saveStoreConfig,
} from './wooController';
import { authenticateToken, requireRole } from '../../middlewares/auth';

const router = Router();

// Inbound webhook from WooCommerce WordPress store
router.post('/webhook', handleWooWebhook);
router.post('/webhook/:storeId', handleWooWebhook);

// REST API Sync Actions
router.post('/sync-orders', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), syncOrdersFromWoo);
router.post('/sync-products', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER']), syncProductsFromWoo);
router.post('/test-connection', authenticateToken, requireRole(['SUPER_ADMIN']), testWooConnection);

// Store Configuration
router.get('/config', authenticateToken, requireRole(['SUPER_ADMIN']), getStoreConfig);
router.post('/config', authenticateToken, requireRole(['SUPER_ADMIN']), saveStoreConfig);

export default router;
