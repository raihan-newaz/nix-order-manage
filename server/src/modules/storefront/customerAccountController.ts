import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../../prisma';
import { config } from '../../config';
import { normalizePhone, publicProduct } from './storefrontController';

export interface CustomerRequest extends Request { customer?: { id: string; name: string; phone: string; email?: string | null } }

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128)
  .regex(/[A-Za-z]/, 'Password must include a letter').regex(/\d/, 'Password must include a number');
const signupSchema = z.object({
  name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(160),
  phone: z.string().trim().min(10).max(18), password: passwordSchema,
});
const profileSchema = z.object({
  name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(160),
  alternativePhone: z.string().trim().max(18).optional().nullable(), address: z.string().trim().max(300).optional().nullable(),
  district: z.string().trim().max(80).optional().nullable(), city: z.string().trim().max(80).optional().nullable(),
  zone: z.string().trim().max(80).optional().nullable(), area: z.string().trim().max(80).optional().nullable(),
});

const cookieOptions = { httpOnly: true, secure: !config.isDev, sameSite: 'strict' as const, maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' };
const customerView = (customer: any) => ({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, alternativePhone: customer.alternativePhone, address: customer.address, district: customer.district, city: customer.city, zone: customer.zone, area: customer.area, totalOrders: customer.totalOrders, completedOrders: customer.completedOrders, totalSpent: customer.totalSpent, createdAt: customer.createdAt });
const setSession = (res: Response, customer: any) => {
  const token = jwt.sign({ kind: 'customer', id: customer.id, sessionVersion: customer.sessionVersion }, config.jwtSecret, { expiresIn: '30d' });
  res.cookie(config.customerCookieName, token, cookieOptions);
};
const readCookie = (req: Request) => Object.fromEntries((req.headers.cookie || '').split(';').map((part) => { const [key, ...value] = part.trim().split('='); return [key, decodeURIComponent(value.join('='))]; }).filter(([key]) => key))[config.customerCookieName];

const authenticateCustomerRequest = async (req: CustomerRequest, res: Response, next: NextFunction, required: boolean): Promise<void> => {
  try {
    const token = readCookie(req);
    if (!token) {
      if (required) res.status(401).json({ success: false, message: 'Please sign in to continue' });
      else next();
      return;
    }
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as { kind: string; id: string; sessionVersion: number };
    if (decoded.kind !== 'customer') throw new Error('Invalid account session');
    const customer = await prisma.customer.findUnique({ where: { id: decoded.id } });
    if (!customer || customer.accountStatus !== 'ACTIVE' || !customer.password || customer.sessionVersion !== decoded.sessionVersion) throw new Error('Invalid account session');
    req.customer = { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email };
    next();
  } catch {
    if (required) res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' });
    else next();
  }
};

export const authenticateCustomer = (req: CustomerRequest, res: Response, next: NextFunction) => authenticateCustomerRequest(req, res, next, true);
export const optionalCustomer = (req: CustomerRequest, res: Response, next: NextFunction) => authenticateCustomerRequest(req, res, next, false);

export const signupCustomer = async (req: Request, res: Response): Promise<void> => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid account details' }); return; }
  try {
    const input = parsed.data; const phone = normalizePhone(input.phone); const email = input.email.toLowerCase();
    const emailOwner = await prisma.customer.findUnique({ where: { email } });
    if (emailOwner && emailOwner.phone !== phone) { res.status(409).json({ success: false, message: 'An account already uses this email' }); return; }
    const existing = await prisma.customer.findUnique({ where: { phone } });
    if (existing?.password) { res.status(409).json({ success: false, message: 'An account already uses this mobile number' }); return; }
    if (existing) { res.status(409).json({ success: false, message: 'This mobile number has an existing guest profile. Contact support to verify ownership before creating an account.' }); return; }
    const customer = await prisma.customer.create({ data: { name: input.name, email, phone, password: await bcrypt.hash(input.password, 12) } });
    setSession(res, customer); res.status(201).json({ success: true, message: 'Account created', customer: customerView(customer) });
  } catch (error: any) { res.status(400).json({ success: false, message: error.message || 'Could not create account' }); }
};

export const signinCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const identifier = String(req.body?.identifier || '').trim(); const password = String(req.body?.password || '');
    if (!identifier || !password) { res.status(400).json({ success: false, message: 'Email/mobile and password are required' }); return; }
    const customer = identifier.includes('@')
      ? await prisma.customer.findUnique({ where: { email: identifier.toLowerCase() } })
      : await prisma.customer.findUnique({ where: { phone: normalizePhone(identifier) } });
    if (!customer?.password || customer.accountStatus !== 'ACTIVE' || !(await bcrypt.compare(password, customer.password))) { res.status(401).json({ success: false, message: 'Invalid email/mobile or password' }); return; }
    setSession(res, customer); res.json({ success: true, customer: customerView(customer) });
  } catch { res.status(401).json({ success: false, message: 'Invalid email/mobile or password' }); }
};

export const signoutCustomer = (_req: Request, res: Response): void => {
  res.clearCookie(config.customerCookieName, { httpOnly: true, secure: !config.isDev, sameSite: 'strict', path: '/' });
  res.json({ success: true });
};

export const getCustomerAccount = async (req: CustomerRequest, res: Response): Promise<void> => {
  if (!req.customer) { res.json({ success: true, customer: null }); return; }
  const customer = await prisma.customer.findUnique({ where: { id: req.customer!.id } });
  if (!customer) { res.status(404).json({ success: false, message: 'Account not found' }); return; }
  res.json({ success: true, customer: customerView(customer) });
};

export const updateCustomerProfile = async (req: CustomerRequest, res: Response): Promise<void> => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message }); return; }
  try {
    const email = parsed.data.email.toLowerCase();
    const owner = await prisma.customer.findUnique({ where: { email } });
    if (owner && owner.id !== req.customer!.id) { res.status(409).json({ success: false, message: 'Email already in use' }); return; }
    const customer = await prisma.customer.update({ where: { id: req.customer!.id }, data: { ...parsed.data, email } });
    res.json({ success: true, message: 'Profile updated', customer: customerView(customer) });
  } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
};

export const changeCustomerPassword = async (req: CustomerRequest, res: Response): Promise<void> => {
  const currentPassword = String(req.body?.currentPassword || ''); const newPassword = String(req.body?.newPassword || '');
  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message }); return; }
  const customer = await prisma.customer.findUnique({ where: { id: req.customer!.id } });
  if (!customer?.password || !(await bcrypt.compare(currentPassword, customer.password))) { res.status(401).json({ success: false, message: 'Current password is incorrect' }); return; }
  await prisma.customer.update({ where: { id: customer.id }, data: { password: await bcrypt.hash(newPassword, 12), sessionVersion: { increment: 1 } } });
  res.clearCookie(config.customerCookieName, { httpOnly: true, secure: !config.isDev, sameSite: 'strict', path: '/' });
  res.json({ success: true, message: 'Password changed. Please sign in again.' });
};

export const listCustomerOrders = async (req: CustomerRequest, res: Response): Promise<void> => {
  const orders = await prisma.order.findMany({ where: { customerId: req.customer!.id, trashedAt: null }, select: { id: true, orderNumber: true, status: true, paymentStatus: true, subtotal: true, deliveryCharge: true, grandTotal: true, createdAt: true, courierTrackingCode: true, items: { select: { id: true, productName: true, variantName: true, quantity: true, unitPrice: true, totalPrice: true } } }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, orders });
};

export const getCustomerOrder = async (req: CustomerRequest, res: Response): Promise<void> => {
  const order = await prisma.order.findFirst({
    where: { id: String(req.params.id), customerId: req.customer!.id, trashedAt: null },
    select: {
      id: true, orderNumber: true, status: true, paymentStatus: true, paymentMethod: true,
      subtotal: true, discount: true, deliveryCharge: true, grandTotal: true, advancePaid: true,
      codAmount: true, customerName: true, customerPhone: true, customerAddress: true,
      district: true, city: true, zone: true, area: true, customerNote: true,
      courierName: true, courierTrackingCode: true, courierTrackingLink: true, createdAt: true,
      items: { select: { id: true, productName: true, variantName: true, color: true, size: true, quantity: true, unitPrice: true, totalPrice: true } },
    },
  });
  if (!order) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
  res.json({ success: true, order });
};

export const listWishlist = async (req: CustomerRequest, res: Response): Promise<void> => {
  const items = await prisma.customerWishlist.findMany({ where: { customerId: req.customer!.id }, include: { product: { include: { variants: { where: { status: 'ACTIVE' } } } } }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, products: items.filter((item) => item.product.status === 'ACTIVE').map((item) => publicProduct(item.product)) });
};
export const addWishlist = async (req: CustomerRequest, res: Response): Promise<void> => {
  const productId = String(req.params.productId); const product = await prisma.product.findFirst({ where: { id: productId, status: 'ACTIVE' } });
  if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return; }
  await prisma.customerWishlist.upsert({ where: { customerId_productId: { customerId: req.customer!.id, productId } }, update: {}, create: { customerId: req.customer!.id, productId } });
  res.json({ success: true, message: 'Added to wishlist' });
};
export const removeWishlist = async (req: CustomerRequest, res: Response): Promise<void> => {
  await prisma.customerWishlist.deleteMany({ where: { customerId: req.customer!.id, productId: String(req.params.productId) } });
  res.json({ success: true, message: 'Removed from wishlist' });
};
