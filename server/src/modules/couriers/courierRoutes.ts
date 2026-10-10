import { Router } from 'express';
import {
  dispatchSingleOrder,
  dispatchBulkOrders,
  getCourierConfigs,
  revealCourierConfigSecret,
  updateCourierConfig,
  getPathaoLocations,
  getPathaoStores,
  createPathaoStore,
  getPathaoPrice,
  refreshPathaoTracking,
  getPathaoEvents,
  resolvePathaoBooking,
  getReconciliationSummary,
} from './courierController';
import { authenticateToken, requireRole } from '../../middlewares/auth';
import { pathaoWebhook, pathaoWebhookChallenge } from './pathaoWebhook';
import { steadfastWebhook } from './steadfastWebhook';
import { redxWebhook } from './redxWebhook';
import { redxTest, redxStores, redxStore, redxCreateStore, redxCharge, redxParcel, redxRefresh, redxUpdateParcel, redxResolveBooking, redxEvents } from './redxController';
import { listCourierLocations, refreshCourierLocations } from './courierLocations';
import {
  steadfastPing, steadfastTest, steadfastBalance, steadfastPayments, steadfastPayment,
  steadfastPoliceStations, steadfastFraudScore, steadfastStatusLookup,
  steadfastReturnRequests, steadfastReturnRequest, steadfastCreatePickup,
  steadfastCreateReturn, steadfastOrderTracking, steadfastRefreshOrder,
  steadfastEvents, steadfastRequests, steadfastResolveBooking,
} from './steadfastController';

const router = Router();

router.get('/pathao/webhook', pathaoWebhookChallenge);
router.post('/pathao/webhook', pathaoWebhook);
router.post('/steadfast/webhook', steadfastWebhook);
router.post('/redx/webhook', redxWebhook);
router.get('/steadfast/ping', authenticateToken, steadfastPing);
router.get('/steadfast/test', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), steadfastTest);
router.get('/steadfast/balance', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTANT']), steadfastBalance);
router.get('/steadfast/payments', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTANT']), steadfastPayments);
router.get('/steadfast/payments/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTANT']), steadfastPayment);
router.get('/steadfast/police-stations', authenticateToken, steadfastPoliceStations);
router.get('/steadfast/fraud-score/:phone', authenticateToken, steadfastFraudScore);
router.get('/steadfast/status/:kind/:identifier', authenticateToken, steadfastStatusLookup);
router.get('/steadfast/returns', authenticateToken, steadfastReturnRequests);
router.get('/steadfast/returns/:id', authenticateToken, steadfastReturnRequest);
router.post('/steadfast/pickups', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER']), steadfastCreatePickup);
router.post('/steadfast/orders/:orderId/returns', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER']), steadfastCreateReturn);
router.get('/steadfast/orders/:orderId/trackings', authenticateToken, steadfastOrderTracking);
router.post('/steadfast/orders/:orderId/refresh', authenticateToken, steadfastRefreshOrder);
router.post('/steadfast/orders/:orderId/resolve', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), steadfastResolveBooking);
router.get('/steadfast/events', authenticateToken, steadfastEvents);
router.get('/steadfast/requests', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER']), steadfastRequests);
router.get('/redx/test', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), redxTest);
router.get('/redx/stores', authenticateToken, redxStores);
router.get('/redx/stores/:id', authenticateToken, redxStore);
router.post('/redx/stores', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), redxCreateStore);
router.post('/redx/charge', authenticateToken, redxCharge);
router.get('/redx/orders/:orderId', authenticateToken, redxParcel);
router.post('/redx/orders/:orderId/refresh', authenticateToken, redxRefresh);
router.patch('/redx/orders/:orderId', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER']), redxUpdateParcel);
router.post('/redx/orders/:orderId/resolve', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), redxResolveBooking);
router.get('/redx/events', authenticateToken, redxEvents);
router.get('/locations/:provider', authenticateToken, listCourierLocations);
router.post('/locations/:provider/refresh', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), refreshCourierLocations);

router.post('/dispatch', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER']), dispatchSingleOrder);
router.post('/dispatch-bulk', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER']), dispatchBulkOrders);
router.get('/configs', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), getCourierConfigs);
router.post('/configs/:provider/reveal/:field', authenticateToken, requireRole(['SUPER_ADMIN']), revealCourierConfigSecret);
router.put('/configs/:provider', authenticateToken, requireRole(['SUPER_ADMIN']), updateCourierConfig);
router.get('/pathao/locations', authenticateToken, getPathaoLocations);
router.get('/pathao/stores', authenticateToken, getPathaoStores);
router.post('/pathao/stores', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), createPathaoStore);
router.post('/pathao/price', authenticateToken, getPathaoPrice);
router.post('/pathao/orders/:orderId/refresh', authenticateToken, refreshPathaoTracking);
router.post('/pathao/orders/:orderId/resolve', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), resolvePathaoBooking);
router.get('/pathao/events', authenticateToken, getPathaoEvents);
router.get('/reconciliation', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTANT']), getReconciliationSummary);

export default router;
