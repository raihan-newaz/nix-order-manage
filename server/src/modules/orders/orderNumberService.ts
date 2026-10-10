import prisma from '../../prisma';

/**
 * Generate the next sequential order number starting from 1000.
 * E.g. 1000, 1001, 1002, 1003...
 */
export async function getNextOrderNumber(tx?: any): Promise<string> {
  const client = tx || prisma;

  const orders = await client.order.findMany({
    select: { orderNumber: true },
  });

  let maxNum = 999;

  for (const o of orders) {
    const raw = String(o.orderNumber || '').trim();
    // Check purely numeric first
    if (/^\d+$/.test(raw)) {
      const num = parseInt(raw, 10);
      if (num >= 1000 && num < 10000000 && num > maxNum) {
        maxNum = num;
      }
    } else {
      const match = raw.match(/\b(\d{4,})\b/) || raw.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= 1000 && num < 10000000 && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return String(maxNum + 1);
}
