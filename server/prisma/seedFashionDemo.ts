import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const mediaRoot = path.resolve(__dirname, '../uploads/media');
const products = [
  { name: 'Noir Flow Abaya', category: 'Dresses', image: 'demo-abaya.png', sizes: ['S', 'M', 'L', 'XL'], cost: 1350, regular: 2890, sale: 2490, color: 'Black', description: 'A graceful, full-length abaya in softly textured crepe with a clean drape and a matching waist tie.' },
  { name: 'Sage Linen Co-ord Set', category: 'Shirts & Tops', image: 'demo-linen-set.png', sizes: ['S', 'M', 'L', 'XL'], cost: 1180, regular: 2490, sale: 2190, color: 'Sage', description: 'A relaxed linen-blend shirt and wide-leg trouser set made for easy, polished everyday wear.' },
  { name: 'Navy Embroidered Kurta Set', category: 'Dresses', image: 'demo-kurta-set.png', sizes: ['S', 'M', 'L', 'XL'], cost: 1480, regular: 3190, sale: 2790, color: 'Navy', description: 'A deep navy kurta set finished with delicate embroidery and a lightweight coordinating dupatta.' },
  { name: 'Blue Stripe Cotton Shirt', category: 'Shirts & Tops', image: 'demo-striped-shirt.png', sizes: ['S', 'M', 'L', 'XL'], cost: 720, regular: 1690, sale: 1490, color: 'Blue', description: 'An airy oversized cotton shirt with fine blue stripes, a neat collar and an easy everyday fit.' },
  { name: 'Light Wash Straight Jeans', category: 'Bottoms', image: 'demo-denim-jeans.png', sizes: ['28', '30', '32', '34', '36'], cost: 1020, regular: 2290, sale: 1990, color: 'Blue', description: 'A high-rise, straight-leg denim staple in a soft light-indigo wash with classic five-pocket details.' },
  { name: 'Dusty Rose Satin Midi Dress', category: 'Dresses', image: 'demo-satin-dress.png', sizes: ['S', 'M', 'L', 'XL'], cost: 1260, regular: 2790, sale: 2390, color: 'Blush', description: 'A softly lustrous midi dress with long sleeves, a fluid skirt and a comfortable defined waist.' },
  { name: 'Forest Knit Cardigan', category: 'Knitwear', image: 'demo-cardigan.png', sizes: ['S', 'M', 'L', 'XL'], cost: 1120, regular: 2490, sale: 2190, color: 'Olive', description: 'A cozy cable-textured knit cardigan with a relaxed shape and sturdy button fastening.' },
  { name: 'Caramel Everyday Crossbody', category: 'Accessories', image: 'demo-crossbody-bag.png', sizes: ['Mini', 'Regular', 'Large'], cost: 890, regular: 1990, sale: 1690, color: 'Caramel', description: 'A structured crossbody bag with a pebbled finish, adjustable strap and polished metal clasp.' },
  { name: 'Ivory Low-top Sneakers', category: 'Footwear', image: 'demo-sneakers.png', sizes: ['36', '37', '38', '39', '40', '41'], cost: 980, regular: 2190, sale: 1890, color: 'Off White', description: 'Minimal low-top sneakers with a soft ivory upper, comfortable lining and a durable tonal sole.' },
  { name: 'Terracotta Floral Chiffon Scarf', category: 'Accessories', image: 'demo-scarf.png', sizes: ['180 cm', '200 cm'], cost: 390, regular: 990, sale: 790, color: 'Terracotta', description: 'A light, floaty chiffon scarf in a warm terracotta floral print, easy to style through every season.' },
];

const main = async () => {
  const existingDemo = await prisma.product.count({ where: { sku: { startsWith: 'NIX-DEMO-' } } });
  if (existingDemo) throw new Error(`Found ${existingDemo} existing NIX-DEMO products; stopping to avoid duplicate demo records.`);
  for (const product of products) {
    if (!fs.existsSync(path.join(mediaRoot, product.image))) throw new Error(`Missing media file: ${product.image}`);
  }

  const created = await prisma.$transaction(async (tx) => {
    const purchasePayments = await tx.transaction.findMany({ where: { referenceType: 'PURCHASE' }, select: { id: true, accountId: true, amount: true } });
    const accountRefunds = new Map<string, number>();
    for (const payment of purchasePayments) accountRefunds.set(payment.accountId, (accountRefunds.get(payment.accountId) || 0) + payment.amount);
    for (const [accountId, amount] of accountRefunds) await tx.account.update({ where: { id: accountId }, data: { balance: { increment: amount } } });
    await tx.transaction.deleteMany({ where: { referenceType: 'PURCHASE' } });
    await tx.purchaseOrder.deleteMany({});
    await tx.stockMovement.deleteMany({ where: { type: 'PURCHASE_IN' } });
    await tx.supplier.updateMany({ data: { totalPurchased: 0, totalPaid: 0, balanceDue: 0 } });

    const attributes = await tx.productAttribute.findMany({ where: { name: { in: ['Size', 'Color'] } } });
    const sizeAttribute = attributes.find((attribute) => attribute.name === 'Size');
    const colorAttribute = attributes.find((attribute) => attribute.name === 'Color');
    if (!sizeAttribute || !colorAttribute) throw new Error('Global Size and Color attributes are required before seeding the catalogue.');
    const sizeOptions = [...new Set([...JSON.parse(sizeAttribute.options), ...products.flatMap((product) => product.sizes)])];
    const colorOptions = [...new Set([...JSON.parse(colorAttribute.options), ...products.map((product) => product.color)])];
    await tx.productAttribute.update({ where: { id: sizeAttribute.id }, data: { options: JSON.stringify(sizeOptions) } });
    await tx.productAttribute.update({ where: { id: colorAttribute.id }, data: { options: JSON.stringify(colorOptions) } });

    const defaultWarehouse = await tx.warehouse.findFirst({ where: { isDefault: true } });
    const records = [] as Array<{ product: any; imageUrl: string }>;
    for (let index = 0; index < products.length; index++) {
      const item = products[index];
      const imageUrl = `/uploads/media/${item.image}`;
      const fileSize = fs.statSync(path.join(mediaRoot, item.image)).size;
      await tx.mediaAsset.upsert({ where: { url: imageUrl }, update: { fileName: item.image, mimeType: 'image/png', size: fileSize, altText: item.name }, create: { fileName: item.image, url: imageUrl, altText: item.name, mimeType: 'image/png', size: fileSize } });
      const sku = `NIX-DEMO-${String(index + 1).padStart(3, '0')}`;
      const variants = item.sizes.map((size) => ({
        name: `${item.color} / ${size}`, sku: `${sku}-${size.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
        color: item.color, size, attributes: JSON.stringify({ Color: item.color, Size: size }),
        buyPrice: item.cost, regularPrice: item.regular, salePrice: item.sale,
        stockQuantity: 12, minStockThreshold: 3, image: imageUrl, status: 'ACTIVE',
      }));
      const product = await tx.product.create({ data: {
        name: item.name, sku, category: item.category,
        description: item.description, productType: 'VARIABLE', status: 'ACTIVE',
        buyPrice: item.cost, regularPrice: item.regular, salePrice: item.sale,
        stockQuantity: variants.length * 12, minStockThreshold: 5,
        image: imageUrl, gallery: JSON.stringify([imageUrl]),
        metaTitle: item.name, metaDescription: item.description,
        attributes: JSON.stringify([
          { attributeId: colorAttribute.id, name: 'Color', options: [item.color], visible: true, variation: true },
          { attributeId: sizeAttribute.id, name: 'Size', options: item.sizes, visible: true, variation: true },
        ]),
        variants: { create: variants },
      }, include: { variants: true } });
      records.push({ product, imageUrl });
    }

    for (let index = 0; index < records.length; index++) {
      const { product } = records[index];
      const variant = product.variants[(index + 1) % product.variants.length];
      const quantity = index % 3 === 0 ? 2 : 1;
      const customerPhone = `01700000${String(index + 1).padStart(3, '0')}`;
      const customerName = `Demo Customer ${String(index + 1).padStart(2, '0')}`;
      const customer = await tx.customer.create({ data: {
        name: customerName, phone: customerPhone,
        address: `${index + 1} Sample Road, Dhanmondi`, district: 'Dhaka', city: 'Dhaka',
        totalOrders: 1, completedOrders: 0, cancelledOrders: 0, returnedOrders: 0, totalSpent: 0,
      } });
      const previousVariantStock = variant.stockQuantity;
      const nextVariantStock = previousVariantStock - quantity;
      const previousProductStock = product.stockQuantity;
      const nextProductStock = previousProductStock - quantity;
      await tx.productVariant.update({ where: { id: variant.id }, data: { stockQuantity: nextVariantStock } });
      await tx.product.update({ where: { id: product.id }, data: { stockQuantity: nextProductStock } });
      await tx.stockMovement.create({ data: {
        productId: product.id, variantId: variant.id, productName: product.name, productSku: product.sku,
        variantName: variant.name, variantSku: variant.sku, warehouseId: defaultWarehouse?.id || null,
        type: 'SALE_DEDUCTION', quantity: -quantity, previousStock: previousVariantStock, currentStock: nextVariantStock,
        note: `Demo order seed stock deduction`,
      } });
      const unitPrice = variant.salePrice || variant.regularPrice;
      const orderNumber = `NX-DEMO-${Date.now()}-${String(index + 1).padStart(2, '0')}`;
      await tx.order.create({ data: {
        orderNumber, customerId: customer.id, customerName, customerPhone,
        customerAddress: customer.address || '', district: 'Dhaka', city: 'Dhaka',
        status: 'PENDING', priority: index === 0 ? 'URGENT' : 'NORMAL', paymentMethod: 'COD', paymentStatus: 'PENDING',
        subtotal: unitPrice * quantity, discount: 0, deliveryCharge: 60, grandTotal: unitPrice * quantity + 60,
        advancePaid: 0, codAmount: unitPrice * quantity + 60,
        cogsCost: variant.buyPrice * quantity, warehouseId: defaultWarehouse?.id || null,
        internalNote: 'DEMO DATA: local test order; do not dispatch.', labels: JSON.stringify(['DEMO']),
        items: { create: [{
          productId: product.id, variantId: variant.id, productName: product.name, variantName: variant.name,
          color: variant.color, size: variant.size, productSku: variant.sku,
          quantity, unitPrice, unitBuyPrice: variant.buyPrice,
          totalPrice: unitPrice * quantity, totalBuyPrice: variant.buyPrice * quantity,
        }] },
      } });
    }
    return { products: records.length, variants: records.reduce((sum, record) => sum + record.product.variants.length, 0), orders: records.length };
  }, { timeout: 60000 });
  console.log(JSON.stringify({ ...created, purchaseRecordsCleared: true, staleSupplierTotalsReset: true, mediaAssetsRegistered: true }));
};

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
