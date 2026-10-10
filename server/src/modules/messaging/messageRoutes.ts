import { Router } from 'express';
import {
  getGatewayConfigs,
  revealGatewayToken,
  updateGatewayConfig,
  listTemplates,
  updateTemplate,
  sendDirectMessage,
  listMessageLogs,
  getGreenSmsStats,
} from './messageController';
import { authenticateToken, requireRole } from '../../middlewares/auth';

const router = Router();

router.get('/configs', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), getGatewayConfigs);
router.get('/greensms/stats', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTANT']), getGreenSmsStats);
router.post('/configs/:type/reveal', authenticateToken, requireRole(['SUPER_ADMIN']), revealGatewayToken);
router.put('/configs/:type', authenticateToken, requireRole(['SUPER_ADMIN']), updateGatewayConfig);
router.get('/templates', authenticateToken, listTemplates);
router.put('/templates/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), updateTemplate);
router.post('/send', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT']), sendDirectMessage);
router.get('/logs', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT']), listMessageLogs);

export default router;
