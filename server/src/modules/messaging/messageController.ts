import { Request, Response } from 'express';
import prisma from '../../prisma';
import { AuthRequest } from '../../middlewares/auth';
import { sendWhatsAppMessage, sendSmsMessage } from './messageService';
import { config as appConfig } from '../../config';
import { isAllowedRemoteUrl, keepExistingSecret, maskSecret, revealSecret } from '../../utils/security';
import { z } from 'zod';
import { formatBdPhone } from './messageService';
import axios from 'axios';

const GREENWEB_URL = 'https://api.bdbulksms.net/api.php?json';
const GREENWEB_STATS_URL = 'https://api.bdbulksms.net/g_api.php';

export const getGreenSmsStats = async (req: Request, res: Response): Promise<void> => {
  const month = String(req.query.month || '').trim();
  if (month && !/^(0[1-9]|1[0-2])-\d{4}$/.test(month)) { res.status(400).json({ success: false, message: 'Use MM-YYYY for the month' }); return; }
  try {
    const gateway = await prisma.messageGatewayConfig.findUnique({ where: { type: 'GREENWEB' }, select: { apiKey: true } });
    if (!gateway?.apiKey) { res.status(409).json({ success: false, message: 'Save a GreenSMS API token first' }); return; }
    const params = new URLSearchParams({ token: revealSecret(gateway.apiKey) });
    for (const key of ['balance', 'expiry', 'rate', 'tokensms', 'totalsms']) params.append(key, '');
    params.append('monthlysms', month);
    params.append('tokenmonthlysms', month);
    params.append('json', '');
    const result = await axios.get(GREENWEB_STATS_URL, { params, timeout: 12000, maxRedirects: 0, responseType: 'text', validateStatus: (status) => status === 200 });
    const rows = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    if (!Array.isArray(rows)) throw new Error('Unexpected GreenSMS response');
    const keys = ['balance', 'expiry', 'rate', 'tokensms', 'totalsms', 'monthlysms', 'tokenmonthlysms'] as const;
    const stats: Record<string, string | null> = Object.fromEntries(keys.map((key) => [key, null]));
    for (const row of rows) {
      const key = String(row?.action || '').split(':')[0].toLowerCase();
      if (keys.includes(key as typeof keys[number])) stats[key] = String(row?.response ?? '').slice(0, 100);
    }
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({ success: true, stats, month: month || null, fetchedAt: new Date().toISOString() });
  } catch { res.status(502).json({ success: false, message: 'Could not load GreenSMS account data. Check the token and try again.' }); }
};

export const getGatewayConfigs = async (req: Request, res: Response): Promise<void> => {
  try {
    const configs = await prisma.messageGatewayConfig.findMany();
    res.json({ success: true, configs: configs.map((item) => ({ ...item, apiKey: maskSecret(item.apiKey), clientSecret: maskSecret(item.clientSecret) })) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const revealGatewayToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const type = String(req.params.type || '').toUpperCase();
    if (!['GREENWEB', 'WHATSAPP_BAILEYS'].includes(type)) { res.status(400).json({ success: false, message: 'Unsupported token type' }); return; }
    const config = await prisma.messageGatewayConfig.findUnique({ where: { type }, select: { apiKey: true } });
    if (!config?.apiKey) { res.status(404).json({ success: false, message: 'No token is saved for this gateway' }); return; }
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({ success: true, apiKey: revealSecret(config.apiKey) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Could not reveal saved gateway token' });
  }
};

export const updateGatewayConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const type = String(req.params.type || '').toUpperCase();
    const { apiUrl, apiKey, senderId, clientId, clientSecret, isEnabled, isDefault } = req.body;
    if (!['GREENWEB', 'WHATSAPP_BAILEYS', 'BULKSMSBD'].includes(type)) { res.status(400).json({ success: false, message: 'Unsupported messaging gateway' }); return; }
    if (type !== 'GREENWEB' && apiUrl && !isAllowedRemoteUrl(apiUrl, appConfig.isDev)) { res.status(400).json({ success: false, message: 'Use a public HTTPS gateway URL' }); return; }
    const existing = await prisma.messageGatewayConfig.findUnique({ where: { type } });
    const nextApiKey = keepExistingSecret(apiKey, existing?.apiKey);
    const nextEnabled = isEnabled ?? existing?.isEnabled ?? (type !== 'GREENWEB');
    if (type === 'GREENWEB' && nextEnabled && !nextApiKey) { res.status(400).json({ success: false, message: 'Add a GreenSMS token before enabling SMS' }); return; }
    if (type === 'GREENWEB' && nextEnabled && nextApiKey && revealSecret(nextApiKey) === '1234567890123456789') { res.status(400).json({ success: false, message: 'The demo token cannot send real SMS' }); return; }
    const config = await prisma.messageGatewayConfig.upsert({
      where: { type },
      create: {
        type,
        apiUrl: type === 'GREENWEB' ? GREENWEB_URL : apiUrl,
        apiKey: nextApiKey,
        senderId,
        clientId,
        clientSecret: keepExistingSecret(clientSecret),
        isEnabled: nextEnabled,
        isDefault: isDefault ?? false,
      },
      update: {
        apiUrl: type === 'GREENWEB' ? GREENWEB_URL : apiUrl,
        apiKey: nextApiKey,
        senderId,
        clientId,
        clientSecret: keepExistingSecret(clientSecret, existing?.clientSecret),
        isEnabled,
        isDefault,
      },
    });

    res.json({ success: true, message: `${type} config updated`, config: { ...config, apiKey: maskSecret(config.apiKey), clientSecret: maskSecret(config.clientSecret) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await prisma.messageTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, templates });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTemplate = async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({ name: z.string().trim().min(2).max(100), channel: z.enum(['WHATSAPP', 'SMS', 'BOTH']),
    body: z.string().trim().min(1).max(1000), isActive: z.boolean() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid message template' }); return; }
  try {
    const id = req.params.id as string;
    const updated = await prisma.messageTemplate.update({
      where: { id },
      data: parsed.data,
    });

    res.json({ success: true, message: 'Template updated', template: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendDirectMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ recipient: z.string().trim().refine(value => Boolean(formatBdPhone(value)), 'Enter a valid Bangladesh mobile number'),
    message: z.string().trim().min(1).max(1000), channel: z.enum(['WHATSAPP', 'SMS']).default('SMS'), orderId: z.string().uuid().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid message' }); return; }
  try {
    const { recipient, message, channel, orderId } = parsed.data;

    let result;
    if (channel === 'WHATSAPP') {
      result = await sendWhatsAppMessage(recipient, message);
    } else {
      result = await sendSmsMessage(recipient, message);
    }

    await prisma.messageLog.create({
      data: {
        recipient,
        channel,
        body: message,
        status: result.success ? 'SENT' : 'FAILED',
        errorMessage: result.message,
        orderId,
      },
    });

    res.status(result.success ? 200 : result.skipped ? 409 : 502).json({ success: result.success, message: result.success ? `${channel} accepted by gateway` : result.message || 'Gateway did not accept the message', result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listMessageLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await prisma.messageLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, orderNumber: true, customerName: true } },
      },
    });
    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
