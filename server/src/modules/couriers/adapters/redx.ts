import axios, { AxiosError, AxiosInstance } from 'axios';

export const REDX_PRODUCTION_URL = 'https://openapi.redx.com.bd/v1.0.0-beta';
export const REDX_SANDBOX_URL = 'https://sandbox.redx.com.bd/v1.0.0-beta';

export const redxBaseUrl = (value?: string | null) => {
  const url = (value || REDX_SANDBOX_URL).replace(/\/+$/, '');
  if (url !== REDX_PRODUCTION_URL && url !== REDX_SANDBOX_URL) throw new Error('Select the official RedX sandbox or production API URL');
  return url;
};

export interface RedXArea { id: number; name: string; post_code?: number; division_name?: string; zone_id?: number }
export interface RedXPickupStore { id: number; name: string; address: string; area_name: string; area_id: number; phone: string; created_at?: string }
export interface RedXParcelPayload {
  customer_name: string;
  customer_phone: string;
  delivery_area: string;
  delivery_area_id: number;
  customer_address: string;
  cash_collection_amount: string;
  parcel_weight: string;
  value: string;
  merchant_invoice_id?: string;
  instruction?: string;
  pickup_store_id?: number;
  parcel_details_json?: Array<{ name: string; category: string; value: number }>;
  is_closed_box?: boolean;
}

const failure = (error: unknown, fallback: string) => {
  const response = (error as AxiosError<{ message?: string; error?: string }>).response;
  const detail = String(response?.data?.message || response?.data?.error || fallback);
  return { success: false as const, status: response?.status,
    message: response?.status && response.status >= 500 ? `RedX returned HTTP ${response.status}; outcome unconfirmed. Check the merchant portal before retrying. ${detail}` : detail };
};

export class RedXAdapter {
  private http: AxiosInstance;

  constructor(token: string, baseUrl?: string | null) {
    this.http = axios.create({
      baseURL: redxBaseUrl(baseUrl), timeout: 15000, maxRedirects: 0,
      headers: { 'API-ACCESS-TOKEN': `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    });
  }

  async getAreas(filters: { postCode?: number; districtName?: string } = {}) {
    try {
      const { data } = await this.http.get('/areas', { params: filters.postCode ? { post_code: filters.postCode } : filters.districtName ? { district_name: filters.districtName } : undefined });
      if (!Array.isArray(data?.areas)) throw new Error('Invalid RedX areas response');
      return { success: true as const, data: data.areas as RedXArea[] };
    } catch (error) { return failure(error, 'Could not load RedX areas'); }
  }

  async getPickupStores() {
    try {
      const { data } = await this.http.get('/pickup/stores');
      if (!Array.isArray(data?.pickup_stores)) throw new Error('Invalid RedX pickup stores response');
      return { success: true as const, data: data.pickup_stores as RedXPickupStore[] };
    } catch (error) { return failure(error, 'Could not load RedX pickup stores'); }
  }

  async getPickupStore(id: number) {
    try { const { data } = await this.http.get(`/pickup/store/info/${id}`); return { success: Boolean(data?.pickup_store), data: data?.pickup_store as RedXPickupStore }; }
    catch (error) { return failure(error, 'Could not load RedX pickup store'); }
  }

  async createPickupStore(payload: { name: string; phone: string; address: string; area_id: number }) {
    try { const { data } = await this.http.post('/pickup/store', payload); return { success: Boolean(data?.id), data: data as RedXPickupStore, message: data?.message as string | undefined }; }
    catch (error) { return failure(error, 'Could not create RedX pickup store'); }
  }

  async calculateCharge(params: { deliveryAreaId: number; pickupAreaId: number; cashCollectionAmount: number; weightGrams: number }) {
    try {
      const { data } = await this.http.get('/charge/charge_calculator', { params: { delivery_area_id: params.deliveryAreaId, pickup_area_id: params.pickupAreaId, cash_collection_amount: params.cashCollectionAmount, weight: params.weightGrams } });
      return { success: Number.isFinite(Number(data?.deliveryCharge)), data: { deliveryCharge: Number(data?.deliveryCharge), codCharge: Number(data?.codCharge || 0) } };
    } catch (error) { return failure(error, 'Could not calculate RedX charge'); }
  }

  async createParcel(payload: RedXParcelPayload) {
    try {
      const { data } = await this.http.post('/parcel', payload);
      return data?.tracking_id ? { success: true as const, trackingId: String(data.tracking_id) } : { success: false as const, message: data?.message || 'RedX did not return a tracking ID' };
    } catch (error) { return failure(error, 'RedX parcel creation failed'); }
  }

  async getParcelInfo(trackingId: string) {
    try { const { data } = await this.http.get(`/parcel/info/${encodeURIComponent(trackingId)}`); return { success: Boolean(data?.parcel), data: data?.parcel, message: data?.parcel ? undefined : 'Parcel not found' }; }
    catch (error) { return failure(error, 'Could not load RedX parcel'); }
  }

  async trackParcel(trackingId: string) {
    try { const { data } = await this.http.get(`/parcel/track/${encodeURIComponent(trackingId)}`); return { success: Array.isArray(data?.tracking), data: data?.tracking, message: Array.isArray(data?.tracking) ? undefined : 'RedX did not return tracking updates' }; }
    catch (error) { return failure(error, 'Could not track RedX parcel'); }
  }

  async updateParcel(trackingId: string, propertyName: string, value: string, reason?: string) {
    try {
      const { data } = await this.http.patch('/parcels', { entity_type: 'parcel-tracking-id', entity_id: trackingId, update_details: { property_name: propertyName, new_value: value, ...(reason ? { reason } : {}) } });
      return { success: data?.success === true, message: data?.message || 'RedX did not accept the update' };
    } catch (error) { return failure(error, 'Could not update RedX parcel'); }
  }
}
