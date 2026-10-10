/**
 * Meta Conversions API (CAPI) — Direct Server-to-Server Event Sending
 *
 * Sends e-commerce events directly from the Express server to Meta's
 * Graph API.  No third-party tracking proxy is required; the store's
 * own Node.js process handles everything.
 *
 * Key features:
 *  • SHA-256 hashing of all PII (email, phone, name, city, etc.)
 *  • Bangladesh phone normalization (01… → +880…) to E.164
 *  • event_id generation for browser ↔ server deduplication
 *  • _fbc / _fbp cookie forwarding for user matching
 */

import crypto from 'crypto';

// ── Types ────────────────────────────────────────────────────────────

export interface MetaCapiConfig {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
}

export interface MetaUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  country?: string;
  externalId?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string;
  fbp?: string;
}

export interface MetaCapiEvent {
  eventName: string;
  eventTime: number;
  eventId: string;
  eventSourceUrl?: string;
  actionSource: 'website';
  userData: MetaUserData;
  customData?: Record<string, unknown>;
}

interface MetaApiResponse {
  events_received?: number;
  messages?: string[];
  fbtrace_id?: string;
  error?: { message: string; type: string; code: number };
}

// ── Helpers ──────────────────────────────────────────────────────────

/** SHA-256 hash per Meta's normalisation spec (trim + lowercase → hex). */
const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');

/** Normalise a Bangladesh mobile number to E.164 for Meta hashing. */
const normalizePhoneForMeta = (phone: string): string => {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+880')) return cleaned;
  if (cleaned.startsWith('880'))  return `+${cleaned}`;
  if (cleaned.startsWith('0'))    return `+880${cleaned.slice(1)}`;
  return `+880${cleaned}`;
};

/**
 * Build the `user_data` payload with correct hashing.
 * Fields that are already identifiers (IP, UA, fbc, fbp) are sent raw.
 */
const buildUserData = (raw: MetaUserData): Record<string, string | undefined> => {
  const data: Record<string, string | undefined> = {};

  if (raw.email) data.em = sha256(raw.email);
  if (raw.phone) data.ph = sha256(normalizePhoneForMeta(raw.phone));

  if (raw.firstName) {
    const parts = raw.firstName.trim().split(/\s+/);
    data.fn = sha256(parts[0]);
    if (parts.length > 1) data.ln = sha256(parts[parts.length - 1]);
  }
  if (raw.lastName && !data.ln) data.ln = sha256(raw.lastName);

  if (raw.city)    data.ct      = sha256(raw.city);
  if (raw.state)   data.st      = sha256(raw.state);
  data.country = sha256(raw.country || 'bd');

  if (raw.externalId) data.external_id = sha256(raw.externalId);

  // Non-hashed identifiers
  if (raw.clientIpAddress) data.client_ip_address = raw.clientIpAddress;
  if (raw.clientUserAgent) data.client_user_agent = raw.clientUserAgent;
  if (raw.fbc) data.fbc = raw.fbc;
  if (raw.fbp) data.fbp = raw.fbp;

  return data;
};

// ── Public API ───────────────────────────────────────────────────────

/**
 * Send one or more events to the Meta Conversions API.
 *
 * Resolves with `{ success, eventsReceived?, error? }`.  Failures are
 * logged but never thrown so checkout is never blocked.
 */
export async function sendMetaCapiEvents(
  config: MetaCapiConfig,
  events: MetaCapiEvent[],
): Promise<{ success: boolean; eventsReceived?: number; error?: string }> {
  if (!config.pixelId || !config.accessToken) {
    return { success: false, error: 'Missing Pixel ID or Access Token' };
  }

  const payload: Record<string, unknown> = {
    data: events.map((event) => ({
      event_name:       event.eventName,
      event_time:       event.eventTime,
      event_id:         event.eventId,
      event_source_url: event.eventSourceUrl,
      action_source:    event.actionSource,
      user_data:        buildUserData(event.userData),
      custom_data:      event.customData,
    })),
    ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}),
  };

  try {
    const url =
      `https://graph.facebook.com/v26.0/${encodeURIComponent(config.pixelId)}/events` +
      `?access_token=${encodeURIComponent(config.accessToken)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const body: MetaApiResponse = await response.json();

    if (!response.ok) {
      console.error('[CAPI] Meta returned error:', JSON.stringify(body));
      return { success: false, error: body.error?.message || `HTTP ${response.status}` };
    }

    return { success: true, eventsReceived: body.events_received };
  } catch (error: any) {
    console.error('[CAPI] Network error sending to Meta:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate a unique event ID for browser ↔ server deduplication.
 * The same ID is sent from the browser pixel *and* from the server so
 * Meta can match them and avoid double-counting.
 */
export const generateEventId = (): string =>
  `nix_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
