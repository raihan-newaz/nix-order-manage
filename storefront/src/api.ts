import type { CustomerAccount, CustomerOrder, OrderResult, Product, StorefrontSettings, StorePage } from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.text();
  let data: any = {};
  try { data = body ? JSON.parse(body) : {}; } catch { /* proxy and server failures may return an empty or non-JSON body */ }
  if (!response.ok) { const error = new Error(data.message || (response.status >= 500 ? 'The store service is temporarily unavailable. Please try again shortly.' : 'Something went wrong')); (error as any).status = response.status; throw error; }
  if (!body || typeof data !== 'object') throw new Error('The store returned an invalid response. Please refresh and try again.');
  return data;
}

// Public catalogue snapshots avoid replacing already-visible data with a loader.
// Every page still revalidates against the API; checkout validates stock server-side.
const productSnapshots = new Map<string, { value: Product; at: number }>();
const listSnapshots = new Map<string, { value: Product[]; at: number }>();
const snapshotLifetime = 30_000;
const readSession = <T>(key: string): T | undefined => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'at' in parsed && 'value' in parsed) {
      if (Date.now() - parsed.at < snapshotLifetime) return parsed.value as T;
    }
  } catch { /* storage disabled */ }
  return undefined;
};

const writeSession = <T>(key: string, value: T) => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ value, at: Date.now() }));
  } catch { /* storage full / private mode */ }
};

export const getCachedProduct = (id: string) => {
  const entry = productSnapshots.get(id);
  if (entry && Date.now() - entry.at < snapshotLifetime) return entry.value;
  const stored = readSession<Product>(`nix-product:${id}`);
  if (stored) { productSnapshots.set(id, { value: stored, at: Date.now() }); return stored; }
  return undefined;
};
export const getCachedProducts = (query = '') => {
  const entry = listSnapshots.get(query);
  if (entry && Date.now() - entry.at < snapshotLifetime) return entry.value;
  const stored = readSession<Product[]>(`nix-products:${query}`);
  if (stored) { listSnapshots.set(query, { value: stored, at: Date.now() }); return stored; }
  return undefined;
};
function rememberProduct(product: Product) {
  productSnapshots.delete(product.id);
  productSnapshots.set(product.id, { value: product, at: Date.now() });
  writeSession(`nix-product:${product.id}`, product);
  if (productSnapshots.size > 128) productSnapshots.delete(productSnapshots.keys().next().value!);
}
export const listProducts = async (query = '') => {
  const result = await request<{ success: boolean; products: Product[] }>(`/api/storefront/products${query}`);
  result.products.forEach(rememberProduct);
  listSnapshots.delete(query);
  listSnapshots.set(query, { value: result.products, at: Date.now() });
  writeSession(`nix-products:${query}`, result.products);
  if (listSnapshots.size > 16) listSnapshots.delete(listSnapshots.keys().next().value!);
  return result;
};
export const getProduct = async (id: string) => {
  const result = await request<{ success: boolean; product: Product }>(`/api/storefront/products/${encodeURIComponent(id)}`);
  rememberProduct(result.product);
  return result;
};
export const getCachedStorefrontSettings = (): StorefrontSettings | undefined => {
  try {
    const raw = localStorage.getItem('nix-storefront-settings-v1');
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
};
export const getStorefrontSettings = async () => {
  const result = await request<{ success: boolean; settings: StorefrontSettings }>('/api/storefront/settings');
  try {
    localStorage.setItem('nix-storefront-settings-v1', JSON.stringify(result.settings));
  } catch { /* storage full / private mode */ }
  return result;
};
const pageSnapshots = new Map<string, { value: StorePage; at: number }>();
const landingDesignSnapshots = new Map<string, { value: LandingDesign | null; at: number }>();

export const getCachedStorePage = (slug: string) => {
  const entry = pageSnapshots.get(slug);
  if (entry && Date.now() - entry.at < snapshotLifetime) return entry.value;
  const stored = readSession<StorePage>(`nix-page:${slug}`);
  if (stored) { pageSnapshots.set(slug, { value: stored, at: Date.now() }); return stored; }
  return undefined;
};

export const getCachedLandingDesign = (slug: string) => {
  const entry = landingDesignSnapshots.get(slug);
  if (entry && Date.now() - entry.at < snapshotLifetime) return entry.value;
  const stored = readSession<LandingDesign | null>(`nix-design:${slug}`);
  if (stored !== undefined) { landingDesignSnapshots.set(slug, { value: stored, at: Date.now() }); return stored; }
  return undefined;
};

export const getStorePage = async (slug: string) => {
  const result = await request<{ success: boolean; page: StorePage }>(`/api/storefront/pages/${encodeURIComponent(slug)}`);
  pageSnapshots.delete(slug);
  pageSnapshots.set(slug, { value: result.page, at: Date.now() });
  writeSession(`nix-page:${slug}`, result.page);
  if (pageSnapshots.size > 64) pageSnapshots.delete(pageSnapshots.keys().next().value!);
  return result;
};

export type LandingDesign = { html: string; css: string; footerHtml?: string; footerCss?: string; version: number };
export const getLandingDesign = async (slug: string): Promise<LandingDesign | null> => {
  try {
    const result = await request<LandingDesign>(`/api/builder/public-landings/${encodeURIComponent(slug)}`);
    landingDesignSnapshots.delete(slug);
    landingDesignSnapshots.set(slug, { value: result, at: Date.now() });
    writeSession(`nix-design:${slug}`, result);
    if (landingDesignSnapshots.size > 64) landingDesignSnapshots.delete(landingDesignSnapshots.keys().next().value!);
    return result;
  }
  catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 404) {
      landingDesignSnapshots.delete(slug);
      landingDesignSnapshots.set(slug, { value: null, at: Date.now() });
      writeSession(`nix-design:${slug}`, null);
      return null;
    }
    throw error;
  }
};
export const placeOrder = (payload: unknown, idempotencyKey?: string) =>
  request<{ success: boolean; order: OrderResult; paymentUrl?: string }>('/api/storefront/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  });
export const quoteLandingCoupon = (payload: unknown) =>
  request<{ code: string; discount: number; subtotal: number }>('/api/storefront/coupons/quote', { method: 'POST', body: JSON.stringify(payload) });
export const getPaymentResult = (attemptId: string, token: string) =>
  request<{ success: boolean; orderNumber: string; status: string; paymentStatus: string; total: number }>(`/api/storefront/payment/result/${encodeURIComponent(attemptId)}?token=${encodeURIComponent(token)}`);
export const trackOrder = (orderNumber: string, phone: string) =>
  request<{ success: boolean; order: { orderNumber: string; status: string; paymentStatus: string; grandTotal: number; createdAt: string; courierTrackingCode?: string | null; items?: Array<{ productId?: string | null; productName: string; quantity: number; unitPrice: number; image?: string | null }> } }>(`/api/storefront/orders/${encodeURIComponent(orderNumber)}?phone=${encodeURIComponent(phone)}`);

export const customerSignup = (payload: { name: string; email: string; phone: string; password: string }) => request<{ success: boolean; customer: CustomerAccount }>('/api/storefront/account/signup', { method: 'POST', body: JSON.stringify(payload) });
export const customerSignin = (payload: { identifier: string; password: string }) => request<{ success: boolean; customer: CustomerAccount }>('/api/storefront/account/signin', { method: 'POST', body: JSON.stringify(payload) });
export const customerSignout = () => request<{ success: boolean }>('/api/storefront/account/signout', { method: 'POST' });
export const getCustomerAccount = () => request<{ success: boolean; customer: CustomerAccount | null }>('/api/storefront/account/me');
export const updateCustomerAccount = (payload: Partial<CustomerAccount>) => request<{ success: boolean; customer: CustomerAccount; message: string }>('/api/storefront/account/profile', { method: 'PATCH', body: JSON.stringify(payload) });
export const changeCustomerPassword = (payload: { currentPassword: string; newPassword: string }) => request<{ success: boolean; message: string }>('/api/storefront/account/password', { method: 'POST', body: JSON.stringify(payload) });
export const listCustomerOrders = () => request<{ success: boolean; orders: CustomerOrder[] }>('/api/storefront/account/orders');
export const listCustomerWishlist = () => request<{ success: boolean; products: Product[] }>('/api/storefront/account/wishlist');
export const addCustomerWishlist = (productId: string) => request<{ success: boolean; message: string }>(`/api/storefront/account/wishlist/${productId}`, { method: 'POST' });
export const removeCustomerWishlist = (productId: string) => request<{ success: boolean; message: string }>(`/api/storefront/account/wishlist/${productId}`, { method: 'DELETE' });

export const getLandingThankYouDesign = (slug: string) => request<LandingDesign>(`/api/builder/public-landings/${encodeURIComponent(slug)}?view=thank-you`);
