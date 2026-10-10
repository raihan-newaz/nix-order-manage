import crypto from 'crypto';
import dns from 'dns/promises';
import https from 'https';
import net from 'net';
import axios from 'axios';
import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../prisma';
import { config } from '../../config';
import { protectSecret, revealSecret } from '../../utils/security';
import { sendOrderNotification } from '../messaging/messageService';
import { generateEventId, sendMetaCapiEvents } from './metaConversionsApi';

const gatewaySchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().trim().max(255),
  apiKey: z.string().trim().max(500).optional(),
});
const validId = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value);
const amountInPaisa = (value: unknown) => Math.round(Number(value) * 100);
const storefrontOrigin = () => process.env.STOREFRONT_URL || (config.isDev ? 'http://localhost:3001' : '');
const apiOrigin = () => process.env.PUBLIC_API_URL || (config.isDev ? 'http://localhost:5000' : '');
const isPrivateAddress = (address: string) => {
  const ip = address.toLowerCase();
  return ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:') || ip.startsWith('::ffff:') ||
    /^0\.|^10\.|^127\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip);
};

// The API host is an administrator-supplied payment installation. Reject local/private hosts
// before each outbound call and never follow redirects with the merchant API key.
export async function validateGatewayBaseUrl(input: string) {
  const url = new URL(input);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash || !['/', '/api'].includes(path)) throw new Error('Use the HTTPS installation URL, optionally ending in /api');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || net.isIP(host)) throw new Error('A public payment hostname is required');
  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('The payment hostname must resolve only to public IP addresses');
  return url.origin;
}

async function credentials() {
  const settings = await prisma.storefrontSettings.findUnique({ where: { id: 'default' } });
  if (!settings?.uddoktaEnabled || !settings.uddoktaBaseUrl || !settings.uddoktaApiKey) throw new Error('Online payment is not configured');
  const baseUrl = await validateGatewayBaseUrl(settings.uddoktaBaseUrl);
  return { baseUrl, apiKey: revealSecret(settings.uddoktaApiKey) };
}

async function gatewayPost(path: string, data: object) {
  const { baseUrl, apiKey } = await credentials();
  const addresses = await dns.lookup(new URL(baseUrl).hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('Unsafe payment hostname');
  const pinned = addresses[0];
  const httpsAgent = new https.Agent({ lookup: ((_hostname: string, options: any, callback: any) => {
    if (options?.all) callback(null, [pinned]);
    else callback(null, pinned.address, pinned.family);
  }) as any });
  const response = await axios.post(`${baseUrl}${path}`, data, {
    headers: { 'RT-UDDOKTAPAY-API-KEY': apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
    httpsAgent, proxy: false, timeout: 15000, maxRedirects: 0, maxContentLength: 64 * 1024, validateStatus: (status) => status >= 200 && status < 300,
  });
  return { body: response.data, baseUrl };
}

export async function initiateUddoktaPayment(order: { id: string; orderNumber: string; grandTotal: number; customerName: string; customerPhone: string }, email: string) {
  if (!storefrontOrigin() || !apiOrigin()) throw new Error('STOREFRONT_URL and PUBLIC_API_URL are required for online payments');
  const attempt = await prisma.paymentAttempt.create({ data: {
    orderId: order.id, expectedAmount: order.grandTotal, returnToken: crypto.randomBytes(32).toString('hex'),
  } });
  try {
    const { body, baseUrl } = await gatewayPost('/api/checkout-v2', {
      full_name: order.customerName, email, amount: order.grandTotal.toFixed(2),
      metadata: { order_id: order.id, attempt_id: attempt.id, order_number: order.orderNumber },
      redirect_url: `${apiOrigin()}/api/storefront/payment/return/${attempt.id}/${attempt.returnToken}`,
      return_type: 'GET',
      cancel_url: `${storefrontOrigin()}/payment/result?attempt=${attempt.id}&token=${attempt.returnToken}&cancelled=1`,
      webhook_url: `${apiOrigin()}/api/storefront/payment/webhook`,
    });
    const paymentUrl = String(body?.payment_url || '');
    const target = new URL(paymentUrl);
    if (body?.status !== true || target.protocol !== 'https:' || target.origin !== baseUrl) throw new Error('Gateway returned an invalid payment URL');
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { paymentUrl } });
    return { paymentUrl, attemptId: attempt.id, returnToken: attempt.returnToken };
  } catch (error) {
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'INITIATION_FAILED' } });
    throw error;
  }
}

async function verifyAttempt(attemptId: string, invoiceId: string) {
  if (!validId(invoiceId)) throw new Error('Invalid invoice');
  const attempt = await prisma.paymentAttempt.findUnique({ where: { id: attemptId }, include: { order: true } });
  if (!attempt || (attempt.invoiceId && attempt.invoiceId !== invoiceId)) throw new Error('Payment attempt not found');
  if (attempt.status === 'PAID') return attempt;
  if (attempt.status === 'INITIATION_FAILED' || attempt.order.status === 'CANCELLED' || attempt.order.trashedAt) throw new Error('This order is not payable');
  if (!attempt.invoiceId) await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, invoiceId: null }, data: { invoiceId } });
  const { body } = await gatewayPost('/api/verify-payment', { invoice_id: invoiceId });
  if (body?.status !== 'COMPLETED') return attempt;
  if (body.invoice_id !== invoiceId || body.metadata?.attempt_id !== attempt.id || body.metadata?.order_id !== attempt.orderId ||
      amountInPaisa(body.amount) !== amountInPaisa(attempt.expectedAmount) || amountInPaisa(attempt.order.grandTotal) !== amountInPaisa(attempt.expectedAmount) ||
      !validId(body.transaction_id)) throw new Error('Payment verification mismatch');
  let newlyPaid = false;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentAttempt.updateMany({ where: { id: attempt.id, status: { not: 'PAID' }, invoiceId }, data: {
      status: 'PAID', invoiceId, transactionId: body.transaction_id, verifiedAt: new Date(),
    } });
    if (!claimed.count) return;
    newlyPaid = true;
    await tx.order.update({ where: { id: attempt.orderId }, data: {
      paymentStatus: 'PAID', advancePaid: attempt.expectedAmount, codAmount: 0,
    } });
  });
  if (newlyPaid) {
    const paidOrder = await prisma.order.findUnique({ where: { id: attempt.orderId }, include: { items: true, customer: { select: { email: true } } } });
    if (paidOrder) {
      void sendOrderNotification({ eventTrigger: 'PAYMENT_RECEIVED', order: paidOrder }).catch(error => console.error('Payment SMS notification failed:', error));
      try {
        const details = JSON.parse(paidOrder.checkoutDetails || '{}');
        const tracking = details.__tracking || {};
        const settings = await prisma.storefrontSettings.findUnique({ where: { id: 'default' } });
        const analytics = JSON.parse(settings?.themeConfig || '{}').analytics || {};
        if (tracking.consent && analytics.metaPixelId && analytics.metaCapiAccessToken) {
          await sendMetaCapiEvents({ pixelId: analytics.metaPixelId, accessToken: revealSecret(analytics.metaCapiAccessToken), testEventCode: analytics.metaCapiTestCode || undefined }, [{
            eventName: 'Purchase', eventTime: Math.floor(Date.now() / 1000), eventId: tracking.eventId || generateEventId(),
            eventSourceUrl: tracking.sourceUrl || undefined, actionSource: 'website',
            userData: { email: paidOrder.customer?.email || undefined, phone: paidOrder.customerPhone, firstName: paidOrder.customerName, city: paidOrder.city || undefined, state: paidOrder.district || undefined, externalId: paidOrder.customerId || undefined, clientIpAddress: tracking.clientIpAddress || undefined, clientUserAgent: tracking.clientUserAgent || undefined, fbc: tracking.fbc || undefined, fbp: tracking.fbp || undefined },
            customData: { currency: 'BDT', value: paidOrder.grandTotal, content_ids: paidOrder.items.map((item) => item.productId).filter(Boolean), contents: paidOrder.items.map((item) => ({ id: item.productId || item.id, quantity: item.quantity, item_price: item.unitPrice })), content_type: 'product', num_items: paidOrder.items.reduce((total, item) => total + item.quantity, 0), order_id: paidOrder.orderNumber, coupon: tracking.coupon || undefined },
          }]);
        }
      } catch (error: any) { console.error('[CAPI] Verified-payment Purchase event failed:', error.message); }
    }
  }
  return prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id }, include: { order: true } });
}

export const getPaymentConfig = async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.storefrontSettings.findUnique({ where: { id: 'default' } });
    res.json({ success: true, payment: { enabled: Boolean(settings?.uddoktaEnabled), baseUrl: settings?.uddoktaBaseUrl || '', hasApiKey: Boolean(settings?.uddoktaApiKey) } });
  } catch { res.status(500).json({ success: false, message: 'Could not load payment settings' }); }
};

export const savePaymentConfig = async (req: Request, res: Response): Promise<void> => {
  const parsed = gatewaySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: 'Invalid payment settings' }); return; }
  try {
    const current = await prisma.storefrontSettings.findUnique({ where: { id: 'default' } });
    const baseUrl = parsed.data.baseUrl ? await validateGatewayBaseUrl(parsed.data.baseUrl) : null;
    const apiKey = parsed.data.apiKey ? protectSecret(parsed.data.apiKey) : current?.uddoktaApiKey || null;
    if (parsed.data.enabled && (!baseUrl || !apiKey || !storefrontOrigin() || !apiOrigin())) throw new Error('Set a public gateway URL, API key, STOREFRONT_URL and PUBLIC_API_URL before enabling');
    if (parsed.data.enabled && !config.isDev && ([storefrontOrigin(), apiOrigin()].some((origin) => new URL(origin).protocol !== 'https:'))) throw new Error('Production storefront and API origins must use HTTPS');
    await prisma.storefrontSettings.upsert({ where: { id: 'default' }, create: { id: 'default', uddoktaEnabled: parsed.data.enabled, uddoktaBaseUrl: baseUrl, uddoktaApiKey: apiKey }, update: { uddoktaEnabled: parsed.data.enabled, uddoktaBaseUrl: baseUrl, uddoktaApiKey: apiKey } });
    res.json({ success: true, payment: { enabled: parsed.data.enabled, baseUrl: baseUrl || '', hasApiKey: Boolean(apiKey) } });
  } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
};

export const paymentReturn = async (req: Request, res: Response): Promise<void> => {
  const attemptId = String(req.params.attemptId);
  const token = String(req.params.token);
  const invoiceId = String(req.query.invoice_id || '');
  try {
    const attempt = await prisma.paymentAttempt.findUnique({ where: { id: attemptId }, include: { order: true } });
    const expected = Buffer.from(attempt?.returnToken || '');
    const supplied = Buffer.from(token);
    if (!attempt || expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) { res.status(404).end(); return; }
    if (invoiceId) await verifyAttempt(attemptId, invoiceId);
  } catch { /* Do not confirm a payment when verification is unavailable or mismatched. */ }
  res.redirect(303, `${storefrontOrigin()}/payment/result?attempt=${encodeURIComponent(attemptId)}&token=${encodeURIComponent(token)}`);
};

export const paymentWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiKey } = await credentials();
    const supplied = String(req.header('RT-UDDOKTAPAY-API-KEY') || '');
    const a = Buffer.from(apiKey), b = Buffer.from(supplied);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { res.status(401).end(); return; }
    const attemptId = req.body?.metadata?.attempt_id;
    const invoiceId = req.body?.invoice_id;
    if (typeof attemptId !== 'string' || !validId(invoiceId)) { res.status(400).end(); return; }
    await verifyAttempt(attemptId, invoiceId);
    res.json({ success: true });
  } catch { res.status(400).json({ success: false }); }
};

export const paymentResult = async (req: Request, res: Response): Promise<void> => {
  try {
    let attempt = await prisma.paymentAttempt.findUnique({ where: { id: String(req.params.attemptId) }, include: { order: true } });
    if (!attempt || attempt.returnToken !== String(req.query.token || '')) { res.status(404).json({ success: false }); return; }
    if (attempt.invoiceId && attempt.status !== 'PAID') {
      try { attempt = await verifyAttempt(attempt.id, attempt.invoiceId); } catch { /* Continue to show pending; never infer payment from a failed verification. */ }
    }
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, orderNumber: attempt.order.orderNumber, status: attempt.status, paymentStatus: attempt.order.paymentStatus, total: attempt.order.grandTotal });
  } catch { res.status(503).json({ success: false, message: 'Payment status is temporarily unavailable' }); }
};
