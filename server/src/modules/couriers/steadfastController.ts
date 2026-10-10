import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../prisma';
import { AuthRequest } from '../../middlewares/auth';
import { SteadfastAdapter, STEADFAST_BASE_URL } from './adapters/steadfast';
import { getSteadfastAdapter } from './steadfastSession';
import { applySteadfastStatus } from './steadfastStatus';
import { isAllowedRemoteUrl } from '../../utils/security';
import { logAudit } from '../audit/auditService';

const relay = (res: Response, result: { success: boolean; statusCode?: number; message?: string }, data: unknown) => {
  res.status(result.success ? 200 : result.statusCode && result.statusCode < 500 ? result.statusCode : 502)
    .json(result.success ? { success: true, data } : { success: false, message: result.message || 'Steadfast request failed' });
};
const guarded = async (res: Response, operation: (adapter: SteadfastAdapter) => Promise<void>) => {
  try { const { adapter } = await getSteadfastAdapter(); await operation(adapter); }
  catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

export const steadfastPing = async (_req: Request, res: Response): Promise<void> => {
  const result = await SteadfastAdapter.ping();
  relay(res, result, result.success ? result.data : undefined);
};

export const steadfastTest = async (_req: Request, res: Response): Promise<void> => {
  await guarded(res, async (adapter) => {
    const result = await adapter.getCurrentBalance();
    relay(res, result, result.success ? { endpoint: STEADFAST_BASE_URL, credentialsValid: true } : undefined);
  });
};

export const steadfastBalance = async (_req: Request, res: Response): Promise<void> => {
  await guarded(res, async (adapter) => { const result = await adapter.getCurrentBalance(); relay(res, result, result.success ? result.data : undefined); });
};

export const steadfastPayments = async (req: Request, res: Response): Promise<void> => {
  const page = z.coerce.number().int().min(1).max(1000).safeParse(req.query.page || 1);
  if (!page.success) { res.status(400).json({ success: false, message: 'Invalid page' }); return; }
  await guarded(res, async (adapter) => { const result = await adapter.getPayments(page.data); relay(res, result, result.success ? result.data : undefined); });
};

export const steadfastPayment = async (req: Request, res: Response): Promise<void> => {
  const id = z.coerce.number().int().positive().safeParse(String(req.params.id).replace(/^SFC-/, ''));
  if (!id.success) { res.status(400).json({ success: false, message: 'Invalid payment ID' }); return; }
  await guarded(res, async (adapter) => { const result = await adapter.getPayment(id.data); relay(res, result, result.success ? result.data : undefined); });
};

export const steadfastPoliceStations = async (_req: Request, res: Response): Promise<void> => {
  await guarded(res, async (adapter) => { const result = await adapter.getPoliceStations(); relay(res, result, result.success ? result.data : undefined); });
};

export const steadfastFraudScore = async (req: Request, res: Response): Promise<void> => {
  const phone = z.string().regex(/^01[3-9]\d{8}$/).safeParse(req.params.phone);
  if (!phone.success) { res.status(400).json({ success: false, message: 'Enter an 11-digit Bangladesh mobile number' }); return; }
  await guarded(res, async (adapter) => { const result = await adapter.fraudScore(phone.data); relay(res, result, result.success ? result.data : undefined); });
};

export const steadfastStatusLookup = async (req: Request, res: Response): Promise<void> => {
  const kind = z.enum(['cid', 'cid-return', 'invoice', 'tracking']).safeParse(req.params.kind);
  const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/).safeParse(req.params.identifier);
  if (!kind.success || !identifier.success) { res.status(400).json({ success: false, message: 'Invalid Steadfast lookup' }); return; }
  await guarded(res, async (adapter) => {
    const result = kind.data === 'cid' ? await adapter.statusByConsignment(identifier.data) :
      kind.data === 'cid-return' ? await adapter.statusWithReturnByConsignment(identifier.data) :
      kind.data === 'invoice' ? await adapter.statusByInvoice(identifier.data) : await adapter.statusByTrackingCode(identifier.data);
    relay(res, result, result.success ? result.data : undefined);
  });
};

export const steadfastReturnRequests = async (req: Request, res: Response): Promise<void> => {
  const page = z.coerce.number().int().min(1).max(1000).safeParse(req.query.page || 1);
  if (!page.success) { res.status(400).json({ success: false, message: 'Invalid page' }); return; }
  await guarded(res, async (adapter) => { const result = await adapter.getReturnRequests(page.data); relay(res, result, result.success ? result.data : undefined); });
};

export const steadfastReturnRequest = async (req: Request, res: Response): Promise<void> => {
  const id = z.coerce.number().int().positive().safeParse(req.params.id);
  if (!id.success) { res.status(400).json({ success: false, message: 'Invalid return request ID' }); return; }
  await guarded(res, async (adapter) => { const result = await adapter.getReturnRequest(id.data); relay(res, result, result.success ? result.data : undefined); });
};

const pickupSchema = z.object({
  address_id: z.number().int().positive(), police_station_id: z.number().int().positive(),
  address: z.string().trim().min(10).max(255), contact_number: z.string().regex(/^01[3-9]\d{8}$/),
  note: z.string().max(500).optional(), estim_qty: z.number().int().positive().max(10000).optional(),
});
export const steadfastCreatePickup = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = pickupSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid pickup request' }); return; }
  await guarded(res, async (adapter) => {
    const result = await adapter.createPickupRequest(parsed.data);
    if (!result.success) { relay(res, result, undefined); return; }
    await prisma.courierRequest.create({ data: { provider: 'STEADFAST', type: 'PICKUP', externalId: String(result.data.id), status: String(result.data.req_status ?? 'PENDING'), payload: parsed.data as Prisma.InputJsonValue, createdById: req.user?.id } });
    res.status(201).json({ success: true, data: result.data });
  });
};

export const steadfastCreateReturn = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ reason: z.string().trim().max(500).optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: 'Reason must be at most 500 characters' }); return; }
  const order = await prisma.order.findUnique({ where: { id: String(req.params.orderId) } });
  if (!order || order.trashedAt || order.courierName !== 'STEADFAST' || !order.courierConsignmentId || ['DELIVERED', 'RETURNED', 'CANCELLED'].includes(order.status)) {
    res.status(409).json({ success: false, message: 'Only an active Steadfast parcel can be requested for return' }); return;
  }
  await guarded(res, async (adapter) => {
    const result = await adapter.createReturnRequest({ invoice: order.orderNumber, reason: parsed.data.reason });
    if (!result.success) { relay(res, result, undefined); return; }
    await prisma.courierRequest.create({ data: { provider: 'STEADFAST', type: 'RETURN', externalId: String(result.data.id), orderId: order.id, status: String(result.data.status || 'pending'), payload: { invoice: order.orderNumber, reason: parsed.data.reason || '' }, createdById: req.user?.id } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'UPDATE', entity: 'ORDER', entityId: order.id, details: { steadfastReturnRequestId: result.data.id } });
    res.status(201).json({ success: true, data: result.data });
  });
};

export const steadfastOrderTracking = async (req: Request, res: Response): Promise<void> => {
  const order = await prisma.order.findUnique({ where: { id: String(req.params.orderId) } });
  if (!order || order.courierName !== 'STEADFAST') { res.status(404).json({ success: false, message: 'Steadfast order not found' }); return; }
  await guarded(res, async (adapter) => { const result = await adapter.trackingsByInvoice(order.orderNumber); relay(res, result, result.success ? result.data : undefined); });
};

export const steadfastRefreshOrder = async (req: Request, res: Response): Promise<void> => {
  const order = await prisma.order.findUnique({ where: { id: String(req.params.orderId) } });
  if (!order || order.courierName !== 'STEADFAST' || !order.courierConsignmentId) { res.status(404).json({ success: false, message: 'Steadfast consignment not found' }); return; }
  await guarded(res, async (adapter) => {
    const result = await adapter.statusWithReturnByConsignment(order.courierConsignmentId!);
    if (!result.success || !result.deliveryStatus) { relay(res, result, undefined); return; }
    let applied = false;
    if (!order.courierEventAt || Date.now() - order.courierEventAt.getTime() > 60_000) {
      applied = await prisma.$transaction((tx) => applySteadfastStatus(tx, order, result.deliveryStatus!, new Date()));
    }
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    res.json({ success: true, deliveryStatus: result.deliveryStatus, applied, order: updated });
  });
};

export const steadfastResolveBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.discriminatedUnion('action', [
    z.object({ action: z.literal('ATTACH'), consignmentId: z.string().regex(/^\d+$/) }),
    z.object({ action: z.literal('CLEAR'), confirmation: z.literal('NO_STEADFAST_BOOKING_CONFIRMED') }),
  ]).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: 'Invalid booking resolution' }); return; }
  const order = await prisma.order.findUnique({ where: { id: String(req.params.orderId) } });
  if (!order || order.courierName !== 'STEADFAST' || order.courierConsignmentId || !['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'].includes(order.courierStatus || '')) {
    res.status(409).json({ success: false, message: 'No unresolved Steadfast booking found' }); return;
  }
  if (parsed.data.action === 'CLEAR') {
    const updated = await prisma.order.updateMany({
      where: { id: order.id, courierName: 'STEADFAST', courierConsignmentId: null, courierStatus: { in: ['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'] } },
      data: { courierName: null, courierStatus: null },
    });
    if (!updated.count) { res.status(409).json({ success: false, message: 'Booking changed; reload the order' }); return; }
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'UPDATE', entity: 'ORDER', entityId: order.id, details: { steadfastBookingResolution: 'CLEAR', confirmation: parsed.data.confirmation } });
    res.json({ success: true, order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }) });
    return;
  }
  const consignmentId = parsed.data.consignmentId;
  await guarded(res, async (adapter) => {
    const tracking = await adapter.trackingsByInvoice(order.orderNumber);
    if (!tracking.success || !Array.isArray(tracking.data)) { relay(res, tracking, undefined); return; }
    const match = tracking.data.find((entry: any) => String(entry.consignment_id) === consignmentId);
    if (!match) { res.status(409).json({ success: false, message: 'This consignment is not linked to the order invoice in Steadfast' }); return; }
    const status = await adapter.statusWithReturnByConsignment(consignmentId);
    if (!status.success) { relay(res, status, undefined); return; }
    const updated = await prisma.order.updateMany({
      where: { id: order.id, courierName: 'STEADFAST', courierConsignmentId: null, courierStatus: { in: ['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'] } },
      data: { courierConsignmentId: consignmentId, courierStatus: String(status.deliveryStatus || 'IN_REVIEW').toUpperCase(), status: order.status === 'PENDING' ? 'CONFIRMED' : order.status },
    });
    if (!updated.count) { res.status(409).json({ success: false, message: 'Booking changed; reload the order' }); return; }
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'UPDATE', entity: 'ORDER', entityId: order.id, details: { steadfastBookingResolution: 'ATTACH', consignmentId } });
    res.json({ success: true, order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }) });
  });
};

export const steadfastEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : undefined;
  if (!orderId && !['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER'].includes(req.user?.role || '')) { res.status(403).json({ success: false, message: 'Not authorized' }); return; }
  const events = await prisma.courierWebhookEvent.findMany({ where: { provider: 'STEADFAST', ...(orderId ? { orderId } : {}) }, orderBy: { receivedAt: 'desc' }, take: 100 });
  const publicApiUrl = (process.env.PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
  res.json({ success: true, events, webhookUrl: `${publicApiUrl}/api/couriers/steadfast/webhook`, publiclyReachable: isAllowedRemoteUrl(publicApiUrl) });
};

export const steadfastRequests = async (_req: Request, res: Response): Promise<void> => {
  const requests = await prisma.courierRequest.findMany({ where: { provider: 'STEADFAST' }, orderBy: { createdAt: 'desc' }, take: 30 });
  res.json({ success: true, requests });
};
