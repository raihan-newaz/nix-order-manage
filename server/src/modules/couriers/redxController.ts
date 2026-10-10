import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../prisma';
import { AuthRequest } from '../../middlewares/auth';
import { isAllowedRemoteUrl, revealSecret } from '../../utils/security';
import { logAudit } from '../audit/auditService';
import { getRedXAdapter } from './redxSession';
import { applyRedXStatus } from './redxStatus';

const invalid = (res: Response, message: string) => res.status(400).json({ success: false, message });
const upstream = (res: Response, result: { success: boolean; message?: string; status?: number; data?: unknown }) =>
  res.status(result.success ? 200 : result.status === 401 ? 401 : 502).json(result);

export const redxTest = async (_req: Request, res: Response): Promise<void> => {
  try { const { adapter, settings } = await getRedXAdapter(); const result = await adapter.getPickupStores();
    res.status(result.success ? 200 : 502).json({ success: result.success, message: result.success ? `Connected to RedX ${settings.baseUrl?.includes('sandbox') ? 'sandbox' : 'production'}` : result.message, storeCount: result.success ? result.data.length : undefined });
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

export const redxStores = async (_req: Request, res: Response): Promise<void> => {
  try { const { adapter } = await getRedXAdapter(); upstream(res, await adapter.getPickupStores()); }
  catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

export const redxStore = async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { invalid(res, 'Invalid RedX pickup store ID'); return; }
  try { const { adapter } = await getRedXAdapter(); upstream(res, await adapter.getPickupStore(id)); }
  catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

const storeSchema = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/), address: z.string().trim().min(8).max(500), area_id: z.number().int().positive() });
export const redxCreateStore = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = storeSchema.safeParse(req.body);
  if (!parsed.success) { invalid(res, parsed.error.issues[0]?.message || 'Invalid pickup store'); return; }
  try {
    const location = await prisma.courierLocation.findUnique({ where: { provider_level_externalId: { provider: 'REDX', level: 'AREA', externalId: String(parsed.data.area_id) } } });
    if (!location?.active) { invalid(res, 'Select a valid RedX area'); return; }
    const { adapter } = await getRedXAdapter(true);
    const result = await adapter.createPickupStore(parsed.data);
    if (result.success && result.data?.id) await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'CREATE', entity: 'SETTING', entityId: String(result.data.id), details: { provider: 'REDX', type: 'PICKUP_STORE' } });
    res.status(result.success ? 201 : 502).json(result);
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

const chargeSchema = z.object({ deliveryAreaId: z.number().int().positive(), pickupAreaId: z.number().int().positive(), cashCollectionAmount: z.number().finite().nonnegative(), weightGrams: z.number().int().min(1).max(20000) });
export const redxCharge = async (req: Request, res: Response): Promise<void> => {
  const parsed = chargeSchema.safeParse(req.body);
  if (!parsed.success) { invalid(res, 'Select RedX pickup and delivery areas, COD and parcel weight'); return; }
  try { const { adapter } = await getRedXAdapter(); upstream(res, await adapter.calculateCharge(parsed.data)); }
  catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

const bookedOrder = async (orderId: string) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  return order?.courierName === 'REDX' && order.courierConsignmentId && !order.trashedAt ? order : null;
};

export const redxParcel = async (req: Request, res: Response): Promise<void> => {
  const order = await bookedOrder(String(req.params.orderId));
  if (!order) { res.status(404).json({ success: false, message: 'RedX parcel not found for this order' }); return; }
  try {
    const { adapter } = await getRedXAdapter();
    const [info, tracking] = await Promise.all([adapter.getParcelInfo(order.courierConsignmentId!), adapter.trackParcel(order.courierConsignmentId!)]);
    if (info.success && info.data && (String(info.data.tracking_id) !== order.courierConsignmentId ||
      (info.data.merchant_invoice_id && String(info.data.merchant_invoice_id) !== order.orderNumber))) {
      res.status(502).json({ success: false, message: 'RedX parcel does not match this order' }); return;
    }
    if (!info.success && !tracking.success) { res.status(502).json({ success: false, message: info.message || tracking.message || 'RedX parcel is unavailable' }); return; }
    res.json({ success: true, parcel: info.success ? info.data : null, infoError: info.success ? undefined : info.message,
      tracking: tracking.success ? tracking.data : [], trackingError: tracking.success ? undefined : tracking.message });
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

export const redxRefresh = async (req: AuthRequest, res: Response): Promise<void> => {
  const order = await bookedOrder(String(req.params.orderId));
  if (!order) { res.status(404).json({ success: false, message: 'RedX parcel not found for this order' }); return; }
  try {
    const { adapter } = await getRedXAdapter();
    const result = await adapter.getParcelInfo(order.courierConsignmentId!);
    if (!result.success || !result.data || String(result.data.tracking_id) !== order.courierConsignmentId ||
      (result.data.merchant_invoice_id && String(result.data.merchant_invoice_id) !== order.orderNumber)) {
      res.status(502).json({ success: false, message: result.message || 'RedX parcel does not match this order' }); return;
    }
    const status = String(result.data.status || '').slice(0, 100);
    if (status) await prisma.$transaction(tx => applyRedXStatus(tx, order, status, new Date(), Number(result.data.charge)));
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    res.json({ success: true, order: updated, parcel: result.data });
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

const updateSchema = z.discriminatedUnion('propertyName', [
  z.object({ propertyName: z.literal('status'), value: z.literal('cancelled'), reason: z.string().trim().min(3).max(500) }),
  z.object({ propertyName: z.literal('delivery_address'), value: z.string().trim().min(8).max(500), reason: z.string().trim().min(3).max(500) }),
]);
export const redxUpdateParcel = async (req: AuthRequest, res: Response): Promise<void> => {
  const order = await bookedOrder(String(req.params.orderId));
  if (!order) { res.status(404).json({ success: false, message: 'RedX parcel not found for this order' }); return; }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { invalid(res, 'Choose a supported parcel update and explain the reason'); return; }
  try {
    const { adapter } = await getRedXAdapter(true);
    const result = await adapter.updateParcel(order.courierConsignmentId!, parsed.data.propertyName, parsed.data.value, parsed.data.reason);
    if (result.success) await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'UPDATE', entity: 'ORDER', entityId: order.id, details: { provider: 'REDX', request: parsed.data } });
    res.status(result.success ? 202 : 502).json(result);
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

export const redxResolveBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.discriminatedUnion('action', [
    z.object({ action: z.literal('ATTACH'), trackingId: z.string().trim().min(4).max(100) }),
    z.object({ action: z.literal('CLEAR'), confirmation: z.literal('NO_REDX_BOOKING_CONFIRMED') }),
  ]).safeParse(req.body);
  if (!parsed.success) { invalid(res, 'Choose a valid RedX booking resolution'); return; }
  const order = await prisma.order.findUnique({ where: { id: String(req.params.orderId) } });
  if (!order || order.trashedAt || order.courierName !== 'REDX' || order.courierConsignmentId || !['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'].includes(order.courierStatus || '')) {
    res.status(409).json({ success: false, message: 'No unresolved RedX booking for this order' }); return;
  }
  try {
    if (parsed.data.action === 'CLEAR') {
      if (order.courierStatus !== 'BOOKING_UNCERTAIN') { res.status(409).json({ success: false, message: 'Wait for RedX to process this booking before clearing it' }); return; }
      const changed = await prisma.order.updateMany({ where: { id: order.id, courierName: 'REDX', courierConsignmentId: null, courierStatus: 'BOOKING_UNCERTAIN' }, data: { courierName: null, courierStatus: null, courierStoreId: null } });
      if (!changed.count) { res.status(409).json({ success: false, message: 'Booking changed; refresh the order' }); return; }
      await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'UPDATE', entity: 'ORDER', entityId: order.id, details: { redxBooking: 'CLEARED_AFTER_EXTERNAL_VERIFICATION' } });
    } else {
      const { adapter } = await getRedXAdapter();
      const result = await adapter.getParcelInfo(parsed.data.trackingId);
      if (!result.success || !result.data || String(result.data.tracking_id) !== parsed.data.trackingId || String(result.data.merchant_invoice_id) !== order.orderNumber) {
        res.status(409).json({ success: false, message: 'RedX tracking ID does not match this invoice' }); return;
      }
      const changed = await prisma.order.updateMany({ where: { id: order.id, courierName: 'REDX', courierConsignmentId: null, courierStatus: { in: ['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'] } },
        data: { courierConsignmentId: parsed.data.trackingId, courierTrackingCode: parsed.data.trackingId,
          courierTrackingLink: `https://redx.com.bd/track-parcel/?trackingId=${encodeURIComponent(parsed.data.trackingId)}`,
          courierStatus: String(result.data.status || 'PICKUP_PENDING').toUpperCase().replace(/-/g, '_'),
          status: order.status === 'PENDING' ? 'CONFIRMED' : order.status } });
      if (!changed.count) { res.status(409).json({ success: false, message: 'Booking changed; refresh the order' }); return; }
      await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'UPDATE', entity: 'ORDER', entityId: order.id, details: { redxBooking: 'ATTACHED_VERIFIED_TRACKING', trackingId: parsed.data.trackingId } });
    }
    res.json({ success: true, order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }) });
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

export const redxEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : undefined;
  if (!orderId && !['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER'].includes(req.user?.role || '')) { res.status(403).json({ success: false, message: 'Not authorized to view all RedX events' }); return; }
  const events = await prisma.courierWebhookEvent.findMany({ where: { provider: 'REDX', ...(orderId ? { orderId } : {}) }, orderBy: [{ occurredAt: 'desc' }, { receivedAt: 'desc' }], take: 100 });
  const publicApiUrl = (process.env.PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
  const webhookUrl = `${publicApiUrl}/api/couriers/redx/webhook`;
  const settings = req.user?.role === 'SUPER_ADMIN' ? await prisma.courierConfig.findUnique({ where: { provider: 'REDX' }, select: { webhookSecret: true } }) : null;
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, events, webhookUrl,
    ...(settings?.webhookSecret ? { webhookUrlWithToken: `${webhookUrl}?token=${encodeURIComponent(revealSecret(settings.webhookSecret))}` } : {}),
    publiclyReachable: isAllowedRemoteUrl(publicApiUrl) });
};
