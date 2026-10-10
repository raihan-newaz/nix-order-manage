import axios from 'axios';

export interface PathaoOrderPayload {
  store_id: number;
  merchant_order_id?: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_secondary_phone?: string;
  recipient_address: string;
  recipient_city?: number;
  recipient_zone?: number;
  recipient_area?: number;
  delivery_type: number; // 48 for normal, 12 for on demand
  item_type: number; // 1 for document, 2 for parcel
  special_instruction?: string;
  item_quantity: number;
  item_weight: number; // 0.5 to 10 kg
  amount_to_collect: number;
  item_description?: string;
}

export class PathaoAdapter {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;

  constructor(clientId: string, clientSecret: string, baseUrl?: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl || 'https://api-hermes.pathao.com';
  }

  async authenticate(username?: string, password?: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/aladdin/api/v1/issue-token`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          username,
          password,
          grant_type: 'password',
        },
        { timeout: 15000, maxRedirects: 0 }
      );
      if (response.data && response.data.access_token) {
        this.accessToken = response.data.access_token;
        return { success: true, token: this.accessToken, refreshToken: response.data.refresh_token as string, expiresIn: Number(response.data.expires_in) };
      }
      return { success: false, message: 'Failed to obtain Pathao token' };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  async refresh(refreshToken: string) {
    try {
      const response = await axios.post(`${this.baseUrl}/aladdin/api/v1/issue-token`, {
        client_id: this.clientId, client_secret: this.clientSecret,
        grant_type: 'refresh_token', refresh_token: refreshToken,
      }, { timeout: 15000, maxRedirects: 0 });
      if (!response.data?.access_token) return { success: false, message: 'Pathao did not return an access token' };
      return { success: true, token: response.data.access_token as string, refreshToken: response.data.refresh_token as string, expiresIn: Number(response.data.expires_in) };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Could not refresh Pathao token' };
    }
  }

  private getHeaders(token?: string) {
    return {
      Authorization: `Bearer ${token || this.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async getStores(token: string) {
    try {
      const stores: any[] = [];
      for (let page = 1; page <= 20; page++) {
        const response = await axios.get(`${this.baseUrl}/aladdin/api/v1/stores`, { params: { page }, headers: this.getHeaders(token), timeout: 15000, maxRedirects: 0 });
        const listing = response.data?.data;
        stores.push(...(Array.isArray(listing?.data) ? listing.data : []));
        if (page >= Number(listing?.last_page || 1)) break;
      }
      return { success: true, data: stores };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Could not load Pathao stores', status: error.response?.status };
    }
  }

  async createStore(payload: { name: string; contact_name: string; contact_number: string; address: string; city_id: number; zone_id: number; area_id: number; secondary_contact?: string; otp_number?: string }, token: string) {
    try {
      const response = await axios.post(`${this.baseUrl}/aladdin/api/v1/stores`, payload, { headers: this.getHeaders(token), timeout: 15000, maxRedirects: 0 });
      return { success: response.data?.type === 'success', data: response.data?.data, message: response.data?.message };
    } catch (error: any) { return { success: false, message: error.response?.data?.message || 'Could not create Pathao store', status: error.response?.status }; }
  }

  async calculatePrice(payload: { store_id: number; item_type: 1 | 2; delivery_type: number; item_weight: number; recipient_city: number; recipient_zone: number }, token: string) {
    try {
      const response = await axios.post(`${this.baseUrl}/aladdin/api/v1/merchant/price-plan`, payload, { headers: this.getHeaders(token), timeout: 15000, maxRedirects: 0 });
      return { success: response.data?.type === 'success', data: response.data?.data, message: response.data?.message };
    } catch (error: any) { return { success: false, message: error.response?.data?.message || 'Could not calculate Pathao delivery fee', status: error.response?.status }; }
  }

  async getCities(token?: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/aladdin/api/v1/city-list`,
        { headers: this.getHeaders(token), timeout: 15000, maxRedirects: 0 }
      );
      return { success: true, data: response.data?.data?.data || [] };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Could not load Pathao cities', status: error.response?.status };
    }
  }

  async getZones(cityId: number, token?: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/aladdin/api/v1/cities/${cityId}/zone-list`,
        { headers: this.getHeaders(token), timeout: 15000, maxRedirects: 0 }
      );
      return { success: true, data: response.data?.data?.data || [] };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Could not load Pathao zones', status: error.response?.status };
    }
  }

  async getAreas(zoneId: number, token?: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/aladdin/api/v1/zones/${zoneId}/area-list`,
        { headers: this.getHeaders(token), timeout: 15000, maxRedirects: 0 }
      );
      return { success: true, data: response.data?.data?.data || [] };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Could not load Pathao areas', status: error.response?.status };
    }
  }

  async createOrder(payload: PathaoOrderPayload, token?: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/aladdin/api/v1/orders`,
        payload,
        { headers: this.getHeaders(token), timeout: 15000, maxRedirects: 0 }
      );
      if (response.data && response.data.type === 'success') {
        return {
          success: true,
          consignmentId: response.data.data?.consignment_id,
          deliveryFee: response.data.data?.delivery_fee,
          raw: response.data,
        };
      }
      return {
        success: false,
        message: response.data?.message || 'Pathao order creation failed',
        raw: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Pathao order creation failed',
        status: error.response?.status,
      };
    }
  }

  async createBulkOrders(orders: PathaoOrderPayload[], token: string) {
    try {
      const response = await axios.post(`${this.baseUrl}/aladdin/api/v1/orders/bulk`, { orders }, {
        headers: this.getHeaders(token), timeout: 15000, maxRedirects: 0,
      });
      return {
        success: response.data?.type === 'success' && response.data?.code === 202 && response.data?.data === true,
        message: response.data?.message || 'Pathao bulk request was not accepted', status: response.status,
      };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Could not submit Pathao bulk order request', status: error.response?.status };
    }
  }

  async trackOrder(consignmentId: string, token?: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/aladdin/api/v1/orders/${consignmentId}/info`,
        { headers: this.getHeaders(token), timeout: 15000, maxRedirects: 0 }
      );
      return {
        success: true,
        data: response.data?.data,
      };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Could not track Pathao order', status: error.response?.status };
    }
  }
}
