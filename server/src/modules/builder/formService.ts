import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../prisma';
import { config } from '../../config';
import { documentForms, FormInputError, validateSubmission } from './core/forms';
import { escapeHtml } from './core/registry';
import type { PageDocument } from './core/schema';
import { failure, validatedDocument } from './service';
import { getNextOrderNumber } from '../orders/orderNumberService';

const cookieName = 'nix_builder_form';
const cookieValue = (req: Request) => (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || '';
const signature = (cookie: string, pageId: string, formId: string, version: number, expiry: number, id: string) => createHmac('sha256', config.jwtSecret).update([cookie, pageId, formId, version, expiry, id].join(':')).digest('hex');
export function createFormToken(cookie: string, pageId: string, formId: string, version: number, expiry = Date.now() + 30 * 60 * 1000) {
  const id = randomUUID(); return `${expiry}.${id}.${signature(cookie, pageId, formId, version, expiry, id)}`;
}
export function verifyFormToken(token: string, cookie: string, pageId: string, formId: string, version: number, now = Date.now()): string {
  const match = /^(\d{13})\.([a-f\d-]{36})\.([a-f\d]{64})$/.exec(token);
  if (!match || !/^[a-f\d]{64}$/.test(cookie)) throw failure(403, 'Your form session is invalid. Reload the page.');
  const expiry = Number(match[1]);
  if (expiry < now || expiry > now + 31 * 60 * 1000) throw failure(403, 'This form has expired. Reload the page.');
  const expected = signature(cookie, pageId, formId, version, expiry, match[2]);
  if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(match[3], 'hex'))) throw failure(403, 'Your form session changed. Reload the page.');
  return match[2];
}
export function formRenderContext(req: Request, res: Response, pageId: string, version: number, doc: PageDocument) {
  const forms = documentForms(doc); if (!forms.length) return undefined;
  let cookie = cookieValue(req);
  if (!/^[a-f\d]{64}$/.test(cookie)) cookie = randomBytes(32).toString('hex');
  res.cookie(cookieName, cookie, { httpOnly: true, secure: !config.isDev, sameSite: 'strict', path: '/b', maxAge: 24 * 60 * 60 * 1000 });
  return Object.fromEntries(forms.map(({ node }) => [node.id, { action: `/b/${doc.slug}/forms/${node.id}`, token: createFormToken(cookie, pageId, node.id, version) }]));
}
const receipt = (title: string, messages: string[], slug: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>body{font:16px/1.7 system-ui,sans-serif;color:#193d2c;background:#f3f7ef;margin:0;padding:clamp(24px,8vw,100px)}main{max-width:700px;margin:auto;padding:40px;background:white;border-radius:12px}a{color:#176b53}</style></head><body><main><h1>${escapeHtml(title)}</h1>${messages.map(value => `<p>${escapeHtml(value)}</p>`).join('')}<a href="/b/${escapeHtml(slug)}">Return to the page</a></main></body></html>`;

async function processOrderFromSubmission(values: Record<string, string>, pageSlug: string) {
  const customerName = (values.customer_name || values.name || 'Landing Page Customer').trim();
  const customerPhone = (values.customer_phone || values.phone || '').trim();
  const customerAddress = (values.customer_address || values.address || '').trim();

  if (!customerPhone) return;

  try {
    let customer = await prisma.customer.findUnique({ where: { phone: customerPhone } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: customerName,
          phone: customerPhone,
          address: customerAddress || null
        }
      });
    } else if (customerAddress && (!customer.address || customer.address.length < 5)) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { address: customerAddress }
      });
    }

    let product = null;
    if (values.product_id) {
      product = await prisma.product.findUnique({ where: { id: values.product_id } });
    }
    if (!product && values.product_sku) {
      product = await prisma.product.findUnique({ where: { sku: values.product_sku } });
    }
    if (!product) {
      product = await prisma.product.findFirst({
        where: {
          OR: [
            { name: { contains: 'Earbuds' } },
            { status: 'ACTIVE' }
          ]
        }
      });
    }

    const quantity = Math.max(1, parseInt(values.quantity || '1', 10) || 1);
    const unitPrice = product?.salePrice && product.salePrice > 0 ? product.salePrice : 1390;
    const unitBuyPrice = product?.buyPrice || 0;
    const subtotal = unitPrice * quantity;

    const shippingText = values.shipping_area || values.delivery_area || values.shipping_method || '';
    let deliveryCharge = 70;
    const match = shippingText.match(/৳\s*(\d+)/) || shippingText.match(/(\d+)\s*(?:টাকা|tk|bdt)/i);
    if (match) {
      deliveryCharge = parseInt(match[1], 10);
    } else if (shippingText.includes('বাইরে')) {
      deliveryCharge = 150;
    } else if (shippingText.includes('সাব')) {
      deliveryCharge = 130;
    } else {
      deliveryCharge = 70;
    }

    const grandTotal = subtotal + deliveryCharge;
    const codAmount = grandTotal;
    const orderNumber = await getNextOrderNumber();

    await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        customerName,
        customerPhone,
        customerAddress: customerAddress || 'N/A',
        status: 'PENDING',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        subtotal,
        deliveryCharge,
        grandTotal,
        advancePaid: 0,
        codAmount,
        cogsCost: unitBuyPrice * quantity,
        customerNote: `Landing page order (/b/${pageSlug})`,
        checkoutDetails: JSON.stringify(values),
        items: {
          create: [
            {
              productId: product?.id || null,
              productName: product?.name || 'Active Noise Cancelling Wireless Earbuds TWS',
              productSku: product?.sku || 'EARBUD-TWS-PRO',
              quantity,
              unitPrice,
              unitBuyPrice,
              totalPrice: subtotal,
              totalBuyPrice: unitBuyPrice * quantity
            }
          ]
        }
      }
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        totalOrders: { increment: 1 },
        totalSpent: { increment: grandTotal }
      }
    });
  } catch (err) {
    console.error('Failed to create OMS order from submission:', err);
  }
}

export async function submitBuilderForm(req: Request, res: Response, next: NextFunction) {
  try {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    const origin = req.get('origin');
    if (!origin || (origin !== `${req.protocol}://${req.get('host')}` && !config.clientUrls.includes(origin))) throw failure(403, 'Form submission origin is not allowed');
    if (typeof req.params.slug !== 'string' || req.params.slug.length > 120 || !/^[a-f\d-]{36}$/.test(String(req.params.formId))) throw failure(404, 'Form not found');
    const page = await prisma.builderPage.findUnique({ where: { publishedSlug: req.params.slug } });
    if (!page?.published || !page.publishedVersion) throw failure(404, 'Form is not published');
    const doc = validatedDocument(JSON.parse(page.published)); const form = documentForms(doc).find(form => form.node.id === req.params.formId);
    if (!form) throw failure(404, 'Form not found');
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || typeof req.body._token !== 'string') throw failure(400, 'Invalid form submission');
    const id = verifyFormToken(req.body._token, cookieValue(req), page.id, form.node.id, page.publishedVersion);
    if (req.body._website) throw failure(400, 'Please leave the anti-spam field empty');
    let values: Record<string, string>;
    try { values = validateSubmission(form, req.body); }
    catch (error) { if (error instanceof FormInputError) { res.status(400).type('html').send(receipt(error.message, error.fields, doc.slug)); return; } throw error; }
    try {
      await prisma.builderSubmission.create({ data: { id, pageId: page.id, formId: form.node.id, formName: String(form.node.props.formName), pageVersion: page.publishedVersion, data: JSON.stringify(values) } });
    } catch (error) {
      // Replaying the exact signed submission token cannot create a second record.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }

    // Automatically create OMS order if submission contains customer order fields
    await processOrderFromSubmission(values, doc.slug);

    res.status(200).type('html').send(receipt('Response received', [String(form.node.props.successMessage || 'Thank you. Your response has been received.')], doc.slug));
  } catch (error) {
    if (error instanceof Error && 'status' in error && typeof error.status === 'number' && error.status >= 400 && error.status < 500) { res.status(error.status).json({ message: error.message }); return; }
    next(error);
  }
}

