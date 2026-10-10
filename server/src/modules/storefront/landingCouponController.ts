import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../prisma';

const couponInput = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/), kind: z.enum(['PERCENT', 'FIXED']), value: z.number().positive(), isActive: z.boolean().default(true) }).refine((data) => data.kind !== 'PERCENT' || data.value <= 100, 'Percentage must be 100 or less');
const quoteInput = z.object({ pageSlug: z.string().min(1).max(120), code: z.string().trim().toUpperCase().min(3).max(40), items: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().nullable().optional(), quantity: z.number().int().min(1).max(10) })).min(1).max(12) });

export async function listLandingCoupons(req: Request, res: Response) {
  const coupons = await prisma.landingCoupon.findMany({ where: { pageId: String(req.params.id) }, orderBy: { createdAt: 'desc' } });
  res.json({ coupons });
}

export async function createLandingCoupon(req: Request, res: Response) {
  const parsed = couponInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: parsed.error.issues[0]?.message }); return; }
  const page = await prisma.storePage.findUnique({ where: { id: String(req.params.id) } });
  if (!page?.slug.startsWith('flow-')) { res.status(404).json({ message: 'Landing page not found' }); return; }
  try { const coupon = await prisma.landingCoupon.create({ data: { pageId: page.id, ...parsed.data } }); res.status(201).json({ coupon }); }
  catch (error: any) { if (error?.code === 'P2002') res.status(409).json({ message: 'This coupon code already exists on this page' }); else throw error; }
}

export async function updateLandingCoupon(req: Request, res: Response) {
  const parsed = couponInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: parsed.error.issues[0]?.message }); return; }
  try { const coupon = await prisma.landingCoupon.update({ where: { id: String(req.params.couponId), pageId: String(req.params.id) }, data: parsed.data }); res.json({ coupon }); }
  catch (error: any) { if (error?.code === 'P2025') res.status(404).json({ message: 'Coupon not found' }); else if (error?.code === 'P2002') res.status(409).json({ message: 'Coupon code already in use' }); else throw error; }
}

export async function deleteLandingCoupon(req: Request, res: Response) {
  await prisma.landingCoupon.deleteMany({ where: { id: String(req.params.couponId), pageId: String(req.params.id) } });
  res.json({ success: true });
}

export const calculateLandingDiscount = (kind: string, value: number, subtotal: number) => Math.min(subtotal, Math.max(0, Math.round((kind === 'PERCENT' ? subtotal * value / 100 : value) * 100) / 100));

export async function quoteLandingCoupon(req: Request, res: Response) {
  const parsed = quoteInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Enter a valid coupon and select products' }); return; }
  const { pageSlug, code, items } = parsed.data;
  const page = await prisma.storePage.findUnique({ where: { slug: pageSlug } });
  if (!page || page.status !== 'PUBLISHED' || !page.isActive) { res.status(404).json({ message: 'Page unavailable' }); return; }
  const checkout = (JSON.parse(page.blocks) as any[]).find((block) => block.type === 'CHECKOUT');
  if (!checkout || checkout.couponEnabled === false) { res.status(400).json({ message: 'Coupons are not available on this page' }); return; }
  const distinctIds = new Set(items.map((item) => item.productId));
  const maximum = checkout.selection === 'SINGLE' ? 1 : checkout.maxProducts ?? checkout.productIds.length;
  if (distinctIds.size !== items.length || distinctIds.size < (checkout.minProducts ?? 1) || distinctIds.size > maximum) { res.status(400).json({ message: 'Choose the required number of products first' }); return; }
  const coupon = await prisma.landingCoupon.findUnique({ where: { pageId_code: { pageId: page.id, code } } });
  if (!coupon?.isActive) { res.status(404).json({ message: 'Coupon not found or inactive' }); return; }
  let subtotal = 0;
  for (const item of items) {
    if (!checkout.productIds.includes(item.productId)) { res.status(400).json({ message: 'Product is not part of this offer' }); return; }
    const product = await prisma.product.findFirst({ where: { id: item.productId, status: 'ACTIVE' }, include: { variants: true } });
    if (!product) { res.status(400).json({ message: 'Product unavailable' }); return; }
    const variant = item.variantId ? product.variants.find((entry) => entry.id === item.variantId && entry.status === 'ACTIVE') : null;
    if (product.productType === 'VARIABLE' && !variant) { res.status(400).json({ message: 'Choose a variation first' }); return; }
    if ((variant?.stockQuantity ?? product.stockQuantity) < item.quantity) { res.status(400).json({ message: 'Selected product is out of stock' }); return; }
    subtotal += (variant ? variant.salePrice || variant.regularPrice : product.salePrice || product.regularPrice) * item.quantity;
  }
  res.json({ code: coupon.code, discount: calculateLandingDiscount(coupon.kind, coupon.value, subtotal), subtotal });
}
