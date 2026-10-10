import prisma from '../prisma';

const defaults = [
  ['ORDER_PLACED', 'Order received', 'NIX: Order {order_number} received. Total Tk {grand_total}.'],
  ['ORDER_CONFIRMED', 'Order confirmed', 'NIX: Order {order_number} confirmed.'],
  ['ORDER_PACKAGING', 'Packing started', 'NIX: Order {order_number} is being packed.'],
  ['ORDER_HANDED_OVER', 'Courier picked up', 'NIX: Courier picked up order {order_number}.'],
  ['DISPATCHED_TRACKING', 'Courier booked', 'NIX: Order {order_number} sent via {courier_name}. Track: {tracking_code}.'],
  ['ORDER_IN_TRANSIT', 'In transit', 'NIX: Order {order_number} is in transit.'],
  ['OUT_FOR_DELIVERY', 'Out for delivery', 'NIX: Order {order_number} is out for delivery.'],
  ['DELIVERED_THANK_YOU', 'Delivered', 'NIX: Order {order_number} delivered. Thank you!'],
  ['ORDER_PARTIAL_DELIVERED', 'Partly delivered', 'NIX: Order {order_number} was partly delivered. Contact support if needed.'],
  ['ORDER_HOLD', 'On hold', 'NIX: Order {order_number} is on hold. We will contact you.'],
  ['ORDER_CANCELLED', 'Cancelled', 'NIX: Order {order_number} cancelled.'],
  ['ORDER_RETURNED', 'Returned', 'NIX: Order {order_number} returned.'],
  ['PAYMENT_RECEIVED', 'Payment received', 'NIX: Payment for order {order_number} received.'],
] as const;

async function main() {
  await prisma.messageGatewayConfig.upsert({ where: { type: 'GREENWEB' },
    create: { type: 'GREENWEB', apiUrl: 'https://api.bdbulksms.net/api.php?json', isEnabled: false, isDefault: true },
    update: { apiUrl: 'https://api.bdbulksms.net/api.php?json' } });
  let created = 0;
  for (const [eventTrigger, name, body] of defaults) {
    const existing = await prisma.messageTemplate.findFirst({ where: { eventTrigger, channel: 'SMS' } });
    if (existing) continue;
    await prisma.messageTemplate.create({ data: { eventTrigger, name, body, channel: 'SMS', isActive: true } });
    created++;
  }
  console.log(`GreenSMS gateway ready (disabled until token); ${created} short SMS templates added`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
