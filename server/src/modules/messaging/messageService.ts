import axios from 'axios';
import { Prisma } from '@prisma/client';
import prisma from '../../prisma';
import { revealSecret } from '../../utils/security';

export const SMS_EVENTS = [
  'ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_PACKAGING', 'ORDER_HANDED_OVER',
  'DISPATCHED_TRACKING', 'ORDER_IN_TRANSIT', 'OUT_FOR_DELIVERY',
  'DELIVERED_THANK_YOU', 'ORDER_PARTIAL_DELIVERED', 'ORDER_HOLD',
  'ORDER_CANCELLED', 'ORDER_RETURNED', 'PAYMENT_RECEIVED',
] as const;
export type MessageEvent = typeof SMS_EVENTS[number];

type SendResult = { success: boolean; skipped?: boolean; message?: string; data?: unknown };
const GREENWEB_API_URL = 'https://api.bdbulksms.net/api.php?json';
const DEMO_TOKEN = '1234567890123456789';

export function formatBdPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^01[3-9]\d{8}$/.test(digits)) return `88${digits}`;
  if (/^8801[3-9]\d{8}$/.test(digits)) return digits;
  return '';
}

export async function sendWhatsAppMessage(recipient: string, message: string): Promise<SendResult> {
  const config = await prisma.messageGatewayConfig.findUnique({ where: { type: 'WHATSAPP_BAILEYS' } });
  if (!config?.isEnabled || !config.apiUrl) return { success: false, skipped: true, message: 'WhatsApp gateway is disabled' };
  const formattedPhone = formatBdPhone(recipient);
  if (!formattedPhone) return { success: false, message: 'Invalid Bangladesh phone number' };
  try {
    const response = await axios.post(`${config.apiUrl.replace(/\/+$/, '')}/send-message`,
      { receiver: `${formattedPhone}@s.whatsapp.net`, message: { text: message } },
      { headers: config.apiKey ? { Authorization: `Bearer ${revealSecret(config.apiKey)}` } : {}, timeout: 10000, maxRedirects: 0 });
    return { success: response.status >= 200 && response.status < 300, data: response.data };
  } catch (error: any) { return { success: false, message: `WhatsApp gateway error (HTTP ${error.response?.status || 'network'})` }; }
}

export async function sendSmsMessage(recipient: string, message: string): Promise<SendResult> {
  const formattedPhone = formatBdPhone(recipient);
  if (!formattedPhone) return { success: false, message: 'Invalid Bangladesh phone number' };
  if (!message.trim() || message.length > 1000) return { success: false, message: 'SMS must be 1 to 1000 characters' };
  const configs = await prisma.messageGatewayConfig.findMany({ where: { type: { in: ['GREENWEB', 'BULKSMSBD'] }, isEnabled: true }, orderBy: { isDefault: 'desc' } });
  const config = configs.find(item => item.type === 'GREENWEB') || configs[0];
  if (!config?.apiKey) return { success: false, skipped: true, message: 'SMS gateway is disabled or missing its token' };
  try {
    if (config.type === 'GREENWEB') {
      const token = revealSecret(config.apiKey);
      if (token === DEMO_TOKEN) return { success: false, skipped: true, message: 'Demo token cannot deliver SMS' };
      const response = await axios.post(GREENWEB_API_URL,
        { token, smsdata: [{ to: formattedPhone, message: message.trim() }] },
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 12000, maxRedirects: 0 });
      const item = Array.isArray(response.data) ? response.data[0] : response.data;
      const accepted = item?.status === 'SENT';
      return { success: accepted, message: accepted ? undefined : String(item?.statusmsg || 'GreenSMS did not accept the message').slice(0, 500), data: { status: item?.status } };
    }
    const response = await axios.post(`${String(config.apiUrl || '').replace(/\/+$/, '')}/smsapi`, {
      api_key: revealSecret(config.apiKey), type: 'text', number: formattedPhone,
      senderid: config.senderId || '', message: message.trim(),
    }, { timeout: 12000, maxRedirects: 0 });
    const accepted = response.data?.response_code === 202 || response.data?.status === 'SENT';
    return { success: accepted, message: accepted ? undefined : 'Legacy SMS gateway did not confirm acceptance' };
  } catch (error: any) { return { success: false, message: `SMS gateway error (HTTP ${error.response?.status || 'network'})` }; }
}

const trackingLink = (order: any) => {
  if (order.courierTrackingLink) return order.courierTrackingLink;
  if (!order.courierTrackingCode) return '';
  if (order.courierName === 'STEADFAST') return `https://steadfast.com.bd/t/${order.courierTrackingCode}`;
  if (order.courierName === 'PATHAO') return `https://pathao.com/courier/tracking/?consignment_id=${order.courierConsignmentId || ''}`;
  if (order.courierName === 'REDX') return `https://redx.com.bd/track-parcel/?trackingId=${order.courierTrackingCode}`;
  return '';
};

export const renderMessage = (body: string, order: any) => {
  const tags: Record<string, string> = {
    customer_name: order.customerName || 'Customer', order_number: order.orderNumber || '',
    grand_total: String(order.grandTotal ?? 0),
    cod_amount: String(Math.max(0, Number(order.grandTotal || 0) - Number(order.advancePaid || 0))),
    courier_name: order.courierName || '', tracking_code: order.courierTrackingCode || '',
    tracking_url: trackingLink(order),
  };
  return body.replace(/\{([a-z_]+)\}/g, (match, key) => tags[key] ?? match).trim();
};

export async function sendOrderNotification({ eventTrigger, order }: { eventTrigger: MessageEvent; order: any }) {
  if (!order?.id || !order.customerPhone) return;
  const templates = await prisma.messageTemplate.findMany({ where: { eventTrigger, isActive: true } });
  for (const template of templates) {
    const rendered = renderMessage(template.body, order);
    for (const channel of (template.channel === 'BOTH' ? ['WHATSAPP', 'SMS'] : [template.channel])) {
      if (channel !== 'WHATSAPP' && channel !== 'SMS') continue;
      const configured = await prisma.messageGatewayConfig.findFirst({ where: channel === 'SMS' ?
        { type: { in: ['GREENWEB', 'BULKSMSBD'] }, isEnabled: true, apiKey: { not: null } } :
        { type: 'WHATSAPP_BAILEYS', isEnabled: true, apiUrl: { not: null } }, select: { id: true } });
      if (!configured) continue;
      const dedupeKey = `${order.id}:${eventTrigger}:${channel}:${template.id}`;
      let log;
      try {
        log = await prisma.messageLog.create({ data: { recipient: order.customerPhone, channel, eventTrigger, body: rendered,
          status: 'QUEUED', orderId: order.id, dedupeKey } });
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
        throw error;
      }
      const result = channel === 'SMS' ? await sendSmsMessage(order.customerPhone, rendered) : await sendWhatsAppMessage(order.customerPhone, rendered);
      await prisma.messageLog.update({ where: { id: log.id }, data: { status: result.success ? 'SENT' : 'FAILED', errorMessage: result.message || null } });
    }
  }
}

const statusEvents: Record<string, MessageEvent> = {
  CONFIRMED: 'ORDER_CONFIRMED', PACKAGING: 'ORDER_PACKAGING', HANDED_OVER: 'ORDER_HANDED_OVER',
  IN_TRANSIT: 'ORDER_IN_TRANSIT', PARTIAL_DELIVERED: 'ORDER_PARTIAL_DELIVERED',
  DELIVERED: 'DELIVERED_THANK_YOU', HOLD: 'ORDER_HOLD', CANCELLED: 'ORDER_CANCELLED', RETURNED: 'ORDER_RETURNED',
};

export const notifyOrderStatus = async (order: any) => {
  const eventTrigger = statusEvents[order.status];
  if (eventTrigger) await sendOrderNotification({ eventTrigger, order });
};

export const notifyCourierEvent = async (orderId: string, courierEvent: string) => {
  const event = courierEvent.toLowerCase();
  const trigger: MessageEvent | undefined =
    /^(order\.)?paid$/.test(event) ? 'PAYMENT_RECEIVED' :
    /assigned-for-delivery|delivery-in-progress|out-for-delivery/.test(event) ? 'OUT_FOR_DELIVERY' :
    /partial.deliver/.test(event) ? 'ORDER_PARTIAL_DELIVERED' :
    /return/.test(event) ? 'ORDER_RETURNED' :
    /delivered/.test(event) ? 'DELIVERED_THANK_YOU' :
    /hold|delivery-failed|agent-area-change/.test(event) ? 'ORDER_HOLD' :
    /picked|ready-for-delivery/.test(event) ? 'ORDER_HANDED_OVER' :
    /transit|agent-returning/.test(event) ? 'ORDER_IN_TRANSIT' : undefined;
  if (!trigger) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order && !order.trashedAt) await sendOrderNotification({ eventTrigger: trigger, order });
};
