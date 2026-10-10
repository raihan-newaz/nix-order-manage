import { randomUUID } from 'crypto';
import { Response } from 'express';
import prisma from '../../prisma';
import { AuthRequest } from '../../middlewares/auth';
import { logAudit } from '../audit/auditService';

type PurchaseInput = { productId: string; variantId: string | null; quantity: number; unitCost: number };

const clientError = (message: string): Error & { status: number } => Object.assign(new Error(message), { status: 400 });
const money = (value: number) => Math.round(value * 100) / 100;

export const createPurchaseOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    const supplierId = String(body.supplierId || '').trim();
    const warehouseId = body.warehouseId ? String(body.warehouseId) : null;
    const accountId = body.accountId ? String(body.accountId) : null;
    const rawItems = body.items;
    if (!supplierId || !Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 100) throw clientError('Choose a supplier and 1–100 products');

    const items: PurchaseInput[] = rawItems.map((item: any) => ({
      productId: String(item?.productId || '').trim(),
      variantId: item?.variantId ? String(item.variantId).trim() : null,
      quantity: Number(item?.quantity),
      unitCost: Number(item?.unitCost),
    }));
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100000 || !Number.isFinite(item.unitCost) || item.unitCost < 0) throw clientError('Each line needs a valid product, quantity, and unit cost');
      const key = `${item.productId}:${item.variantId || ''}`;
      if (seen.has(key)) throw clientError('Add each product and variation only once');
      seen.add(key);
    }
    const discount = Number(body.discount ?? 0);
    const tax = Number(body.tax ?? 0);
    const paid = Number(body.paidAmount ?? 0);
    if (![discount, tax, paid].every((value) => Number.isFinite(value) && value >= 0)) throw clientError('Discount, tax, and payment must be non-negative numbers');
    const totalAmount = money(items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0));
    const grandTotal = money(totalAmount + tax - discount);
    if (grandTotal < 0 || paid > grandTotal) throw clientError('Discount or payment exceeds the purchase total');
    if (paid > 0 && !accountId) throw clientError('Choose a payment account for a paid purchase');
    const purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : new Date();
    if (Number.isNaN(purchaseDate.getTime())) throw clientError('Invalid purchase date');
    const invoiceNumber = String(body.invoiceNumber || `PO-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`).trim();
    if (!invoiceNumber || invoiceNumber.length > 80) throw clientError('Invoice number must be 1–80 characters');

    const purchase = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) throw clientError('Supplier not found');
      if (warehouseId && !await tx.warehouse.findUnique({ where: { id: warehouseId } })) throw clientError('Warehouse not found');
      const account = accountId ? await tx.account.findUnique({ where: { id: accountId } }) : null;
      if (accountId && !account) throw clientError('Payment account not found');
      if (account && account.balance < paid) throw clientError('Payment account balance is too low');
      const existingInvoice = await tx.purchaseOrder.findUnique({ where: { invoiceNumber }, select: { id: true } });
      if (existingInvoice) throw clientError('Invoice number already exists');

      const resolved = [];
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, include: { variants: true } });
        if (!product || product.status === 'ARCHIVED') throw clientError('A selected product is unavailable');
        const variant = item.variantId ? product.variants.find((entry) => entry.id === item.variantId && entry.status !== 'ARCHIVED') : null;
        if (item.variantId && !variant) throw clientError(`Variation does not belong to ${product.name}`);
        if (product.productType === 'VARIABLE' && !variant) throw clientError(`Choose a variation for ${product.name}`);
        resolved.push({ item, product, variant });
      }

      const created = await tx.purchaseOrder.create({
        data: {
          invoiceNumber, supplierId, warehouseId, purchaseDate, totalAmount, discount, tax,
          grandTotal, paidAmount: paid, dueAmount: money(grandTotal - paid), status: 'RECEIVED',
          note: body.note ? String(body.note).trim() : null, createdById: req.user?.id,
          items: { create: resolved.map(({ item, product, variant }) => ({
            productId: product.id, variantId: variant?.id || null,
            productName: product.name, productSku: product.sku,
            variantName: variant?.name || null, variantSku: variant?.sku || null,
            quantity: item.quantity, unitCost: item.unitCost, totalCost: money(item.quantity * item.unitCost),
          })) },
        },
      });

      const variableProductIds = new Set<string>();
      for (const { item, product, variant } of resolved) {
        const oldStock = variant ? variant.stockQuantity : product.stockQuantity;
        const newStock = oldStock + item.quantity;
        const previousCost = variant ? variant.buyPrice : product.buyPrice;
        const weightedCost = money((Math.max(0, oldStock) * previousCost + item.quantity * item.unitCost) / newStock);
        if (variant) {
          await tx.productVariant.update({ where: { id: variant.id }, data: { stockQuantity: { increment: item.quantity }, buyPrice: weightedCost } });
          variableProductIds.add(product.id);
        } else {
          await tx.product.update({ where: { id: product.id }, data: { stockQuantity: { increment: item.quantity }, buyPrice: weightedCost } });
        }
        await tx.stockMovement.create({ data: {
          productId: product.id, variantId: variant?.id || null, productName: product.name, productSku: product.sku,
          variantName: variant?.name || null, variantSku: variant?.sku || null, warehouseId,
          type: 'PURCHASE_IN', quantity: item.quantity, previousStock: oldStock, currentStock: newStock,
          note: `Purchase ${invoiceNumber}`, createdById: req.user?.id,
        } });
      }
      for (const productId of variableProductIds) {
        const variants = await tx.productVariant.findMany({ where: { productId, status: { not: 'ARCHIVED' } }, select: { stockQuantity: true, buyPrice: true } });
        const stock = variants.reduce((sum, variant) => sum + variant.stockQuantity, 0);
        const inventoryValue = variants.reduce((sum, variant) => sum + variant.stockQuantity * variant.buyPrice, 0);
        await tx.product.update({ where: { id: productId }, data: { stockQuantity: stock, buyPrice: stock ? money(inventoryValue / stock) : 0 } });
      }
      await tx.supplier.update({ where: { id: supplierId }, data: {
        totalPurchased: { increment: grandTotal }, totalPaid: { increment: paid }, balanceDue: { increment: money(grandTotal - paid) },
      } });
      if (account && paid > 0) {
        const updated = await tx.account.update({ where: { id: account.id }, data: { balance: { decrement: paid } } });
        await tx.transaction.create({ data: {
          accountId: account.id, type: 'PURCHASE_PAYMENT', amount: paid, balanceAfter: updated.balance,
          referenceType: 'PURCHASE', referenceId: created.id, note: `Payment for Purchase Invoice #${invoiceNumber}`,
          createdById: req.user?.id,
        } });
      }
      return tx.purchaseOrder.findUniqueOrThrow({ where: { id: created.id }, include: { supplier: true, warehouse: true, items: { include: { product: true, variant: true } } } });
    }, { timeout: 30000 });

    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'CREATE', entity: 'PURCHASE', entityId: purchase.id, details: { invoiceNumber, grandTotal, paid, itemCount: items.length }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json({ success: true, message: 'Purchase recorded and product stock updated', purchase });
  } catch (error: any) {
    const status = error.status || (error.code === 'P2002' ? 409 : 500);
    res.status(status).json({ success: false, message: error.code === 'P2002' ? 'Invoice number already exists' : error.message });
  }
};
