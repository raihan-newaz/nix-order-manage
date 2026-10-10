import { orderNotification } from '../orders/orderNotification';
import { landingDeliveryCharge } from './deliveryPolicy';
import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../prisma';
import { io } from '../../server';
import { initiateUddoktaPayment } from './uddoktaPayment';
import { getNextOrderNumber } from '../orders/orderNumberService';
import { sendOrderNotification } from '../messaging/messageService';
import { calculateLandingDiscount } from './landingCouponController';
import { generateEventId } from './metaConversionsApi';
import { revealSecret } from '../../utils/security';
import { productSlug } from '../inventory/productValidation';
export { productSlug } from '../inventory/productValidation';

const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(10).max(18),
    address: z.string().trim().min(8).max(300),
    district: z.string().trim().max(80).optional(),
    city: z.string().trim().max(80).optional(),
    note: z.string().trim().max(500).optional(),
    email: z
      .string()
      .trim()
      .email('Invalid email address')
      .max(160)
      .optional()
      .or(z.literal(''))
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : undefined)),
  }).passthrough(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable().optional(),
    quantity: z.number().int().min(1).max(10),
  })).min(1).max(20),
  paymentMethod: z.enum(['COD', 'UDDOKTAPAY']).default('COD'),
  deliveryArea: z.enum(['OUTSIDE_DHAKA', 'SUB_AREA', 'DHAKA_CITY']).optional(),
  pageSlug: z.string().min(1).max(120).optional(),
  couponCode: z.string().trim().toUpperCase().max(40).optional(),
  idempotencyKey: z.string().trim().max(160).optional(),
  _eventId: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/).optional(),
  _fbc: z.string().max(500).optional(),
  _fbp: z.string().max(500).optional(),
  _trackingConsent: z.boolean().optional(),
});

interface IdempotencyRecord {
  payloadHash: string;
  response: {
    success: boolean;
    message: string;
    order: {
      orderNumber: string;
      status: string;
      subtotal: number;
      deliveryCharge: number;
      grandTotal: number;
      paymentMethod: string;
    };
    paymentUrl?: string;
  };
  createdAt: number;
}

const checkoutIdempotencyStore = new Map<string, IdempotencyRecord>();
const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;

const cleanExpiredIdempotency = () => {
  const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
  for (const [key, record] of checkoutIdempotencyStore.entries()) {
    if (record.createdAt < cutoff) checkoutIdempotencyStore.delete(key);
  }
};

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

const sellingPrice = (salePrice: number, regularPrice: number) =>
  salePrice > 0 ? salePrice : regularPrice;

const plainText = (value?: string | null) => (value || '')
  .replace(/<br\s*\/?\s*>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#039;|&apos;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim();

const storefrontImage = (url?: string | null) =>
  url && !/^https?:\/\/(www\.)?nix\.bd\/wp-content\/uploads\//i.test(url) ? url : null;

const attributeColorsFor = async (products: any[]) => {
  const ids = [...new Set(products.flatMap(product => parseJson<any[]>(product.attributes, []).map(attribute => attribute.attributeId).filter(Boolean)))];
  if (!ids.length) return new Map<string, Record<string, string>>();
  const attributes = await prisma.productAttribute.findMany({ where: { id: { in: ids } }, select: { id: true, optionColors: true } });
  return new Map(attributes.map(attribute => [attribute.id, parseJson<Record<string, string>>(attribute.optionColors, {})]));
};

export const publicProduct = (product: any, currentColors = new Map<string, Record<string, string>>()) => ({
  id: product.id,
  name: product.name,
  slug: product.slug || productSlug(product.name, product.id),
  sku: product.sku,
  description: plainText(product.description),
  gallery: parseJson<string[]>(product.gallery, []).map(storefrontImage).filter(Boolean),
  metaTitle: product.metaTitle,
  metaDescription: product.metaDescription,
  category: product.category || 'Fashion',
  productType: product.productType,
  attributes: parseJson<any[]>(product.attributes, []).map(attribute => ({
    ...attribute,
    optionColors: { ...(attribute.optionColors || {}), ...(currentColors.get(attribute.attributeId) || {}) },
  })),
  regularPrice: product.regularPrice,
  salePrice: sellingPrice(product.salePrice, product.regularPrice),
  stockQuantity: Math.max(0, product.stockQuantity),
  image: storefrontImage(product.image),
  inStock: product.stockQuantity > 0 && (product.productType === 'VARIABLE'
    ? product.variants.some((variant: any) => variant.status === 'ACTIVE' && variant.stockQuantity > 0 && sellingPrice(variant.salePrice, variant.regularPrice) > 0)
    : sellingPrice(product.salePrice, product.regularPrice) > 0),
  variants: product.variants.map((variant: any) => ({
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    color: variant.color,
    size: variant.size,
    attributes: parseJson(variant.attributes, {}),
    regularPrice: variant.regularPrice,
    salePrice: sellingPrice(variant.salePrice, variant.regularPrice),
    stockQuantity: Math.max(0, variant.stockQuantity),
    image: storefrontImage(variant.image || product.image),
    inStock: variant.status === 'ACTIVE' && variant.stockQuantity > 0 && sellingPrice(variant.salePrice, variant.regularPrice) > 0,
  })),
});


export const normalizePhone = (raw: string) => {
  let phone = raw.replace(/[^\d+]/g, '');
  if (phone.startsWith('+880')) phone = `0${phone.slice(4)}`;
  if (phone.startsWith('880')) phone = `0${phone.slice(3)}`;
  if (!/^01[3-9]\d{8}$/.test(phone)) throw new Error('Please enter a valid Bangladesh mobile number');
  return phone;
};

const dhakaSubAreaPattern = /\b(savar|sabhar|ashulia|tongi|keraniganj|amin bazar|hemayetpur|dhamrai|dohar|nawabganj)\b/i;
const deliveryChargeFor = (district: string, area: string, insideDhaka: number, subArea: number, outsideDhaka: number) => {
  if (district.trim().toLowerCase() !== 'dhaka') return outsideDhaka;
  return dhakaSubAreaPattern.test(area) ? subArea : insideDhaka;
};

export const listStorefrontProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const sort = String(req.query.sort || '').trim();
    const take = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 24, 1), 60);
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        ...(category ? { category } : {}),
        ...(search ? { OR: [{ name: { contains: search } }, { description: { contains: search } }, { category: { contains: search } }] } : {}),
      },
      include: { variants: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    const sales = sort === 'best-selling'
      ? await prisma.orderItem.groupBy({ by: ['productId'], where: { productId: { not: null } }, _sum: { quantity: true } })
      : [];
    const salesByProduct = new Map(sales.map((entry) => [entry.productId, entry._sum.quantity || 0]));
    const sorted = sort === 'best-selling'
      ? [...products].sort((a, b) => (salesByProduct.get(b.id) || 0) - (salesByProduct.get(a.id) || 0))
      : products;
    const currentColors = await attributeColorsFor(sorted);
    res.json({ success: true, products: sorted.map(product => publicProduct(product, currentColors)) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStorefrontProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawKey = String(req.params.id || '').trim();
    const key = rawKey;
    let product = await prisma.product.findFirst({
      where: {
        OR: [
          { slug: key },
          { id: key },
          { id: rawKey },
          { name: key },
          { sku: key }
        ],
        status: 'ACTIVE'
      },
      include: { variants: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } } },
    });
    if (!product) {
      const legacy = await prisma.product.findMany({
        where: { status: 'ACTIVE', slug: null },
        select: { id: true, name: true },
      });
      const match = legacy.find((p) => productSlug(p.name, p.id).toLowerCase() === key.toLowerCase());
      if (match) product = await prisma.product.findUnique({
        where: { id: match.id },
        include: { variants: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } } },
      });
    }
    if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return; }
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    const categoryTrail: Array<{ name: string; slug: string }> = [];
    const matchedCategory = await prisma.category.findUnique({ where: { name: product.category || 'Fashion' }, select: { id: true, name: true, slug: true, parentId: true } });
    let category: { id: string; name: string; slug: string; parentId: string | null } | null = matchedCategory;
    const seen = new Set<string>();
    while (category && !seen.has(category.id) && categoryTrail.length < 6) {
      seen.add(category.id);
      categoryTrail.unshift({ name: category.name, slug: category.slug });
      const parentId = category.parentId;
      if (!parentId) { category = null; continue; }
      const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { id: true, name: true, slug: true, parentId: true } });
      category = parent;
    }
    const currentColors = await attributeColorsFor([product]);
    res.json({ success: true, product: { ...publicProduct(product, currentColors), categoryTrail } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const trackStorefrontOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const orderNumber = String(req.params.orderNumber || '').trim().toUpperCase();
    const phone = normalizePhone(String(req.query.phone || ''));
    if (!orderNumber) { res.status(400).json({ success: false, message: 'Enter your order number' }); return; }
    const order = await prisma.order.findFirst({
      where: { orderNumber, customerPhone: phone, trashedAt: null },
      select: {
        orderNumber: true, status: true, paymentStatus: true, grandTotal: true, deliveryCharge: true, createdAt: true, courierTrackingCode: true,
        items: { select: { productId: true, productName: true, quantity: true, unitPrice: true, product: { select: { image: true } }, variant: { select: { image: true } } } },
      },
    });
    if (!order) { res.status(404).json({ success: false, message: 'No order found with that order number and mobile number' }); return; }
    res.json({ success: true, order: { ...order, items: order.items.map(item => ({ productId: item.productId, productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, image: storefrontImage(item.variant?.image || item.product?.image) })) } });
  } catch (error: any) {
    const message = /valid Bangladesh/.test(error.message) ? error.message : 'We could not look up that order';
    res.status(400).json({ success: false, message });
  }
};

export const createStorefrontOrder = async (req: Request & { customer?: { id: string; phone: string } }, res: Response): Promise<void> => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid checkout information' });
    return;
  }

  try {
    const { customer: inputCustomer, items, paymentMethod, deliveryArea, pageSlug, couponCode } = parsed.data;
    const rawIdempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || parsed.data.idempotencyKey;
    const idempotencyKey = rawIdempotencyKey ? String(rawIdempotencyKey).trim() : '';

    let payloadFingerprint = '';
    if (idempotencyKey) {
      cleanExpiredIdempotency();
      payloadFingerprint = JSON.stringify({
        phone: inputCustomer.phone,
        address: inputCustomer.address,
        items: items.map(i => ({ p: i.productId, v: i.variantId || null, q: i.quantity })).sort((a, b) => a.p.localeCompare(b.p)),
        paymentMethod,
        deliveryArea,
        pageSlug,
        couponCode,
      });

      const existingRecord = checkoutIdempotencyStore.get(idempotencyKey);
      if (existingRecord) {
        if (existingRecord.payloadHash === payloadFingerprint) {
          res.status(200).json(existingRecord.response);
          return;
        } else {
          res.status(409).json({ success: false, message: 'Idempotency conflict: this key has already been used with different checkout data' });
          return;
        }
      }
    }

    let landingPageId: string | undefined;
    let freeDeliveryMinQuantity = 0;
    if (pageSlug) {
      const page = await prisma.storePage.findUnique({ where: { slug: pageSlug } });
      if (!page || !page.slug.startsWith('flow-') || page.status !== 'PUBLISHED' || !page.isActive) { res.status(404).json({ success: false, message: 'Landing page is unavailable' }); return; }
      const checkout = (JSON.parse(page.blocks) as any[]).find((block) => block.type === 'CHECKOUT');
      const distinctIds = [...new Set(items.map((item) => item.productId))];
      const max = checkout?.selection === 'SINGLE' ? 1 : checkout?.maxProducts ?? checkout?.productIds?.length ?? 0;
      if (!checkout || distinctIds.length < (checkout.minProducts ?? 1) || distinctIds.length > max || distinctIds.some((id) => !checkout.productIds.includes(id)) || items.some((item) => items.filter((candidate) => candidate.productId === item.productId).length > 1)) { res.status(400).json({ success: false, message: 'Product selection does not match this landing page' }); return; }
      if (checkout.paymentMethods?.length && !checkout.paymentMethods.includes(paymentMethod)) { res.status(400).json({ success: false, message: 'Payment method is not available on this page' }); return; }
      if (couponCode && checkout.couponEnabled === false) { res.status(400).json({ success: false, message: 'Coupons are disabled on this page' }); return; }
      landingPageId = page.id;
      freeDeliveryMinQuantity = checkout.freeDeliveryMinQuantity || 0;
    } else if (couponCode) { res.status(400).json({ success: false, message: 'Coupon requires a landing page' }); return; }
    const phone = normalizePhone(inputCustomer.phone);
    const accountCustomerId = req.customer?.phone === phone ? req.customer.id : null;
    const settings = await prisma.storefrontSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
    const checkoutConfig = parseJson<any>(settings.themeConfig, {}).checkoutFields || [];
    const districtField = checkoutConfig.find((field: any) => field.key === 'district');
    if (districtField?.enabled && districtField.required && !inputCustomer.district?.trim()) {
      res.status(400).json({ success: false, message: `${districtField.label || 'District'} is required` }); return;
    }
    for (const field of checkoutConfig.filter((item: any) => item.enabled && item.custom)) {
      const value = String((inputCustomer as any)[field.key] ?? '').trim();
      if (field.required && !value) { res.status(400).json({ success: false, message: `${field.label} is required` }); return; }
      if (value.length > 500) { res.status(400).json({ success: false, message: `${field.label} is too long` }); return; }
      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { res.status(400).json({ success: false, message: `Enter a valid ${field.label.toLowerCase()}` }); return; }
      if (field.type === 'select' && value && !(field.options || []).includes(value)) { res.status(400).json({ success: false, message: `Choose a valid ${field.label.toLowerCase()}` }); return; }
    }
    const checkoutDetails = checkoutConfig.filter((field: any) => field.enabled && field.custom).reduce((details: Record<string, any>, field: any) => {
      const value = String((inputCustomer as any)[field.key] ?? '').trim();
      if (value) details[field.label] = value;
      return details;
    }, {});
    const trackingEventId = parsed.data._eventId || generateEventId();
    checkoutDetails.__tracking = {
      consent: Boolean(parsed.data._trackingConsent),
      ...(parsed.data._trackingConsent ? {
        eventId: trackingEventId,
        fbc: parsed.data._fbc || undefined,
        fbp: parsed.data._fbp || undefined,
        coupon: parsed.data.couponCode || undefined,
        sourceUrl: req.headers.referer || req.headers.origin || undefined,
        clientIpAddress: req.ip || req.socket.remoteAddress || undefined,
        clientUserAgent: req.headers['user-agent'] || undefined,
      } : {}),
    };
    if (paymentMethod === 'UDDOKTAPAY' && (!settings.uddoktaEnabled || !settings.uddoktaApiKey || !settings.uddoktaBaseUrl || !inputCustomer.email)) {
      res.status(400).json({ success: false, message: 'Online payment is unavailable or a valid email is missing' }); return;
    }
    const baseDeliveryCharge = deliveryArea === 'OUTSIDE_DHAKA' ? settings.outsideDhakaCharge
      : deliveryArea === 'SUB_AREA' ? settings.subAreaCharge
        : deliveryArea === 'DHAKA_CITY' ? settings.insideDhakaCharge
          : deliveryChargeFor(inputCustomer.district || '', inputCustomer.city || '', settings.insideDhakaCharge, settings.subAreaCharge, settings.outsideDhakaCharge);

    const deliveryCharge = landingDeliveryCharge(baseDeliveryCharge, freeDeliveryMinQuantity, items);

    const order = await prisma.$transaction(async (tx) => {
      const existingCustomer = await tx.customer.findUnique({ where: { phone } });
      const recentOrder = await tx.order.findFirst({
        where: { customerPhone: phone, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });

      const customer = await tx.customer.upsert({
        where: { phone },
        update: existingCustomer?.password && !accountCustomerId
          ? { totalOrders: { increment: 1 } }
          : {
              name: inputCustomer.name,
              address: inputCustomer.address,
              district: inputCustomer.district || null,
              city: inputCustomer.city,
              ...(inputCustomer.email ? { email: inputCustomer.email } : {}),
              totalOrders: { increment: 1 },
            },
        create: {
          name: inputCustomer.name,
          phone,
          address: inputCustomer.address,
          district: inputCustomer.district || null,
          city: inputCustomer.city,
          email: inputCustomer.email || null,
          totalOrders: 1,
        },
      });

      let subtotal = 0;
      let cogsCost = 0;
      const orderItems: any[] = [];

      for (const requested of items) {
        const product = await tx.product.findFirst({
          where: { id: requested.productId, status: 'ACTIVE' },
          include: { variants: true },
        });
        if (!product) throw new Error('A product in your cart is no longer available');

        const variant = requested.variantId
          ? product.variants.find((entry) => entry.id === requested.variantId && entry.status === 'ACTIVE')
          : null;
        if (product.productType === 'VARIABLE' && !variant) throw new Error(`Please select a variation for ${product.name}`);

        const availableStock = variant ? variant.stockQuantity : product.stockQuantity;
        if (availableStock < requested.quantity) throw new Error(`Only ${availableStock} item(s) left for ${product.name}`);

        if (variant) {
          const changed = await tx.productVariant.updateMany({
            where: { id: variant.id, status: 'ACTIVE', stockQuantity: { gte: requested.quantity } },
            data: { stockQuantity: { decrement: requested.quantity } },
          });
          if (changed.count !== 1) throw new Error(`${product.name} just went out of stock`);
        }
        const changedProduct = await tx.product.updateMany({
          where: { id: product.id, status: 'ACTIVE', stockQuantity: { gte: requested.quantity } },
          data: { stockQuantity: { decrement: requested.quantity } },
        });
        if (changedProduct.count !== 1) throw new Error(`${product.name} just went out of stock`);

        const unitPrice = variant
          ? sellingPrice(variant.salePrice, variant.regularPrice)
          : sellingPrice(product.salePrice, product.regularPrice);
        const unitBuyPrice = variant?.buyPrice ?? product.buyPrice;
        if (unitPrice <= 0) throw new Error(`${product.name} is not available for online purchase yet`);
        subtotal += unitPrice * requested.quantity;
        cogsCost += unitBuyPrice * requested.quantity;
        orderItems.push({
          productId: product.id,
          variantId: variant?.id,
          productName: product.name,
          variantName: variant?.name,
          color: variant?.color,
          size: variant?.size,
          productSku: variant?.sku || product.sku,
          quantity: requested.quantity,
          unitPrice,
          unitBuyPrice,
          totalPrice: unitPrice * requested.quantity,
          totalBuyPrice: unitBuyPrice * requested.quantity,
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            variantId: variant?.id,
            type: 'SALE_DEDUCTION',
            quantity: -requested.quantity,
            previousStock: availableStock,
            currentStock: availableStock - requested.quantity,
            note: `Storefront ${paymentMethod} checkout`,
          },
        });
      }

      let discount = 0;
      if (couponCode && landingPageId) {
        const coupon = await tx.landingCoupon.findUnique({ where: { pageId_code: { pageId: landingPageId, code: couponCode } } });
        if (!coupon?.isActive) throw new Error('Coupon not found or inactive');
        discount = calculateLandingDiscount(coupon.kind, coupon.value, subtotal);
      }
      const grandTotal = Math.max(0, subtotal + deliveryCharge - discount);
      const orderNumber = await getNextOrderNumber(tx);
      return tx.order.create({
        data: {
          orderNumber,
          customerId: accountCustomerId,
          customerName: inputCustomer.name,
          customerPhone: phone,
          customerAddress: inputCustomer.address,
          district: inputCustomer.district || null,
          city: inputCustomer.city,
          customerNote: inputCustomer.note,
          checkoutDetails: JSON.stringify(checkoutDetails),
          status: 'PENDING',
          paymentMethod,
          paymentStatus: 'PENDING',
          subtotal,
          discount,
          deliveryCharge,
          grandTotal,
          codAmount: paymentMethod === 'COD' ? grandTotal : 0,
          cogsCost,
          isDuplicate: Boolean(recentOrder),
          isFraudSuspect: Boolean(existingCustomer?.isBlacklisted || (existingCustomer?.riskScore || 0) > 60),
          labels: JSON.stringify(pageSlug ? ['STOREFRONT', 'LANDING_PAGE'] : ['STOREFRONT']),
          items: { create: orderItems },
        },
        include: { items: true },
      });
    });

    let payment: { paymentUrl: string; attemptId: string; returnToken: string } | undefined;
    if (paymentMethod === 'UDDOKTAPAY') {
      try { payment = await initiateUddoktaPayment(order, inputCustomer.email!); }
      catch {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
          if (order.customerId) await tx.customer.update({ where: { id: order.customerId }, data: { totalOrders: { decrement: 1 } } });
          for (const item of order.items) {
            if (!item.productId) continue;
            const product = await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
            if (item.variantId) await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQuantity: { increment: item.quantity } } });
            await tx.stockMovement.create({ data: { productId: item.productId, variantId: item.variantId, type: 'RETURN_RESTOCK', quantity: item.quantity, previousStock: product.stockQuantity - item.quantity, currentStock: product.stockQuantity, note: `Payment initiation failed for ${order.orderNumber}` } });
          }
        });
        res.status(502).json({ success: false, message: 'Could not start secure payment. Your order was cancelled and stock restored. Please try again.' }); return;
      }
    }
    io.emit('order:new', orderNotification(order));

    // ── Meta CAPI: Send Purchase event server-side ──
    void (async () => {
      try {
        const themeConfig = parseJson<any>(settings.themeConfig, {});
        const analytics = themeConfig.analytics || {};
        if (parsed.data._trackingConsent === true && paymentMethod === 'COD' && analytics.metaPixelId && analytics.metaCapiAccessToken) {
          const { sendMetaCapiEvents } = await import('./metaConversionsApi');
          const eventId = trackingEventId;
          await sendMetaCapiEvents(
            {
              pixelId: analytics.metaPixelId,
              accessToken: revealSecret(analytics.metaCapiAccessToken),
              testEventCode: analytics.metaCapiTestCode || undefined,
            },
            [{
              eventName: 'Purchase',
              eventTime: Math.floor(Date.now() / 1000),
              eventId,
              eventSourceUrl: req.headers.referer || req.headers.origin || undefined,
              actionSource: 'website',
              userData: {
                email: inputCustomer.email || undefined,
                phone,
                firstName: inputCustomer.name,
                city: inputCustomer.city || undefined,
                state: inputCustomer.district || undefined,
                externalId: order.customerId || undefined,
                clientIpAddress: req.ip || req.socket.remoteAddress || undefined,
                clientUserAgent: req.headers['user-agent'] || undefined,
                fbc: parsed.data._fbc || undefined,
                fbp: parsed.data._fbp || undefined,
              },
              customData: {
                currency: 'BDT',
                value: order.grandTotal,
                content_ids: order.items.map((item: any) => item.productId).filter(Boolean),
                contents: order.items.map((item: any) => ({
                  id: item.productId,
                  quantity: item.quantity,
                  item_price: item.unitPrice,
                })),
                content_type: 'product',
                num_items: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
                order_id: order.orderNumber,
                coupon: parsed.data.couponCode || undefined,
              },
            }],
          );
        }
      } catch (capiError) {
        console.error('[CAPI] Purchase event failed:', capiError);
      }
    })();
    void sendOrderNotification({ eventTrigger: 'ORDER_PLACED', order }).catch(error => console.error('Storefront SMS notification failed:', error));
    const responsePayload = {
      success: true,
      message: 'Your order has been placed',
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: order.subtotal,
        deliveryCharge: order.deliveryCharge,
        grandTotal: order.grandTotal,
        paymentMethod: order.paymentMethod,
      },
      ...(payment ? { paymentUrl: payment.paymentUrl } : {}),
    };

    if (idempotencyKey) {
      checkoutIdempotencyStore.set(idempotencyKey, {
        payloadHash: payloadFingerprint,
        response: responsePayload,
        createdAt: Date.now(),
      });
    }

    res.status(201).json(responsePayload);
  } catch (error: any) {
    const isClientError = /not available|not available for online purchase|select a variation|left for|out of stock|valid Bangladesh|Coupon|coupon/.test(error.message);
    res.status(isClientError ? 409 : 500).json({ success: false, message: error.message || 'Checkout failed' });
  }
};
