export type AnalyticsConsent = 'accepted' | 'rejected' | null;
export type AnalyticsItem = {
  id: string;
  name: string;
  category?: string;
  price: number;
  quantity: number;
};

const CONSENT_KEY = 'nix-analytics-consent-v1';
const loadedGa = new Set<string>();
const loadedPixels = new Set<string>();

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: any[]) => void;
  fbq?: (...args: any[]) => void;
  _fbq?: (...args: any[]) => void;
};

// ── Event ID for browser ↔ server deduplication ──────────────────────

let eventCounter = 0;
let currentAnalytics: { googleAnalyticsId?: string; metaPixelId?: string; metaCapiEnabled?: boolean } = {};

/** Generate a unique event ID.  The same ID is sent from both the
 *  browser pixel and the server CAPI so Meta can deduplicate. */
export function generateEventId(): string {
  return `nix_${Date.now()}_${++eventCounter}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Meta cookie helpers ──────────────────────────────────────────────

/** Read _fbc and _fbp cookies for CAPI user matching. */
export function getMetaCookies(): { fbc?: string; fbp?: string } {
  try {
    const cookies = document.cookie.split(';').reduce((acc, c) => {
      const [key, ...val] = c.trim().split('=');
      acc[key] = val.join('=');
      return acc;
    }, {} as Record<string, string>);
    return { fbc: cookies._fbc || undefined, fbp: cookies._fbp || undefined };
  } catch { return {}; }
}

// ── Consent ──────────────────────────────────────────────────────────

export function isTrackingAllowed(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) !== 'rejected';
  } catch {
    return true;
  }
}

export function getAnalyticsConsent(): AnalyticsConsent {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'accepted' || value === 'rejected' ? value : null;
  } catch { return null; }
}

export function setAnalyticsConsent(value: Exclude<AnalyticsConsent, null>) {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* tracking remains off if storage is unavailable */ }
  if (value === 'rejected') {
    const names = new Set(['_fbp', '_fbc']);
    try { for (const part of document.cookie.split(';')) { const name = part.trim().split('=')[0]; if (/^_(ga|gid|gat)/i.test(name)) names.add(name); } } catch { /* cookie access can be disabled */ }
    for (const name of names) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
      const parts = window.location.hostname.split('.');
      if (parts.length > 1) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${parts.slice(-2).join('.')}; SameSite=Lax`;
    }
    try { for (const key of ['nix-checkout-phone', 'nix-checkout-email', 'nix-checkout-name']) localStorage.removeItem(key); } catch { /* best-effort removal of legacy checkout data */ }
  }
  window.dispatchEvent(new CustomEvent('nix-analytics-consent', { detail: value }));
}

export function openAnalyticsPreferences() {
  try { localStorage.removeItem(CONSENT_KEY); } catch { /* the banner still opens */ }
  window.dispatchEvent(new CustomEvent('nix-analytics-consent', { detail: null }));
}

function safeTrackingUrl(): string {
  const url = new URL(window.location.href);
  const allowed = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'gclid', 'dclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid']);
  for (const key of [...url.searchParams.keys()]) if (!allowed.has(key.toLowerCase())) url.searchParams.delete(key);
  url.hash = '';
  return url.toString();
}

// ── Script loading & configuration ──────────────────────────────────

export function configureAnalytics(config?: { googleAnalyticsId?: string; metaPixelId?: string; metaCapiEnabled?: boolean }) {
  currentAnalytics = config || {};
  const target = window as AnalyticsWindow;
  if (!isTrackingAllowed()) {
    target.gtag?.('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    return;
  }
  const gaId = config?.googleAnalyticsId?.trim() || '';
  const pixelId = config?.metaPixelId?.trim() || '';

  if (/^G-[A-Z0-9]{4,}$/i.test(gaId) && !loadedGa.has(gaId)) {
    loadedGa.add(gaId);
    target.dataLayer = target.dataLayer || [];
    target.gtag = target.gtag || function (...args: any[]) { target.dataLayer!.push(args); };
    target.gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
    target.gtag('js', new Date());
    target.gtag('config', gaId, { send_page_view: false });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    script.dataset.nixAnalytics = gaId;
    document.head.appendChild(script);
  }

  if (/^\d{5,20}$/.test(pixelId) && !loadedPixels.has(pixelId)) {
    loadedPixels.add(pixelId);
    if (!target.fbq) {
      const fbq: any = function (...args: any[]) {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, args);
        else fbq.queue.push(args);
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      target.fbq = fbq;
      target._fbq = fbq;
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      script.dataset.nixAnalytics = 'meta-pixel';
      document.head.appendChild(script);
    }
    target.fbq?.('init', pixelId);
  }
}

// ── Event tracking ──────────────────────────────────────────────────

const pixelEvents: Record<string, string> = {
  page_view: 'PageView', view_item: 'ViewContent', view_item_list: 'ViewContent', search: 'Search', add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout', add_payment_info: 'AddPaymentInfo', purchase: 'Purchase',
  sign_up: 'CompleteRegistration', login: 'Lead',
};

const relayToServer = (eventName: string, eventId: string, params: Record<string, unknown> = {}, customKey?: string) => {
  if (!currentAnalytics.metaCapiEnabled || !isTrackingAllowed()) return;
  const { fbc, fbp } = getMetaCookies();
  const allowedKeys = ['currency', 'value', 'content_ids', 'contents', 'content_type', 'num_items', 'search_string', 'order_id', 'coupon', 'event_category', 'event_label', 'page_path', 'element_text'];
  const customData = Object.fromEntries(Object.entries(params).filter(([key]) => allowedKeys.includes(key)));
  void fetch('/api/storefront/tracking/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventName, eventId, eventSourceUrl: safeTrackingUrl(), consent: true, fbc, fbp, customData, customKey }),
    keepalive: true,
  }).catch(() => undefined);
};

export function trackAnalyticsEvent(name: string, params: Record<string, unknown> = {}, sharedEventId?: string): string | undefined {
  if (!isTrackingAllowed()) return undefined;
  const eventId = sharedEventId || generateEventId();
  const target = window as AnalyticsWindow;
  const items = Array.isArray(params.items) ? params.items as AnalyticsItem[] : [];
  const value = typeof params.value === 'number' ? params.value : 0;
  const gaParams = items.length ? { ...params, items: items.map((item) => ({ item_id: item.id, item_name: item.name, item_category: item.category, price: item.price, quantity: item.quantity })) } : params;
  target.gtag?.('event', name, { ...gaParams, event_id: eventId });
  const relayParams = { ...params, ...(typeof params.search_term === 'string' ? { search_string: params.search_term.slice(0, 200) } : {}) };
  if (items.length) Object.assign(relayParams, {
    currency: params.currency || 'BDT',
    value: params.value ?? items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    content_ids: items.map((item) => item.id),
    contents: items.map((item) => ({ id: item.id, quantity: item.quantity, item_price: item.price })),
    content_type: 'product', num_items: items.reduce((sum, item) => sum + item.quantity, 0),
  });
  relayToServer(name, eventId, relayParams);

  const pixelName = pixelEvents[name];
  if (!target.fbq) return eventId;

  if (pixelName === 'PageView') {
    target.fbq('track', 'PageView', {}, { eventID: eventId });
  } else {
    const pixelParams: Record<string, unknown> = { currency: params.currency || 'BDT' };
    if (value > 0 || name === 'purchase') pixelParams.value = value;
    if (typeof params.search_term === 'string') pixelParams.search_string = params.search_term.slice(0, 200);
    if (items.length) {
      pixelParams.content_ids = items.map((item) => item.id);
      pixelParams.contents = items.map((item) => ({ id: item.id, quantity: item.quantity, item_price: item.price }));
      pixelParams.content_type = 'product';
      pixelParams.num_items = items.reduce((total, item) => total + item.quantity, 0);
      if (items[0]?.name) pixelParams.content_name = items[0].name;
      if (items[0]?.category) pixelParams.content_category = items[0].category;
    }
    if (pixelName) {
      target.fbq('track', pixelName, pixelParams, { eventID: eventId });
    } else if (name === 'view_cart' || name === 'login') {
      target.fbq('trackCustom', name === 'view_cart' ? 'ViewCart' : 'Login', pixelParams, { eventID: eventId });
    }
  }
  return eventId;
}

export function trackPurchaseOnce(orderNumber: string, params: Record<string, unknown>, sharedEventId?: string): string | undefined {
  if (!isTrackingAllowed()) return undefined;
  const key = `nix-purchase-tracked:${orderNumber}`;
  try { if (localStorage.getItem(key)) return undefined; localStorage.setItem(key, '1'); } catch { /* the checkout request is still tracked if storage is unavailable */ }
  return trackAnalyticsEvent('purchase', { ...params, order_id: orderNumber }, sharedEventId);
}

export function productAnalyticsItem(product: { id: string; name: string; category?: string; salePrice: number }, quantity = 1): AnalyticsItem {
  return { id: product.id, name: product.name, category: product.category, price: Number(product.salePrice) || 0, quantity };
}

// ── Custom events (admin-defined) ───────────────────────────────────

/** Fire a custom event to both GA4 and Meta.
 *  Custom events use `trackCustom` for Meta (unless a standard name is
 *  configured in the admin panel). */
export function trackCustomEvent(eventName: string, params: Record<string, unknown> = {}, mapping?: { ga4Event?: string; metaEvent?: string; metaEventType?: 'custom' | 'standard' }): string | undefined {
  if (!isTrackingAllowed()) return undefined;
  const eventId = generateEventId();
  const target = window as AnalyticsWindow;
  const gaName = mapping?.ga4Event || eventName;
  target.gtag?.('event', gaName, { ...params, event_id: eventId });
  if (target.fbq) {
    const metaName = mapping?.metaEvent || eventName;
    target.fbq(mapping?.metaEventType === 'standard' ? 'track' : 'trackCustom', metaName, params, { eventID: eventId });
  }
  relayToServer(mapping?.ga4Event || eventName, eventId, params, eventName);
  return eventId;
}
