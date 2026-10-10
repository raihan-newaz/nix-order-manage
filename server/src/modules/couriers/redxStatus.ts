import { Order, Prisma } from '@prisma/client';

const normalized = (value: string) => value.trim().toLowerCase().replace(/_/g, '-');
export const redxOrderStatus = (value: string, current: string) => {
  const status = normalized(value);
  if (current === 'RETURNED' || current === 'CANCELLED') return current;
  if (status === 'delivered') return 'DELIVERED';
  if (current === 'DELIVERED') return current;
  if (status === 'returned') return 'RETURNED';
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'partial-delivery') return 'PARTIAL_DELIVERED';
  if (['agent-hold', 'agent-area-change'].includes(status)) return 'HOLD';
  if (['delivery-in-progress', 'agent-returning'].includes(status)) return 'IN_TRANSIT';
  if (status === 'ready-for-delivery' && ['PENDING', 'CONFIRMED', 'PACKAGING'].includes(current)) return 'HANDED_OVER';
  return current;
};

export async function applyRedXStatus(tx: Prisma.TransactionClient, order: Order, status: string, occurredAt: Date, charge?: number) {
  if (order.trashedAt || !status || status.length > 100 || (order.courierEventAt && occurredAt <= order.courierEventAt)) return false;
  const next = redxOrderStatus(status, order.status);
  const updated = await tx.order.updateMany({ where: { id: order.id, courierName: 'REDX', OR: [{ courierEventAt: null }, { courierEventAt: { lt: occurredAt } }] },
    data: { courierStatus: normalized(status).toUpperCase().replace(/-/g, '_'), courierEventAt: occurredAt,
      ...(charge !== undefined && Number.isFinite(charge) && charge >= 0 ? { courierCharge: charge } : {}),
      ...(next !== order.status ? { status: next } : {}),
      ...(next === 'DELIVERED' && order.status !== 'DELIVERED' ? { deliveredAt: occurredAt } : {}),
      ...(next === 'RETURNED' && order.status !== 'RETURNED' ? { returnedAt: occurredAt } : {}),
      ...(next === 'CANCELLED' && order.status !== 'CANCELLED' ? { cancelledAt: occurredAt } : {}),
    } });
  if (!updated.count) return false;
  if (next === 'DELIVERED' && order.status !== 'DELIVERED' && order.customerId) {
    await tx.customer.update({ where: { id: order.customerId }, data: { completedOrders: { increment: 1 }, totalSpent: { increment: order.grandTotal } } });
  }
  if (next === 'RETURNED' && order.status !== 'RETURNED' && order.customerId) {
    await tx.customer.update({ where: { id: order.customerId }, data: { returnedOrders: { increment: 1 }, riskScore: { increment: 15 } } });
  }
  return true;
}
