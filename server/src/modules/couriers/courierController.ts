import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../prisma';
import { AuthRequest } from '../../middlewares/auth';
import { dispatchBulkToPathao, dispatchBulkToSteadfast, dispatchOrderToCourier } from './courierService';
import { callPathao, pathaoBaseUrl } from './pathaoSession';
import { redxBaseUrl } from './adapters/redx';
import { normalizeLocation } from './courierLocations';
import { config as appConfig } from '../../config';
import { logAudit } from '../audit/auditService';
import { STEADFAST_BASE_URL, SteadfastAdapter } from './adapters/steadfast';
import { getSteadfastAdapter } from './steadfastSession';
import { isAllowedRemoteUrl, keepExistingSecret, maskSecret, MASKED_SECRET, revealSecret } from '../../utils/security';

export const dispatchSingleOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = z.object({
      orderId: z.string().uuid(), courierName: z.enum(['STEADFAST', 'PATHAO', 'REDX', 'MANUAL']),
      weight: z.number().finite().positive().max(20).optional(),
      cityId: z.number().int().positive().optional(), zoneId: z.number().int().positive().optional(), areaId: z.number().int().positive().optional(), areaName: z.string().trim().max(100).optional(),
      storeId: z.number().int().positive().optional(), deliveryType: z.union([z.literal(0), z.literal(1), z.literal(12), z.literal(48)]).optional(),
      itemType: z.union([z.literal(1), z.literal(2)]).optional(),
      secondaryPhone: z.string().regex(/^01[3-9]\d{8}$/).optional(),
      specialInstruction: z.string().max(500).optional(), itemDescription: z.string().max(255).optional(),
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid courier request' }); return; }
    const { orderId, courierName, weight, cityId, zoneId, areaId, areaName, specialInstruction, deliveryType, itemType, storeId, itemDescription, secondaryPhone } = parsed.data;

    const updatedOrder = await dispatchOrderToCourier({
      orderId,
      courierName,
      weight,
      cityId,
      zoneId,
      areaId,
      areaName,
      specialInstruction,
      deliveryType,
      itemType,
      storeId,
      itemDescription,
      secondaryPhone,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    res.json({
      success: true,
      message: `Order successfully booked with ${courierName}! Tracking Code: ${updatedOrder.courierTrackingCode}`,
      order: updatedOrder,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const dispatchBulkOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = z.object({ orderIds: z.array(z.string().uuid()).min(1).max(100), courierName: z.enum(['STEADFAST', 'PATHAO', 'REDX']) }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid bulk dispatch request' }); return; }
    const { orderIds, courierName } = parsed.data;
    if (courierName === 'STEADFAST') {
      const result = await dispatchBulkToSteadfast(orderIds, req.user?.id, req.user?.name);
      res.json({ success: true, message: `Booked ${result.dispatched} with Steadfast; ${result.errors.length} failed`, dispatched: result.dispatched, failed: result.errors.length, errors: result.errors });
      return;
    }
    if (courierName === 'PATHAO') {
      if (orderIds.length > 50) { res.status(400).json({ success: false, message: 'Select at most 50 orders for one Pathao bulk request' }); return; }
      const result = await dispatchBulkToPathao(orderIds);
      res.status(202).json({ success: true, message: `${result.accepted} Pathao bulk bookings accepted; consignments will arrive by webhook`, dispatched: result.accepted, accepted: result.accepted, failed: result.errors.length, errors: result.errors, pending: true });
      return;
    }

    const results = [];
    const errors = [];
    const redxAreas = courierName === 'REDX' ? await prisma.courierLocation.findMany({ where: { provider: 'REDX', level: 'AREA', active: true }, select: { externalId: true, normalizedName: true, districtName: true } }) : [];

    for (const orderId of orderIds) {
      try {
        let areaId: number | undefined;
        if (courierName === 'REDX') {
          const order = await prisma.order.findUnique({ where: { id: orderId }, select: { area: true, district: true, city: true, customerAddress: true } });
          if (!order) throw new Error('Order not found');
          const district = normalizeLocation(order.district || order.city || '');
          const candidates = redxAreas.filter(area => !district || !area.districtName || normalizeLocation(area.districtName) === district);
          const explicit = normalizeLocation(order.area || '');
          const address = ` ${normalizeLocation(order.customerAddress)} `;
          const matches = candidates.filter(area => (explicit && area.normalizedName === explicit) || (area.normalizedName.length >= 4 && address.includes(` ${area.normalizedName} `)));
          if (matches.length !== 1) throw new Error('RedX area is ambiguous or missing. Open the order and select its exact area.');
          areaId = Number(matches[0].externalId);
        }
        const updated = await dispatchOrderToCourier({
          orderId,
          courierName,
          areaId,
          userId: req.user?.id,
          userName: req.user?.name,
        });
        results.push(updated);
      } catch (err: any) {
        errors.push({ orderId, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Dispatched ${results.length} orders to ${courierName}. ${errors.length} failed.`,
      dispatched: results.length,
      failed: errors.length,
      errors,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCourierConfigs = async (req: Request, res: Response): Promise<void> => {
  try {
    const configs = await prisma.courierConfig.findMany();
    res.json({ success: true, configs: configs.map(({ accessToken, refreshToken, ...item }) => ({ ...item, apiKey: maskSecret(item.apiKey), secretKey: maskSecret(item.secretKey), clientSecret: maskSecret(item.clientSecret), password: maskSecret(item.password), webhookSecret: maskSecret(item.webhookSecret), webhookVerificationSecret: maskSecret(item.webhookVerificationSecret) })) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const revealCourierConfigSecret = async (req: Request, res: Response): Promise<void> => {
  const provider = String(req.params.provider || '').toUpperCase();
  const field = String(req.params.field || '');
  const allowedFields: Record<string, string[]> = {
    STEADFAST: ['apiKey', 'secretKey', 'webhookSecret'],
    PATHAO: ['clientSecret', 'password', 'webhookSecret', 'webhookVerificationSecret'],
    REDX: ['apiKey', 'webhookSecret'],
    PAPERFLY: ['apiKey', 'secretKey', 'password'],
  };
  if (!allowedFields[provider]?.includes(field)) { res.status(400).json({ success: false, message: 'Unsupported courier credential' }); return; }
  try {
    const config = await prisma.courierConfig.findUnique({ where: { provider } });
    const value = config?.[field as keyof typeof config];
    if (typeof value !== 'string' || !value) { res.status(404).json({ success: false, message: 'No credential is saved for this field' }); return; }
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({ success: true, value: revealSecret(value) });
  } catch {
    res.status(500).json({ success: false, message: 'Could not reveal saved courier credential' });
  }
};

export const updateCourierConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = (req.params.provider as string).toUpperCase();
    const { apiKey, secretKey, clientId, clientSecret, username, password, storeId, baseUrl, isEnabled, isDefault, webhookSecret, webhookVerificationSecret } = req.body;

    if (!['STEADFAST', 'PATHAO', 'REDX', 'PAPERFLY'].includes(provider)) { res.status(400).json({ success: false, message: 'Unsupported courier provider' }); return; }
    if (provider === 'PATHAO') {
      try { pathaoBaseUrl(baseUrl || undefined); } catch (error: any) { res.status(400).json({ success: false, message: error.message }); return; }
    } else if (provider === 'STEADFAST') {
      if (baseUrl && baseUrl !== STEADFAST_BASE_URL) { res.status(400).json({ success: false, message: 'Steadfast uses https://portal.packzy.com/api/v1' }); return; }
    } else if (provider === 'REDX') {
      try { redxBaseUrl(baseUrl || undefined); } catch (error: any) { res.status(400).json({ success: false, message: error.message }); return; }
    } else if (baseUrl && !isAllowedRemoteUrl(baseUrl, appConfig.isDev)) { res.status(400).json({ success: false, message: 'Use a public HTTPS courier API URL' }); return; }
    const existing = await prisma.courierConfig.findUnique({ where: { provider } });
    const nextStoreId = storeId === undefined ? existing?.storeId : String(storeId || '').trim();
    const nextClientId = clientId === undefined ? existing?.clientId : String(clientId).trim();
    const nextUsername = username === undefined ? existing?.username : String(username).trim();
    const nextClientSecret = keepExistingSecret(clientSecret, existing?.clientSecret);
    const nextPassword = keepExistingSecret(password, existing?.password);
    const nextWebhookSecret = keepExistingSecret(webhookSecret, existing?.webhookSecret);
    const nextVerificationSecret = keepExistingSecret(webhookVerificationSecret, existing?.webhookVerificationSecret);
    const nextApiKey = keepExistingSecret(apiKey, existing?.apiKey);
    const nextSecretKey = keepExistingSecret(secretKey, existing?.secretKey);
    if (provider === 'REDX') {
      if (isEnabled && !nextApiKey) { res.status(400).json({ success: false, message: 'Save a RedX token before enabling' }); return; }
      if (existing?.baseUrl && baseUrl && redxBaseUrl(baseUrl) !== redxBaseUrl(existing.baseUrl) && (!apiKey || apiKey === MASKED_SECRET)) {
        res.status(400).json({ success: false, message: 'Enter the token for the selected RedX environment' }); return;
      }
      if (webhookSecret && webhookSecret !== MASKED_SECRET && String(webhookSecret).trim().length < 32) {
        res.status(400).json({ success: false, message: 'RedX webhook token must be at least 32 characters' }); return;
      }
    }
    if (provider === 'STEADFAST') {
      if (isEnabled && (!nextApiKey || !nextSecretKey)) { res.status(400).json({ success: false, message: 'Steadfast needs both API Key and Secret Key before enabling' }); return; }
      if (webhookSecret && webhookSecret !== MASKED_SECRET && String(webhookSecret).trim().length < 24) { res.status(400).json({ success: false, message: 'Enter the Steadfast webhook auth token (at least 24 characters)' }); return; }
    }
    if (provider === 'PATHAO') {
      if (nextStoreId && (!/^\d+$/.test(nextStoreId) || Number(nextStoreId) < 1)) { res.status(400).json({ success: false, message: 'Select a valid Pathao pickup store' }); return; }
      if (isEnabled && (!nextStoreId || !nextClientId || !nextClientSecret || !nextUsername || !nextPassword)) {
        res.status(400).json({ success: false, message: 'Pathao requires merchant credentials and a pickup store before enabling' }); return;
      }
      if (webhookSecret && webhookSecret !== MASKED_SECRET && String(webhookSecret).trim().length < 32) {
        res.status(400).json({ success: false, message: 'Use a Pathao webhook signature secret of at least 32 characters' }); return;
      }
      if (webhookVerificationSecret && webhookVerificationSecret !== MASKED_SECRET && String(webhookVerificationSecret).trim().length < 16) {
        res.status(400).json({ success: false, message: 'Enter the Pathao webhook integration verification value' }); return;
      }
      if (Boolean(nextWebhookSecret) !== Boolean(nextVerificationSecret)) {
        res.status(400).json({ success: false, message: 'Set both Pathao webhook values, or leave both empty' }); return;
      }
    }
    const credentialsChanged = provider === 'PATHAO' && Boolean(
      (clientId !== undefined && nextClientId !== existing?.clientId) ||
      (username !== undefined && nextUsername !== existing?.username) ||
      (baseUrl !== undefined && pathaoBaseUrl(baseUrl) !== pathaoBaseUrl(existing?.baseUrl)) ||
      (clientSecret && clientSecret !== MASKED_SECRET) || (password && password !== MASKED_SECRET)
    );
    const pathaoFields = provider === 'PATHAO' ? {
      username: nextUsername,
      password: nextPassword,
      storeId: nextStoreId || null,
      storeActive: nextStoreId === existing?.storeId ? existing?.storeActive : null,
      webhookSecret: nextWebhookSecret,
      webhookVerificationSecret: nextVerificationSecret,
      baseUrl: pathaoBaseUrl(baseUrl || existing?.baseUrl),
      ...(credentialsChanged ? { accessToken: null, refreshToken: null, tokenExpiresAt: null } : {}),
    } : {};
    const steadfastFields = provider === 'STEADFAST' ? { baseUrl: STEADFAST_BASE_URL, webhookSecret: nextWebhookSecret } : {};
    const redxFields = provider === 'REDX' ? { baseUrl: redxBaseUrl(baseUrl || existing?.baseUrl), webhookSecret: nextWebhookSecret } : {};
    const config = await prisma.courierConfig.upsert({
      where: { provider },
      create: {
        provider,
        apiKey: keepExistingSecret(apiKey),
        secretKey: keepExistingSecret(secretKey),
        clientId: provider === 'PATHAO' ? nextClientId : clientId,
        clientSecret: provider === 'PATHAO' ? nextClientSecret : keepExistingSecret(clientSecret),
        storeId,
        baseUrl,
        ...pathaoFields,
        ...steadfastFields,
        ...redxFields,
        isEnabled: isEnabled ?? false,
        isDefault: isDefault ?? false,
      },
      update: {
        apiKey: keepExistingSecret(apiKey, existing?.apiKey),
        secretKey: keepExistingSecret(secretKey, existing?.secretKey),
        clientId: provider === 'PATHAO' ? nextClientId : clientId,
        clientSecret: provider === 'PATHAO' ? nextClientSecret : keepExistingSecret(clientSecret, existing?.clientSecret),
        storeId,
        baseUrl,
        ...pathaoFields,
        ...steadfastFields,
        ...redxFields,
        isEnabled,
        isDefault,
      },
    });
    if (provider === 'REDX' && existing?.baseUrl && redxBaseUrl(existing.baseUrl) !== redxBaseUrl(config.baseUrl)) {
      await prisma.$transaction([
        prisma.courierLocation.updateMany({ where: { provider: 'REDX' }, data: { active: false } }),
        prisma.courierLocationSync.deleteMany({ where: { provider: 'REDX' } }),
      ]);
    }

    const { accessToken, refreshToken, ...safeConfig } = config;
    res.json({ success: true, message: `${provider} configuration saved successfully`, config: { ...safeConfig, apiKey: maskSecret(config.apiKey), secretKey: maskSecret(config.secretKey), clientSecret: maskSecret(config.clientSecret), password: maskSecret(config.password), webhookSecret: maskSecret(config.webhookSecret), webhookVerificationSecret: maskSecret(config.webhookVerificationSecret) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPathaoLocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, parentId } = req.query;
    const id = Number(parentId);
    if (!['cities', 'zones', 'areas'].includes(String(type)) || (type !== 'cities' && (!Number.isInteger(id) || id < 1))) {
      res.status(400).json({ success: false, message: 'Choose a valid location type and parent ID' }); return;
    }
    const result = type === 'cities' ? await callPathao((adapter, token) => adapter.getCities(token)) :
      type === 'zones' ? await callPathao((adapter, token) => adapter.getZones(id, token)) :
      await callPathao((adapter, token) => adapter.getAreas(id, token));
    res.status(result.success ? 200 : 502).json(result);
  } catch (error: any) {
    res.status(503).json({ success: false, message: error.message });
  }
};

export const getPathaoStores = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await callPathao((adapter, token) => adapter.getStores(token));
    const settings = await prisma.courierConfig.findUnique({ where: { provider: 'PATHAO' } });
    if (result.success) {
      const selected = result.data?.find((store: any) => String(store.store_id) === settings?.storeId);
      if (selected && settings?.storeActive !== Boolean(selected.is_active)) {
        await prisma.courierConfig.update({ where: { provider: 'PATHAO' }, data: { storeActive: Boolean(selected.is_active) } });
      }
    }
    res.status(result.success ? 200 : 502).json({ ...result, selectedStoreId: settings?.storeId || null });
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

const pathaoStoreSchema = z.object({
  name: z.string().trim().min(3).max(50),
  contact_name: z.string().trim().min(3).max(50),
  contact_number: z.string().regex(/^01[3-9]\d{8}$/),
  address: z.string().trim().min(15).max(120),
  city_id: z.number().int().positive(), zone_id: z.number().int().positive(), area_id: z.number().int().positive(),
  secondary_contact: z.string().regex(/^01[3-9]\d{8}$/).optional(),
  otp_number: z.string().regex(/^01[3-9]\d{8}$/).optional(),
});

export const createPathaoStore = async (req: Request, res: Response): Promise<void> => {
  const parsed = pathaoStoreSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid store details' }); return; }
  try {
    const result = await callPathao((adapter, token) => adapter.createStore(parsed.data, token));
    res.status(result.success ? 201 : 502).json(result);
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

const pathaoPriceSchema = z.object({ cityId: z.number().int().positive(), zoneId: z.number().int().positive(), weight: z.number().min(0.5).max(10), deliveryType: z.union([z.literal(48), z.literal(12)]), itemType: z.union([z.literal(1), z.literal(2)]).default(2), storeId: z.number().int().positive().optional() });
export const getPathaoPrice = async (req: Request, res: Response): Promise<void> => {
  const parsed = pathaoPriceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: 'Select Pathao city and zone, and a weight between 0.5 and 10 kg' }); return; }
  try {
    const settings = await prisma.courierConfig.findUnique({ where: { provider: 'PATHAO' } });
    if (!settings?.storeId || !/^\d+$/.test(settings.storeId)) { res.status(409).json({ success: false, message: 'Select a Pathao pickup store first' }); return; }
    const pickupStoreId = parsed.data.storeId || Number(settings.storeId);
    if (pickupStoreId !== Number(settings.storeId)) {
      const stores = await callPathao((adapter, token) => adapter.getStores(token), true);
      if (!stores.success || !stores.data?.some((store: any) => Number(store.store_id) === pickupStoreId && Number(store.is_active) === 1)) {
        res.status(400).json({ success: false, message: 'Select an active Pathao pickup store' }); return;
      }
    }
    const result = await callPathao((adapter, token) => adapter.calculatePrice({
      store_id: pickupStoreId, item_type: parsed.data.itemType, delivery_type: parsed.data.deliveryType,
      item_weight: parsed.data.weight, recipient_city: parsed.data.cityId, recipient_zone: parsed.data.zoneId,
    }, token));
    res.status(result.success ? 200 : 502).json(result);
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

export const refreshPathaoTracking = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({ where: { id: String(req.params.orderId) } });
    if (!order || order.courierName !== 'PATHAO' || !order.courierConsignmentId) { res.status(404).json({ success: false, message: 'Pathao consignment not found for this order' }); return; }
    const result = await callPathao((adapter, token) => adapter.trackOrder(order.courierConsignmentId!, token));
    if (!result.success || !result.data) { res.status(502).json({ success: false, message: result.message || 'Could not refresh Pathao status' }); return; }
    if (String(result.data.consignment_id) !== order.courierConsignmentId || (result.data.merchant_order_id && String(result.data.merchant_order_id) !== order.orderNumber)) {
      res.status(502).json({ success: false, message: 'Pathao tracking response did not match this order' }); return;
    }
    const status = String(result.data.order_status_slug || result.data.order_status || '').slice(0, 80);
    const updated = await prisma.order.update({ where: { id: order.id }, data: { courierStatus: status } });
    res.json({ success: true, courierStatus: status, order: updated });
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

export const resolvePathaoBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.discriminatedUnion('action', [
    z.object({ action: z.literal('ATTACH'), consignmentId: z.string().trim().min(5).max(100) }),
    z.object({ action: z.literal('CLEAR'), confirmation: z.literal('NO_PATHAO_BOOKING_CONFIRMED') }),
  ]).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: 'Choose a valid Pathao booking resolution' }); return; }
  try {
    const order = await prisma.order.findUnique({ where: { id: String(req.params.orderId) } });
    if (!order || order.trashedAt || order.courierName !== 'PATHAO' || order.courierConsignmentId || !['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'].includes(order.courierStatus || '')) {
      res.status(409).json({ success: false, message: 'This order has no unresolved Pathao booking' }); return;
    }
    if (parsed.data.action === 'CLEAR') {
      if (order.courierStatus !== 'BOOKING_UNCERTAIN') { res.status(409).json({ success: false, message: 'Wait for Pathao to process this booking before clearing it' }); return; }
      const cleared = await prisma.order.updateMany({ where: { id: order.id, courierName: 'PATHAO', courierConsignmentId: null, courierStatus: 'BOOKING_UNCERTAIN' }, data: { courierName: null, courierStatus: null, courierStoreId: null } });
      if (!cleared.count) { res.status(409).json({ success: false, message: 'Pathao booking changed. Refresh the order before retrying.' }); return; }
      const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'UPDATE', entity: 'ORDER', entityId: order.id, details: { pathaoBooking: 'CLEARED_AFTER_EXTERNAL_VERIFICATION' } });
      res.json({ success: true, order: updated }); return;
    }
    const consignmentId = parsed.data.consignmentId;
    const result = await callPathao((adapter, token) => adapter.trackOrder(consignmentId, token));
    if (!result.success || !result.data || String(result.data.consignment_id) !== consignmentId || String(result.data.merchant_order_id) !== order.orderNumber) {
      res.status(409).json({ success: false, message: 'Pathao consignment does not match this order number' }); return;
    }
    const attached = await prisma.order.updateMany({ where: { id: order.id, courierName: 'PATHAO', courierConsignmentId: null, courierStatus: { in: ['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'] } }, data: {
      courierConsignmentId: consignmentId, courierTrackingCode: consignmentId,
      courierStatus: String(result.data.order_status_slug || result.data.order_status || 'PENDING').slice(0, 80),
      status: order.status === 'PENDING' ? 'CONFIRMED' : order.status,
    } });
    if (!attached.count) { res.status(409).json({ success: false, message: 'Pathao booking changed. Refresh the order before attaching.' }); return; }
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'UPDATE', entity: 'ORDER', entityId: order.id, details: { pathaoBooking: 'ATTACHED_VERIFIED_CONSIGNMENT', consignmentId } });
    res.json({ success: true, order: updated });
  } catch (error: any) { res.status(503).json({ success: false, message: error.message }); }
};

export const getPathaoEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : undefined;
    if (!orderId && !['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER'].includes(req.user?.role || '')) {
      res.status(403).json({ success: false, message: 'Not authorized to view all Pathao events' }); return;
    }
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const events = await prisma.courierWebhookEvent.findMany({
      where: { provider: 'PATHAO', ...(orderId ? { orderId } : {}) },
      orderBy: [{ occurredAt: 'desc' }, { receivedAt: 'desc' }], take: limit,
      include: { order: { select: { orderNumber: true } } },
    });
    const publicApiUrl = (process.env.PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
    res.json({ success: true, events, webhookUrl: `${publicApiUrl}/api/couriers/pathao/webhook`, publiclyReachable: isAllowedRemoteUrl(publicApiUrl) });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const getReconciliationSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const inTransitOrders = await prisma.order.findMany({
      where: { trashedAt: null, OR: [{ status: 'IN_TRANSIT' }, { courierName: 'PATHAO', courierConsignmentId: { not: null }, courierSettlementStatus: { not: 'RECONCILED' }, status: { in: ['CONFIRMED', 'HANDED_OVER', 'HOLD', 'PARTIAL_DELIVERED', 'DELIVERED', 'RETURNED'] } }] },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customerName: true,
        customerPhone: true,
        courierName: true,
        courierTrackingCode: true,
        courierStatus: true,
        codAmount: true,
        advancePaid: true,
        grandTotal: true,
        courierSettlementStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    const pathaoIds = inTransitOrders.filter((order) => order.courierName === 'PATHAO').map((order) => order.id);
    const paymentEvents = pathaoIds.length ? await prisma.courierWebhookEvent.findMany({
      where: { orderId: { in: pathaoIds }, OR: [{ collectedAmount: { not: null } }, { invoiceId: { not: null } }] },
      select: { orderId: true, collectedAmount: true, invoiceId: true }, orderBy: { occurredAt: 'desc' },
    }) : [];
    const paymentByOrder = new Map<string, { reportedCollectedAmount?: number; pathaoInvoiceId?: string }>();
    for (const event of paymentEvents) {
      if (!event.orderId) continue;
      const current = paymentByOrder.get(event.orderId) || {};
      if (current.reportedCollectedAmount === undefined && event.collectedAmount !== null) current.reportedCollectedAmount = event.collectedAmount;
      if (!current.pathaoInvoiceId && event.invoiceId) current.pathaoInvoiceId = event.invoiceId;
      paymentByOrder.set(event.orderId, current);
    }

    const totalInTransitValue = inTransitOrders.reduce(
      (sum, o) => sum + Math.max(0, o.grandTotal - o.advancePaid),
      0
    );

    // Courier exceptions queue
    const exceptionOrders = await prisma.order.findMany({
      where: {
        trashedAt: null,
        courierName: { not: null },
        status: { notIn: ['DELIVERED', 'CANCELLED', 'RETURNED'] },
        OR: [
          { courierTrackingCode: null },
          { courierStatus: { in: ['FAILED', 'ERROR', 'UNKNOWN', 'BOOKING_REQUESTED'] } },
          { courierSettlementStatus: 'DISCREPANCY' },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customerName: true,
        customerPhone: true,
        courierName: true,
        courierTrackingCode: true,
        courierConsignmentId: true,
        courierStatus: true,
        courierSettlementStatus: true,
        grandTotal: true,
        advancePaid: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const exceptions = exceptionOrders.map((order) => {
      let nextAction = 'REFRESH_STATUS';
      let nextActionLabel = 'Refresh Provider Status';
      if (order.courierSettlementStatus === 'DISCREPANCY') {
        nextAction = 'RESOLVE_DISCREPANCY';
        nextActionLabel = 'Check COD Reconciliation';
      } else if (order.courierStatus === 'FAILED') {
        nextAction = 'RESOLVE_BOOKING';
        nextActionLabel = 'Resolve Booking';
      } else if (!order.courierTrackingCode || order.courierStatus === 'BOOKING_REQUESTED') {
        nextAction = 'REFRESH_STATUS';
        nextActionLabel = 'Refresh Provider Status';
      }

      return {
        ...order,
        nextAction,
        nextActionLabel,
        retryBlockedReason: 'Cannot retry dispatch while booking outcome is pending or unresolved.',
      };
    });

    res.json({
      success: true,
      totalInTransitOrders: inTransitOrders.length,
      totalInTransitValue,
      orders: inTransitOrders.map((order) => ({ ...order, ...paymentByOrder.get(order.id) })),
      exceptions,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
