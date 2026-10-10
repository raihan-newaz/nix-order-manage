import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../prisma';
import { revealSecret } from '../../utils/security';
import { applySteadfastStatus } from './steadfastStatus';
import { notifyCourierEvent } from '../messaging/messageService';

const types = new Set([
  'delivery_status', 'tracking_update', 'consignment_update', 'return_list_accepted',
  'payment_request', 'cancel_request', 'return_request', 'pickup_request', 'user_update',
]);
const schema = z.object({ notification_type: z.string().refine((type) => types.has(type)) }).passthrough();
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
const eventTime = (value: unknown) => {
  if (typeof value !== 'string') return new Date();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}+06:00` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const steadfastWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.courierConfig.findUnique({ where: { provider: 'STEADFAST' } });
    if (!settings?.webhookSecret) { res.status(503).json({ success: false, message: 'Steadfast webhook auth token is not configured' }); return; }
    const token = revealSecret(settings.webhookSecret);
    const authorization = req.header('Authorization') || '';
    const signature = (req.header('X-Signature') || '').toLowerCase();
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody || !/^Bearer /i.test(authorization) || !safeEqual(token, authorization.replace(/^Bearer /i, '')) || !/^[0-9a-f]{64}$/.test(signature) ||
      !safeEqual(crypto.createHmac('sha256', token).update(rawBody).digest('hex'), signature)) {
      res.status(401).json({ success: false, message: 'Invalid Steadfast webhook signature' }); return;
    }
    const idempotencyKey = req.header('Idempotency-Key') || '';
    if (!idempotencyKey || idempotencyKey.length > 200) { res.status(400).json({ success: false, message: 'Missing Steadfast idempotency key' }); return; }
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, message: 'Unsupported Steadfast event' }); return; }
    const body = parsed.data;
    const type = body.notification_type as string;
    const consignmentId = body.consignment_id == null ? undefined : String(body.consignment_id);
    const invoice = typeof body.invoice === 'string' ? body.invoice : undefined;
    const occurredAt = eventTime(body.updated_at || body.created_at);
    const fingerprint = crypto.createHash('sha256').update(`STEADFAST:${idempotencyKey}`).digest('hex');

    const result = await prisma.$transaction(async (tx) => {
      let order = consignmentId ? await tx.order.findFirst({ where: { courierName: 'STEADFAST', courierConsignmentId: consignmentId } }) : null;
      if (!order && invoice) order = await tx.order.findFirst({ where: {
        orderNumber: invoice, courierName: 'STEADFAST', courierConsignmentId: null,
        courierStatus: { in: ['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'] },
      } });
      if (order && invoice && order.orderNumber !== invoice) throw new Error('Steadfast event invoice does not match consignment');
      const record = await tx.courierWebhookEvent.create({ data: {
        fingerprint, provider: 'STEADFAST', event: type, orderId: order?.id,
        consignmentId, merchantOrderId: invoice, occurredAt,
        deliveryFee: typeof body.delivery_charge === 'number' ? body.delivery_charge : undefined,
        trackingMessage: typeof body.tracking_message === 'string' ? body.tracking_message.slice(0, 2000) : undefined,
        payload: body as Prisma.InputJsonValue,
      } });
      if (!order || type !== 'delivery_status' || typeof body.status !== 'string') return { eventId: record.id, matched: Boolean(order), applied: false };
      const applied = await applySteadfastStatus(tx, order, body.status, occurredAt, {
        consignmentId, trackingCode: typeof body.tracking_id === 'string' ? body.tracking_id : undefined,
        deliveryCharge: typeof body.delivery_charge === 'number' ? body.delivery_charge : undefined,
      });
      if (applied) await tx.courierWebhookEvent.update({ where: { id: record.id }, data: { applied: true } });
      return { eventId: record.id, matched: true, applied };
    });
    res.json({ success: true, ...result });
    if (result.applied) {
      void prisma.courierWebhookEvent.findUnique({ where: { id: result.eventId }, select: { orderId: true } })
        .then(event => event?.orderId ? notifyCourierEvent(event.orderId, String(body.status || '')) : undefined)
        .catch(error => console.error('Steadfast SMS notification failed:', error));
    }
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { res.json({ success: true, duplicate: true }); return; }
    if (error.message === 'Steadfast event invoice does not match consignment') { res.status(409).json({ success: false, message: error.message }); return; }
    console.error('Steadfast webhook processing failed:', error);
    res.status(500).json({ success: false, message: 'Could not process Steadfast webhook' });
  }
};
