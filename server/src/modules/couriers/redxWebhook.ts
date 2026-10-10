import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../prisma';
import { revealSecret } from '../../utils/security';
import { applyRedXStatus } from './redxStatus';
import { notifyCourierEvent } from '../messaging/messageService';

const statuses = new Set(['ready-for-delivery', 'delivery-in-progress', 'delivered', 'agent-hold', 'agent-returning', 'returned', 'agent-area-change', 'paid', 'partial-delivery', 'cancelled']);
const eventSchema = z.object({
  tracking_number: z.string().trim().min(4).max(100),
  timestamp: z.union([z.string().min(1).max(50), z.number().finite()]),
  status: z.string().trim().max(80).refine(value => statuses.has(value)),
  message_en: z.string().max(2000).optional(), message_bn: z.string().max(2000).optional(),
  invoice_number: z.string().max(100).optional(), delivery_type: z.string().max(60).optional(),
});

const equal = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const redxWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.courierConfig.findUnique({ where: { provider: 'REDX' } });
    const supplied = typeof req.query.token === 'string' ? req.query.token : '';
    if (!settings?.webhookSecret || !supplied || !equal(revealSecret(settings.webhookSecret), supplied)) {
      res.status(401).json({ success: false, message: 'Invalid RedX callback token' }); return;
    }
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, message: 'Invalid RedX event' }); return; }
    const body = parsed.data;
    const occurredAt = new Date(typeof body.timestamp === 'number' ? body.timestamp : body.timestamp);
    if (Number.isNaN(occurredAt.getTime())) { res.status(400).json({ success: false, message: 'Invalid RedX event time' }); return; }
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(['REDX', body.tracking_number, body.status, body.timestamp, body.invoice_number || ''])).digest('hex');
    const result = await prisma.$transaction(async tx => {
      const order = await tx.order.findFirst({ where: { courierName: 'REDX', courierConsignmentId: body.tracking_number } });
      if (order && body.invoice_number && order.orderNumber !== body.invoice_number) throw new Error('RedX event invoice does not match the booked order');
      const event = await tx.courierWebhookEvent.create({ data: {
        fingerprint, provider: 'REDX', event: body.status, orderId: order?.id,
        consignmentId: body.tracking_number, merchantOrderId: body.invoice_number,
        trackingMessage: (body.message_en || body.message_bn || '').slice(0, 2000), occurredAt,
      } });
      if (!order) return { matched: false, applied: false, eventId: event.id };
      const applied = await applyRedXStatus(tx, order, body.status, occurredAt);
      if (applied) await tx.courierWebhookEvent.update({ where: { id: event.id }, data: { applied: true } });
      return { matched: true, applied, eventId: event.id };
    });
    res.json({ success: true, ...result });
    if (result.applied) {
      void prisma.courierWebhookEvent.findUnique({ where: { id: result.eventId }, select: { orderId: true } })
        .then(event => event?.orderId ? notifyCourierEvent(event.orderId, body.status) : undefined)
        .catch(error => console.error('RedX SMS notification failed:', error));
    }
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { res.json({ success: true, duplicate: true }); return; }
    if (error.message === 'RedX event invoice does not match the booked order') { res.status(409).json({ success: false, message: error.message }); return; }
    console.error('RedX webhook processing failed:', error);
    res.status(500).json({ success: false, message: 'Could not process RedX webhook' });
  }
};
