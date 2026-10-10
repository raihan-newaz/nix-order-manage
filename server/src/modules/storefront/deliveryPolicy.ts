export function landingDeliveryCharge(baseCharge: number, minimumQuantity: number, items: Array<{ quantity: number }>): number {
  const qualifies = Number.isInteger(minimumQuantity) && minimumQuantity > 0
    && items.reduce((total, item) => total + item.quantity, 0) >= minimumQuantity;
  return qualifies ? 0 : baseCharge;
}
