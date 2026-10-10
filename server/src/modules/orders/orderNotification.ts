// Realtime notifications are hints to refetch authorized API data, not order exports.
export function orderNotification(order: { id: string; orderNumber: string; customerName: string; grandTotal: number }) {
  return { id: order.id, orderNumber: order.orderNumber, customerName: order.customerName, grandTotal: order.grandTotal };
}
