import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { createStorefrontOrder, getStorefrontProduct, listStorefrontProducts, trackStorefrontOrder } from './storefrontController';
import { getStorefrontSettings, updateStorefrontSettings } from './storefrontAdminController';
import { createPage, deletePage, getAdminPage, getPublicPage, listAdminPages, restorePage, setPageActive, trashPage, updatePage } from './storePageController';
import { authenticateToken, requireRole } from '../../middlewares/auth';
import { addWishlist, authenticateCustomer, optionalCustomer, changeCustomerPassword, getCustomerAccount, getCustomerOrder, listCustomerOrders, listWishlist, removeWishlist, signinCustomer, signoutCustomer, signupCustomer, updateCustomerProfile } from './customerAccountController';
import { getPaymentConfig, savePaymentConfig, paymentReturn, paymentWebhook, paymentResult } from './uddoktaPayment';
import { createLandingCoupon, deleteLandingCoupon, listLandingCoupons, quoteLandingCoupon, updateLandingCoupon } from './landingCouponController';
import { getTrackingConfig, updateTrackingConfig, testMetaCapi, relayMetaTrackingEvent } from './trackingAdminController';

const router = Router();
router.use('/account', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve(handler(req, res)).catch(next); };

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many checkout attempts. Please wait a few minutes.' },
});
const couponLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many coupon attempts. Please try again later.' } });
const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many tracking attempts. Please wait a few minutes.' },
});
const eventRelayLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1200, standardHeaders: true, legacyHeaders: false, message: { success: false } });
const accountLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many account attempts. Please wait a few minutes.' } });

router.get('/products', listStorefrontProducts);
router.get('/products/:id', getStorefrontProduct);
router.get('/settings', getStorefrontSettings);
router.post('/tracking/events', eventRelayLimiter, asyncRoute(relayMetaTrackingEvent));
router.get('/pages/:slug', getPublicPage);
router.get('/orders/:orderNumber', trackingLimiter, trackStorefrontOrder);
router.post('/orders', checkoutLimiter, optionalCustomer, createStorefrontOrder);
router.post('/coupons/quote', couponLimiter, asyncRoute(quoteLandingCoupon));
router.get('/payment/return/:attemptId/:token', paymentReturn);
router.post('/payment/webhook', paymentWebhook);
router.get('/payment/result/:attemptId', trackingLimiter, paymentResult);
router.get('/payment/config', authenticateToken, requireRole(['SUPER_ADMIN']), getPaymentConfig);
router.put('/payment/config', authenticateToken, requireRole(['SUPER_ADMIN']), savePaymentConfig);
router.post('/account/signup', accountLimiter, signupCustomer);
router.post('/account/signin', accountLimiter, signinCustomer);
router.post('/account/signout', signoutCustomer);
router.get('/account/me', optionalCustomer, asyncRoute(getCustomerAccount));
router.patch('/account/profile', authenticateCustomer, updateCustomerProfile);
router.post('/account/password', accountLimiter, authenticateCustomer, asyncRoute(changeCustomerPassword));
router.get('/account/orders', authenticateCustomer, asyncRoute(listCustomerOrders));
router.get('/account/orders/:id', authenticateCustomer, asyncRoute(getCustomerOrder));
router.get('/account/wishlist', authenticateCustomer, asyncRoute(listWishlist));
router.post('/account/wishlist/:productId', authenticateCustomer, asyncRoute(addWishlist));
router.delete('/account/wishlist/:productId', authenticateCustomer, asyncRoute(removeWishlist));
router.put('/settings', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), updateStorefrontSettings);
router.get('/manage/pages', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), listAdminPages);
router.get('/manage/pages/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), getAdminPage);
router.get('/manage/pages/:id/coupons', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), asyncRoute(listLandingCoupons));
router.post('/manage/pages/:id/coupons', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), asyncRoute(createLandingCoupon));
router.put('/manage/pages/:id/coupons/:couponId', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), asyncRoute(updateLandingCoupon));
router.delete('/manage/pages/:id/coupons/:couponId', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), asyncRoute(deleteLandingCoupon));
router.post('/manage/pages', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), createPage);
router.put('/manage/pages/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), updatePage);
router.patch('/manage/pages/:id/active', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), setPageActive);
router.delete('/manage/pages/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), trashPage);
router.post('/manage/pages/:id/restore', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), restorePage);
router.delete('/manage/pages/:id/permanent', authenticateToken, requireRole(['SUPER_ADMIN']), deletePage);
router.get('/tracking/config', authenticateToken, requireRole(['SUPER_ADMIN']), asyncRoute(getTrackingConfig));
router.put('/tracking/config', authenticateToken, requireRole(['SUPER_ADMIN']), asyncRoute(updateTrackingConfig));
router.post('/tracking/test-capi', authenticateToken, requireRole(['SUPER_ADMIN']), asyncRoute(testMetaCapi));

export default router;
