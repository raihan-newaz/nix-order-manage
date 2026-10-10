import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../prisma';
import { protectSecret } from '../../utils/security';
import { safeUrl } from '../builder/core/schema';

const storefrontLink = z.string().trim().min(1).max(240).refine(safeUrl, 'Use a site path, HTTP(S), phone or email link');

const themeConfigSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  mutedColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontFamily: z.enum(['Manrope', 'Inter', 'Plus Jakarta Sans']),
  buttonRadius: z.enum(['square', 'soft', 'round']),
  cardRadius: z.enum(['square', 'soft', 'round']),
  headerMode: z.enum(['STICKY', 'STATIC']),
  productDensity: z.enum(['COMFORTABLE', 'COMPACT']),
  showAnnouncement: z.boolean(),
  showTrustBar: z.boolean(),
  showBestSellers: z.boolean(),
  showAbout: z.boolean(),
  maintenanceMode: z.boolean().optional(),
  variationStyle: z.enum(['SOFT', 'CIRCLE', 'SQUARE']).optional(),
  showColorName: z.boolean().optional(),
  buyNowText: z.string().trim().min(2).max(30).optional(),
  checkoutFields: z.array(z.object({ key: z.string().min(1).max(40), label: z.string().min(1).max(80), type: z.enum(['text','email','tel','textarea','number','select']), enabled: z.boolean(), required: z.boolean(), placeholder: z.string().max(120).optional(), options: z.array(z.string().max(80)).max(20).optional(), custom: z.boolean().optional() })).max(20).optional(),
  analytics: z.object({
    googleAnalyticsId: z.string().trim().regex(/^(|G-[A-Z0-9]{4,})$/i, 'Enter a valid GA4 measurement ID (G-XXXXXXXXXX)').optional(),
    metaPixelId: z.string().trim().regex(/^(|\d{5,20})$/, 'Enter a valid Meta Pixel ID').optional(),
    customEvents: z.array(z.object({
      name: z.string().min(1).max(60),
      selector: z.string().max(200).optional(),
      ga4Event: z.string().max(60).optional(),
      metaEvent: z.string().max(60).optional(),
      metaEventType: z.enum(['custom', 'standard']).optional(),
    })).max(20).optional(),
  }).optional(),
  headerMenu: z.array(z.object({ label: z.string().min(1).max(40), url: storefrontLink })).max(10).optional(),
  footerMenus: z.array(z.object({ heading: z.string().min(1).max(40), items: z.array(z.object({ label: z.string().min(1).max(40), url: storefrontLink })).max(8) })).max(3).optional(),
  showcase: z.array(z.object({ id: z.string().min(1), eyebrow: z.string().max(50), title: z.string().min(1).max(80), source: z.enum(['NEW', 'BEST', 'CATEGORY']), category: z.string().max(120).optional(), limit: z.number().int().min(1).max(12), enabled: z.boolean() })).max(8).optional(),
});

const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(40),
  announcement: z.string().trim().min(4).max(140),
  heroEyebrow: z.string().trim().min(2).max(60),
  heroTitle: z.string().trim().min(4).max(120),
  heroText: z.string().trim().min(8).max(300),
  phone: z.string().trim().min(5).max(30),
  insideDhakaCharge: z.number().min(0).max(1000),
  subAreaCharge: z.number().min(0).max(1000),
  outsideDhakaCharge: z.number().min(0).max(1000),
  featuredCategories: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  heroImages: z.array(z.string().trim().max(500).refine((value) => value.startsWith('/') || /^https?:\/\//i.test(value), 'Use a relative upload path or a full image URL')).max(8).optional(),
  heroButtonLabel: z.string().trim().min(2).max(30),
  heroButtonUrl: storefrontLink,
  aboutTitle: z.string().trim().min(4).max(120),
  aboutText: z.string().trim().min(8).max(400),
  footerText: z.string().trim().min(4).max(180),
  themeConfig: themeConfigSchema.optional(),
});

const defaultThemeConfig = {
  primaryColor: '#171815', accentColor: '#d8ff55', backgroundColor: '#f7f6f2', textColor: '#171815', mutedColor: '#707269',
  fontFamily: 'Manrope', buttonRadius: 'square', cardRadius: 'square', headerMode: 'STICKY', productDensity: 'COMFORTABLE',
  showAnnouncement: true, showTrustBar: true, showBestSellers: true, showAbout: true, maintenanceMode: false,
  variationStyle: 'SOFT',
  showColorName: true,
  buyNowText: 'Buy now',
  checkoutFields: [
    { key: 'name', label: 'Full name', type: 'text', enabled: true, required: true },
    { key: 'phone', label: 'Mobile number', type: 'tel', enabled: true, required: true },
    { key: 'email', label: 'Email address', type: 'email', enabled: true, required: false },
    { key: 'address', label: 'Full delivery address', type: 'textarea', enabled: true, required: true },
    { key: 'district', label: 'District', type: 'text', enabled: true, required: true },
    { key: 'city', label: 'City / area', type: 'text', enabled: true, required: false },
    { key: 'note', label: 'Order note', type: 'text', enabled: true, required: false },
  ],
  analytics: { googleAnalyticsId: '', metaPixelId: '' },
};

const parseJsonOr = (value: string | null | undefined, fallback: any) => {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

const publicSettings = (settings: any) => ({
  ...(({ uddoktaApiKey, uddoktaBaseUrl, ...safe }) => safe)(settings),
  onlinePaymentEnabled: Boolean(settings.uddoktaEnabled && settings.uddoktaApiKey && settings.uddoktaBaseUrl),
  featuredCategories: parseJsonOr(settings.featuredCategories, []),
  heroImages: parseJsonOr(settings.heroImages, []),
  themeConfig: (() => {
    const stored = parseJsonOr(settings.themeConfig, {});
    const config = { ...defaultThemeConfig, ...stored };
    const analytics = { ...(config as any).analytics };
    delete analytics.metaCapiAccessToken;
    delete analytics.metaCapiTestCode;
    (config as any).analytics = {
      ...analytics,
      metaCapiEnabled: Boolean(stored.analytics?.metaPixelId && stored.analytics?.metaCapiAccessToken),
    };
    return config;
  })(),
});

export const getStorefrontSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.storefrontSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
    res.json({ success: true, settings: publicSettings(settings) });
  } catch (error: any) { console.error('[Storefront] Could not read public settings:', error); res.status(500).json({ success: false, message: 'Storefront settings are temporarily unavailable' }); }
};

export const updateStorefrontSettings = async (req: Request, res: Response): Promise<void> => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid storefront settings' }); return; }
  try {
    const { themeConfig, ...data } = parsed.data;
    let themeForStorage = themeConfig;
    if (themeConfig) {
      const current = await prisma.storefrontSettings.findUnique({ where: { id: 'default' }, select: { themeConfig: true } });
      const currentTheme = parseJsonOr(current?.themeConfig, {});
      const nextAnalytics = { ...(themeConfig as any).analytics };
      for (const key of ['metaCapiAccessToken', 'metaCapiTestCode']) {
        if (currentTheme.analytics?.[key] && nextAnalytics[key] === undefined) nextAnalytics[key] = currentTheme.analytics[key];
      }
      if (nextAnalytics.metaCapiAccessToken && !String(nextAnalytics.metaCapiAccessToken).startsWith('enc:v1:')) {
        nextAnalytics.metaCapiAccessToken = protectSecret(String(nextAnalytics.metaCapiAccessToken));
      }
      themeForStorage = { ...themeConfig, analytics: nextAnalytics } as typeof themeConfig;
    }
    const settings = await prisma.storefrontSettings.upsert({
      where: { id: 'default' },
      update: { ...data, featuredCategories: JSON.stringify(data.featuredCategories || []), heroImages: JSON.stringify(data.heroImages || []), ...(themeForStorage ? { themeConfig: JSON.stringify(themeForStorage) } : {}) },
      create: { id: 'default', ...data, featuredCategories: JSON.stringify(data.featuredCategories || []), heroImages: JSON.stringify(data.heroImages || []), themeConfig: JSON.stringify(themeForStorage || defaultThemeConfig) },
    });
    res.json({ success: true, settings: publicSettings(settings) });
  } catch (error: any) { console.error('[Storefront] Could not save settings:', error); res.status(500).json({ success: false, message: 'Could not save storefront settings' }); }
};
