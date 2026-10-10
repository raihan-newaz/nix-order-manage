import { Router } from 'express';
import {
  listOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  bulkUpdateStatus,
  trashOrders,
  restoreOrders,
  permanentlyDeleteOrders,
  updateOrderAssignment,
  updateOrderPriority,
  bulkAssignOrders,
  bulkSetPriority,
} from './orderController';
import { authenticateToken, requireRole } from '../../middlewares/auth';

const router = Router();

router.get('/', authenticateToken, listOrders);
router.get('/:id', authenticateToken, getOrderById);
router.post('/', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT']), createOrder);
router.patch('/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT']), updateOrder);
router.patch('/:id/assignment', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT']), updateOrderAssignment);
router.patch('/:id/priority', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT']), updateOrderPriority);
router.patch('/:id/status', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT', 'DISPATCHER']), updateOrderStatus);
router.post('/bulk-status', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), bulkUpdateStatus);
router.post('/bulk-assign', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT']), bulkAssignOrders);
router.post('/bulk-priority', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT']), bulkSetPriority);
router.post('/trash', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), trashOrders);
router.post('/restore', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), restoreOrders);
router.post('/permanently-delete', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), permanentlyDeleteOrders);

export default router;
