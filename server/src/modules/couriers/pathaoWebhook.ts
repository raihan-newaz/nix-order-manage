import crypto from 'crypto';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../prisma';
import { revealSecret } from '../../utils/security';
import { notifyCourierEvent } from '../messaging/messageService';

const supportedEvents = new Set([
  'order.created', 'order.updated', 'order.pickup-requested', 'order.assigned-for-pickup',
  'order.picked', 'order.pickup-failed', 'order.pickup-cancelled', 'order.at-the-sorting-hub',
  'order.in-transit', 'order.received-at-last-mile-hub', 'order.assigned-for-delivery',
  'order.delivered', 'order.partial-delivery', 'order.returned', 'order.delivery-failed',
  'order.on-hold', 'order.paid', 'order.paid-return', 'order.exchanged',
  'order.return-id-created', 'order.return-in-transit', 'order.returned-to-merchant',
  'store.created', 'store.updated',
]);

const payloadSchema = z.object({
  event: z.string().max(80).refine((value) => supportedEvents.has(value)),
  timestamp: z.string().datetime({ offset: true }),
  updated_at: z.string().max(40).optional(),
  consignment_id: z.string().min(1).max(100).optional(),
  return_consignment_id: z.string().max(100).optional(),
  merchant_order_id: z.string().max(100).optional(),
  store_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  delivery_fee: z.number().nonnegative().optional(),
  collected_amount: z.number().nonnegative().optional(),
  invoice_id: z.string().max(100).optional(),
  return_type: z.string().max(60).optional(),
  reason: z.string().max(2000).optional(),
  store_name: z.string().max(200).optional(),
  store_address: z.string().max(500).optional(),
  is_active: z.union([z.literal(0), z.literal(1), z.boolean()]).optional(),
}).superRefine((value, context) => {
  if (value.event.startsWith('order.') && !value.consignment_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Order event needs a consignment ID' });
  }
});

const equalSecret = (expected: string, received: string) => {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const statusFor = (event: string, current: string) => {
  const progress = ['PENDING', 'CONFIRMED', 'PACKAGING', 'HANDED_OVER', 'IN_TRANSIT', 'PARTIAL_DELIVERED', 'DELIVERED'];
  const advance = (target: string) => progress.indexOf(target) > progress.indexOf(current) ? target : current;
  if (['CANCELLED', 'RETURNED', 'FAKE_TRASH'].includes(current)) return current;
  if (event === 'order.created') return advance('CONFIRMED');
  if (event === 'order.delivered') return 'DELIVERED';
  if (event === 'order.returned-to-merchant') return 'RETURNED';
  if (current === 'DELIVERED') return current;
  if (event === 'order.partial-delivery') return advance('PARTIAL_DELIVERED');
  if (event === 'order.picked') return advance('HANDED_OVER');
  if (['order.at-the-sorting-hub', 'order.in-transit', 'order.received-at-last-mile-hub', 'order.assigned-for-delivery'].includes(event)) return advance('IN_TRANSIT');
  if (['order.on-hold', 'order.delivery-failed'].includes(event)) return 'HOLD';
  return current;
};

export const pathaoWebhookChallenge = async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await prisma.courierConfig.findUnique({ where: { provider: 'PATHAO' } });
    if (!config?.webhookVerificationSecret) { res.status(503).json({ success: false, message: 'Pathao webhook verification is not configured' }); return; }
    res.setHeader('X-Pathao-Merchant-Webhook-Integration-Secret', revealSecret(config.webhookVerificationSecret));
    res.json({ success: true, message: 'Pathao webhook endpoint ready' });
  } catch {
    res.status(500).json({ success: false, message: 'Could not verify Pathao webhook endpoint' });
  }
};

export const pathaoWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await prisma.courierConfig.findUnique({ where: { provider: 'PATHAO' } });
    if (!config?.webhookSecret || !config.webhookVerificationSecret) {
      res.status(503).json({ success: false, message: 'Pathao webhook is not configured' }); return;
    }
    const signature = req.header('X-PATHAO-Signature') || '';
    if (!equalSecret(revealSecret(config.webhookSecret), signature)) {
      res.status(401).json({ success: false, message: 'Invalid Pathao signature' }); return;
    }
    res.setHeader('X-Pathao-Merchant-Webhook-Integration-Secret', revealSecret(config.webhookVerificationSecret));
    const parsed = payloadSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, message: 'Invalid Pathao webhook event' }); return; }
    const body = parsed.data;
    const occurredAt = new Date(body.timestamp);
    const storeId = String(body.store_id);
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify([
      body.event, body.consignment_id || '', body.return_consignment_id || '',
      body.merchant_order_id || '', storeId, body.timestamp,
    ])).digest('hex');

    const result = await prisma.$transaction(async (tx) => {
      let order = body.consignment_id ? await tx.order.findFirst({ where: { courierName: 'PATHAO', courierConsignmentId: body.consignment_id } }) : null;
      if (!order && body.merchant_order_id) {
        order = await tx.order.findFirst({ where: {
          orderNumber: body.merchant_order_id, courierName: 'PATHAO', courierConsignmentId: null,
          courierStatus: { in: ['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'] },
        } });
      }
      if (order && ((body.merchant_order_id && body.merchant_order_id !== order.orderNumber) ||
        (order.courierStoreId && order.courierStoreId !== storeId))) {
        throw new Error('Pathao event does not match the booked order');
      }
      const event = await tx.courierWebhookEvent.create({ data: {
        fingerprint, provider: 'PATHAO', event: body.event, orderId: order?.id,
        consignmentId: body.consignment_id, returnConsignmentId: body.return_consignment_id,
        merchantOrderId: body.merchant_order_id, storeId, reason: body.reason,
        returnType: body.return_type, deliveryFee: body.delivery_fee,
        collectedAmount: body.collected_amount, invoiceId: body.invoice_id,
        storeName: body.store_name, storeAddress: body.store_address,
        storeActive: body.is_active === undefined ? undefined : Boolean(body.is_active), occurredAt,
      } });

      if (body.event.startsWith('store.') && config.storeId === storeId && body.is_active !== undefined) {
        const latestStoreEvent = await tx.courierWebhookEvent.findFirst({
          where: { provider: 'PATHAO', storeId, event: { startsWith: 'store.' } },
          orderBy: [{ occurredAt: 'desc' }, { receivedAt: 'desc' }], select: { id: true },
        });
        if (latestStoreEvent?.id === event.id) await tx.courierConfig.update({ where: { provider: 'PATHAO' }, data: { storeActive: Boolean(body.is_active) } });
      }
      if (!order || !body.event.startsWith('order.')) return { matched: false, applied: false, eventId: event.id };
      if (order.trashedAt) return { matched: true, applied: false, eventId: event.id };

      const nextStatus = statusFor(body.event, order.status);
      const isNewer = !order.courierEventAt || occurredAt > order.courierEventAt;
      if (!isNewer) return { matched: true, applied: false, eventId: event.id };
      const changed = await tx.order.updateMany({
        where: { id: order.id, OR: [{ courierEventAt: null }, { courierEventAt: { lt: occurredAt } }] },
        data: {
          courierStatus: body.event.replace(/^order\./, '').toUpperCase().replace(/-/g, '_'),
          courierEventAt: occurredAt,
          courierConsignmentId: order.courierConsignmentId || body.consignment_id,
          courierTrackingCode: order.courierTrackingCode || body.consignment_id,
          courierStoreId: order.courierStoreId || storeId,
          ...(body.return_consignment_id ? { courierReturnConsignmentId: body.return_consignment_id } : {}),
          ...(body.delivery_fee !== undefined ? { courierCharge: body.delivery_fee } : {}),
          ...(nextStatus !== order.status ? { status: nextStatus } : {}),
          ...(nextStatus === 'DELIVERED' && order.status !== 'DELIVERED' ? { deliveredAt: occurredAt } : {}),
          ...(body.event === 'order.delivered' && body.collected_amount !== undefined ? {
            paymentStatus: body.collected_amount + order.advancePaid >= order.grandTotal - 0.01 ? 'PAID' :
              body.collected_amount > 0 || order.advancePaid > 0 ? 'PARTIAL' : order.paymentStatus,
          } : {}),
          ...(nextStatus === 'RETURNED' && order.status !== 'RETURNED' ? { returnedAt: occurredAt } : {}),
        },
      });
      if (!changed.count) return { matched: true, applied: false, eventId: event.id };

      if (nextStatus === 'DELIVERED' && order.status !== 'DELIVERED' && order.customerId) {
        await tx.customer.update({ where: { id: order.customerId }, data: {
          completedOrders: { increment: 1 }, totalSpent: { increment: order.grandTotal },
        } });
      }
      if (nextStatus === 'RETURNED' && order.status !== 'RETURNED') {
        const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
        for (const item of items) {
          if (!item.productId) continue;
          await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
          if (item.variantId) await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQuantity: { increment: item.quantity } } });
          await tx.stockMovement.create({ data: {
            productId: item.productId, variantId: item.variantId, warehouseId: order.warehouseId,
            type: 'RETURN_RESTOCK', quantity: item.quantity, previousStock: 0, currentStock: 0,
            note: `Pathao return to merchant (${body.consignment_id})`,
          } });
        }
        if (order.customerId) await tx.customer.update({ where: { id: order.customerId }, data: {
          returnedOrders: { increment: 1 }, riskScore: { increment: 15 },
        } });
      }
      await tx.courierWebhookEvent.update({ where: { id: event.id }, data: { applied: true } });
      return { matched: true, applied: true, eventId: event.id };
    });
    res.json({ success: true, ...result });
    if (result.applied && body.consignment_id) {
      void prisma.order.findFirst({ where: { courierName: 'PATHAO', courierConsignmentId: body.consignment_id }, select: { id: true } })
        .then(order => order ? notifyCourierEvent(order.id, body.event) : undefined)
        .catch(error => console.error('Pathao SMS notification failed:', error));
    }
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.json({ success: true, duplicate: true }); return;
    }
    if (error.message === 'Pathao event does not match the booked order') {
      res.status(409).json({ success: false, message: error.message }); return;
    }
    console.error('Pathao webhook processing failed:', error);
    res.status(500).json({ success: false, message: 'Could not process Pathao webhook' });
  }
};
