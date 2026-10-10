import { Order, Prisma } from '@prisma/client';

const confirmedStatuses = new Set(['delivered', 'partial_delivered', 'cancelled']);
const returnReceivedStatuses = new Set(['cancelled_return_received', 'partial_delivered_return_received']);

export async function applySteadfastStatus(
  tx: Prisma.TransactionClient,
  order: Order,
  deliveryStatus: string,
  occurredAt: Date,
  details: { consignmentId?: string; trackingCode?: string; deliveryCharge?: number } = {},
) {
  const status = deliveryStatus.toLowerCase().trim();
  if (!status || status.length > 100 || order.trashedAt || ['CANCELLED', 'RETURNED', 'FAKE_TRASH'].includes(order.status)) return false;
  if (order.courierEventAt && occurredAt <= order.courierEventAt) return false;
  let nextStatus = order.status;
  if (status === 'delivered') nextStatus = 'DELIVERED';
  else if (status === 'partial_delivered' || status === 'partial_delivered_return_received') nextStatus = 'PARTIAL_DELIVERED';
  else if (status === 'cancelled_return_received') nextStatus = 'RETURNED';
  else if (status === 'hold' || status === 'exceptional') nextStatus = 'HOLD';
  else if (status === 'cancelled' && order.status !== 'DELIVERED') nextStatus = 'HOLD';
  else if (['pending', 'in_review'].includes(status) && order.status === 'PENDING') nextStatus = 'CONFIRMED';
  if (order.status === 'DELIVERED' && nextStatus !== 'RETURNED') nextStatus = 'DELIVERED';

  const changed = await tx.order.updateMany({
    where: { id: order.id, OR: [{ courierEventAt: null }, { courierEventAt: { lt: occurredAt } }] },
    data: {
      courierStatus: status.toUpperCase(), courierEventAt: occurredAt,
      ...(details.consignmentId && !order.courierConsignmentId ? { courierConsignmentId: details.consignmentId } : {}),
      ...(details.trackingCode && !order.courierTrackingCode ? { courierTrackingCode: details.trackingCode } : {}),
      ...(details.deliveryCharge !== undefined && Number.isFinite(details.deliveryCharge) ? { courierCharge: details.deliveryCharge } : {}),
      ...(nextStatus !== order.status ? { status: nextStatus } : {}),
      ...(nextStatus === 'DELIVERED' && order.status !== 'DELIVERED' ? { deliveredAt: occurredAt, paymentStatus: 'PAID' } : {}),
      ...(nextStatus === 'RETURNED' && order.status !== 'RETURNED' ? { returnedAt: occurredAt } : {}),
    },
  });
  if (!changed.count) return false;

  if (nextStatus === 'DELIVERED' && order.status !== 'DELIVERED' && order.customerId) {
    await tx.customer.update({ where: { id: order.customerId }, data: { completedOrders: { increment: 1 }, totalSpent: { increment: order.grandTotal } } });
  }
  if (nextStatus === 'RETURNED' && order.status !== 'RETURNED' && returnReceivedStatuses.has(status)) {
    const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
    for (const item of items) {
      if (!item.productId) continue;
      await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
      if (item.variantId) await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQuantity: { increment: item.quantity } } });
      await tx.stockMovement.create({ data: { productId: item.productId, variantId: item.variantId, warehouseId: order.warehouseId, type: 'RETURN_RESTOCK', quantity: item.quantity, previousStock: 0, currentStock: 0, note: `Steadfast return received (${order.courierConsignmentId || order.orderNumber})` } });
    }
    if (order.customerId) await tx.customer.update({ where: { id: order.customerId }, data: { returnedOrders: { increment: 1 }, riskScore: { increment: 15 } } });
  }
  return true;
}

export const isSteadfastConfirmedOutcome = (status: string) => confirmedStatuses.has(status.toLowerCase());
