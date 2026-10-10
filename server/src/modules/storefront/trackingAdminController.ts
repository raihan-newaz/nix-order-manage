/**
 * Tracking configuration admin endpoints.
 *
 * • GET  /tracking/config       — read current GA4 + Meta + CAPI config
 * • PUT  /tracking/config       — update tracking settings
 * • POST /tracking/test-capi    — send a test PageView event to Meta CAPI
 */

import { Request, Response } from 'express';
import prisma from '../../prisma';
import { sendMetaCapiEvents, generateEventId } from './metaConversionsApi';
import { z } from 'zod';
import { protectSecret, revealSecret } from '../../utils/security';

// ── Helpers ──────────────────────────────────────────────────────────

const parseThemeConfig = (raw: string | null | undefined): Record<string, any> => {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
};

// ── GET /tracking/config ─────────────────────────────────────────────

export const getTrackingConfig = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.storefrontSettings.findUnique({ where: { id: 'default' } });
    const themeConfig = parseThemeConfig(settings?.themeConfig);
    const analytics = themeConfig.analytics || {};

    // Mask the access token — show only last 8 characters
    const tokenRaw: string = revealSecret(analytics.metaCapiAccessToken);
    const maskedToken = tokenRaw ? '••••••••' : '';
    if (settings && analytics.metaCapiAccessToken && !String(analytics.metaCapiAccessToken).startsWith('enc:v1:')) {
      analytics.metaCapiAccessToken = protectSecret(tokenRaw);
      themeConfig.analytics = analytics;
      await prisma.storefrontSettings.update({ where: { id: 'default' }, data: { themeConfig: JSON.stringify(themeConfig) } });
    }

    res.json({
      success: true,
      config: {
        googleAnalyticsId:       analytics.googleAnalyticsId || '',
        metaPixelId:             analytics.metaPixelId || '',
        metaCapiAccessToken:     maskedToken,
        metaCapiAccessTokenSet:  Boolean(tokenRaw),
        metaCapiTestCode:        analytics.metaCapiTestCode || '',
        customEvents:            analytics.customEvents || [],
      },
    });
  } catch (error: any) {
    console.error('[Tracking] Could not read tracking configuration:', error);
    res.status(500).json({ success: false, message: 'Could not load tracking configuration' });
  }
};

// ── PUT /tracking/config ─────────────────────────────────────────────

export const updateTrackingConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      googleAnalyticsId: z.string().trim().regex(/^(|G-[A-Z0-9]{4,})$/i).optional(),
      metaPixelId: z.string().trim().regex(/^(|\d{5,20})$/).optional(),
      metaCapiAccessToken: z.string().trim().max(500).optional(),
      metaCapiTestCode: z.string().trim().max(40).optional(),
      customEvents: z.array(z.object({
        name: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]{0,59}$/),
        selector: z.string().trim().max(200).optional(),
        ga4Event: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]{0,59}$/).optional().or(z.literal('')),
        metaEvent: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]{0,59}$/).optional().or(z.literal('')),
        metaEventType: z.enum(['custom', 'standard']).optional(),
      })).max(20).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid tracking configuration' }); return; }
    const {
      googleAnalyticsId,
      metaPixelId,
      metaCapiAccessToken,
      metaCapiTestCode,
      customEvents,
    } = parsed.data;

    const settings = await prisma.storefrontSettings.findUnique({ where: { id: 'default' } });
    const themeConfig = parseThemeConfig(settings?.themeConfig);
    const existing = themeConfig.analytics || {};

    // Merge — only overwrite fields that are explicitly provided.
    // Access token is only updated when a non-masked value is supplied.
    themeConfig.analytics = {
      ...existing,
      ...(googleAnalyticsId !== undefined ? { googleAnalyticsId: googleAnalyticsId.trim() } : {}),
      ...(metaPixelId !== undefined ? { metaPixelId: metaPixelId.replace(/\D/g, '') } : {}),
      ...(metaCapiAccessToken && !metaCapiAccessToken.includes('•')
        ? { metaCapiAccessToken: protectSecret(metaCapiAccessToken.trim()) }
        : {}),
      ...(metaCapiTestCode !== undefined ? { metaCapiTestCode: metaCapiTestCode.trim() } : {}),
      ...(customEvents !== undefined ? { customEvents } : {}),
    };

    await prisma.storefrontSettings.update({
      where: { id: 'default' },
      data: { themeConfig: JSON.stringify(themeConfig) },
    });

    res.json({ success: true, message: 'Tracking configuration saved' });
  } catch (error: any) {
    console.error('[Tracking] Could not save tracking configuration:', error);
    res.status(500).json({ success: false, message: 'Could not save tracking configuration' });
  }
};

// Public, consent-gated Meta event relay. Only allow browser event names and
// commerce fields; contact details and secrets never come from this endpoint.
export const relayMetaTrackingEvent = async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    eventName: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]{0,59}$/),
    eventId: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
    eventSourceUrl: z.string().url().max(2000),
    consent: z.literal(true),
    fbc: z.string().max(500).optional(),
    fbp: z.string().max(500).optional(),
    customData: z.object({
      currency: z.string().length(3).optional(), value: z.number().min(0).max(1_000_000_000).optional(),
      content_ids: z.array(z.string().max(120)).max(100).optional(),
      contents: z.array(z.object({ id: z.string().max(120), quantity: z.number().int().min(1).max(1000), item_price: z.number().min(0).max(1_000_000_000).optional() })).max(100).optional(),
      content_type: z.enum(['product', 'product_group']).optional(), num_items: z.number().int().min(0).max(10_000).optional(),
      search_string: z.string().max(200).optional(), order_id: z.string().max(120).optional(), coupon: z.string().max(40).optional(),
      event_category: z.string().max(80).optional(), event_label: z.string().max(120).optional(), page_path: z.string().max(500).optional(), element_text: z.string().max(100).optional(),
    }).optional(),
    customKey: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,59}$/).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false }); return; }
  const origin = req.headers.origin;
  let source: URL;
  try { source = new URL(parsed.data.eventSourceUrl); } catch { res.status(400).json({ success: false }); return; }
  if (!origin || source.origin !== origin) { res.status(403).json({ success: false }); return; }
  const settings = await prisma.storefrontSettings.findUnique({ where: { id: 'default' } });
  const analytics = parseThemeConfig(settings?.themeConfig).analytics || {};
  if (!analytics.metaPixelId || !analytics.metaCapiAccessToken) { res.status(204).end(); return; }

  const customData = parsed.data.customData || {};
  const pixelNames: Record<string, string> = {
    page_view: 'PageView', view_item: 'ViewContent', view_item_list: 'ViewContent',
    search: 'Search', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout',
    add_payment_info: 'AddPaymentInfo', sign_up: 'CompleteRegistration', view_cart: 'ViewCart', login: 'Login', purchase: 'Purchase',
  };
  const configured = (analytics.customEvents || []).find((item: any) => item.name === parsed.data.customKey || item.ga4Event === parsed.data.eventName || item.name === parsed.data.eventName);
  if (parsed.data.customKey && !configured || !parsed.data.customKey && !Object.prototype.hasOwnProperty.call(pixelNames, parsed.data.eventName)) { res.status(400).json({ success: false }); return; }
  const name = pixelNames[parsed.data.eventName] || (configured?.metaEventType === 'standard' ? configured.metaEvent : undefined) || configured?.metaEvent || parsed.data.eventName;
  const result = await sendMetaCapiEvents({ pixelId: analytics.metaPixelId, accessToken: revealSecret(analytics.metaCapiAccessToken), testEventCode: analytics.metaCapiTestCode || undefined }, [{
    eventName: name,
    eventTime: Math.floor(Date.now() / 1000),
    eventId: parsed.data.eventId,
    eventSourceUrl: parsed.data.eventSourceUrl,
    actionSource: 'website',
    userData: {
      clientIpAddress: req.ip || req.socket.remoteAddress || undefined,
      clientUserAgent: req.headers['user-agent'] || undefined,
      fbc: parsed.data.fbc,
      fbp: parsed.data.fbp,
    },
    customData,
  }]);
  res.status(result.success ? 204 : 502).end();
};

// ── POST /tracking/test-capi ─────────────────────────────────────────

export const testMetaCapi = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.storefrontSettings.findUnique({ where: { id: 'default' } });
    const themeConfig = parseThemeConfig(settings?.themeConfig);
    const analytics = themeConfig.analytics || {};

    if (!analytics.metaPixelId || !analytics.metaCapiAccessToken) {
      res.status(400).json({
        success: false,
        message: 'Configure Pixel ID and Access Token first',
      });
      return;
    }

    const result = await sendMetaCapiEvents(
      {
        pixelId:       analytics.metaPixelId,
        accessToken:   revealSecret(analytics.metaCapiAccessToken),
        testEventCode: analytics.metaCapiTestCode || undefined,
      },
      [
        {
          eventName:      'PageView',
          eventTime:      Math.floor(Date.now() / 1000),
          eventId:        generateEventId(),
          eventSourceUrl: req.headers.referer || req.headers.origin || undefined,
          actionSource:   'website',
          userData: {
            clientIpAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
            clientUserAgent: req.headers['user-agent'] || 'CAPI-Test',
          },
        },
      ],
    );

    if (result.success) {
      res.json({
        success: true,
        message: `Test event sent successfully. ${result.eventsReceived ?? 0} event(s) received by Meta.`,
      });
    } else {
      res.status(400).json({ success: false, message: `Test failed: ${result.error}` });
    }
  } catch (error: any) {
    console.error('[Tracking] CAPI test request failed:', error);
    res.status(500).json({ success: false, message: 'Meta CAPI test could not be completed' });
  }
};
