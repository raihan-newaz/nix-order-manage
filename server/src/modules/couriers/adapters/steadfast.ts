import axios, { AxiosError, AxiosInstance } from 'axios';

export const STEADFAST_BASE_URL = 'https://portal.packzy.com/api/v1';

export interface SteadfastOrderPayload {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
  alternative_phone?: string;
  recipient_email?: string;
  item_description?: string;
  total_lot?: number;
  delivery_type?: 0 | 1;
}

export interface SteadfastPickupPayload {
  address_id: number;
  police_station_id: number;
  address: string;
  contact_number: string;
  note?: string;
  estim_qty?: number;
}

const failed = (error: unknown, fallback: string) => {
  const response = (error as AxiosError<any>)?.response;
  return {
    success: false as const,
    statusCode: response?.status,
    message: typeof response?.data?.message === 'string' ? response.data.message : fallback,
    errors: response?.data?.errors,
  };
};

export class SteadfastAdapter {
  private http: AxiosInstance;

  constructor(apiKey: string, secretKey: string) {
    this.http = axios.create({
      baseURL: STEADFAST_BASE_URL,
      timeout: 15000,
      maxRedirects: 0,
      headers: { 'Api-Key': apiKey, 'Secret-Key': secretKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    });
  }

  static async ping() {
    try {
      const response = await axios.get(`${STEADFAST_BASE_URL}/ping`, { timeout: 10000, maxRedirects: 0 });
      return { success: response.status === 200 && response.data?.message === 'pong', data: response.data };
    } catch (error) { return failed(error, 'Steadfast is not reachable'); }
  }

  async createOrder(payload: SteadfastOrderPayload) {
    try {
      const response = await this.http.post('/create_order', payload);
      const consignment = response.data?.consignment;
      if (response.data?.status !== 200 || !consignment?.consignment_id || !consignment?.tracking_code) {
        return { success: false as const, statusCode: response.status, message: response.data?.message || 'Steadfast did not return a consignment', errors: response.data?.errors };
      }
      return {
        success: true as const, statusCode: response.status,
        consignmentId: String(consignment.consignment_id), trackingCode: String(consignment.tracking_code),
        trackingLink: typeof consignment.tracking_link === 'string' ? consignment.tracking_link : null,
        status: String(consignment.status || 'in_review'),
      };
    } catch (error) { return failed(error, 'Steadfast order creation failed'); }
  }

  async createBulkOrders(orders: SteadfastOrderPayload[], extended = true) {
    try {
      const response = await this.http.post(extended ? '/create_order/bulk-order/extended' : '/create_order/bulk-order', { data: orders });
      if (response.data?.status !== 200 || !Array.isArray(response.data?.data)) {
        return { success: false as const, statusCode: response.status, message: response.data?.message || 'Steadfast bulk response is invalid' };
      }
      return { success: true as const, statusCode: response.status, data: response.data.data as Array<any> };
    } catch (error) { return failed(error, 'Steadfast bulk booking failed'); }
  }

  private async status(path: string) {
    try {
      const response = await this.http.get(path);
      return { success: response.data?.status === 200, deliveryStatus: response.data?.delivery_status as string | undefined, data: response.data, statusCode: response.status };
    } catch (error) { return failed(error, 'Could not load Steadfast parcel status'); }
  }

  statusByConsignment(consignmentId: string) { return this.status(`/status_by_cid/${encodeURIComponent(consignmentId)}`); }
  statusWithReturnByConsignment(consignmentId: string) { return this.status(`/status_with_return_status_by_cid/${encodeURIComponent(consignmentId)}`); }
  statusByInvoice(invoice: string) { return this.status(`/status_by_invoice/${encodeURIComponent(invoice)}`); }
  statusByTrackingCode(trackingCode: string) { return this.status(`/status_by_trackingcode/${encodeURIComponent(trackingCode)}`); }

  async trackingsByInvoice(invoice: string) {
    try {
      const response = await this.http.get(`/trackings_by_invoice/${encodeURIComponent(invoice)}`);
      return { success: response.data?.status === 200 && Array.isArray(response.data?.tracking), data: response.data?.tracking || [], statusCode: response.status };
    } catch (error) { return failed(error, 'Could not load Steadfast tracking history'); }
  }

  async createPickupRequest(payload: SteadfastPickupPayload) {
    try {
      const response = await this.http.post('/create_pickup_request', payload);
      return { success: response.status === 201 && Boolean(response.data?.data?.id), data: response.data?.data, message: response.data?.message, statusCode: response.status };
    } catch (error) { return failed(error, 'Could not request Steadfast pickup'); }
  }

  async createReturnRequest(payload: { consignment_id?: number; invoice?: string; tracking_code?: string; reason?: string }) {
    try {
      const response = await this.http.post('/create_return_request', payload);
      return { success: response.status === 201 && Boolean(response.data?.id), data: response.data, statusCode: response.status };
    } catch (error) { return failed(error, 'Could not request Steadfast return'); }
  }

  async getReturnRequests(page = 1) {
    try { const response = await this.http.get('/get_return_requests', { params: { page } }); return { success: true as const, data: response.data, statusCode: response.status }; }
    catch (error) { return failed(error, 'Could not load Steadfast return requests'); }
  }

  async getReturnRequest(id: number) {
    try { const response = await this.http.get(`/get_return_request/${id}`); return { success: true as const, data: response.data, statusCode: response.status }; }
    catch (error) { return failed(error, 'Could not load Steadfast return request'); }
  }

  async getCurrentBalance() {
    try {
      const response = await this.http.get('/get_balance');
      return { success: response.data?.status === 200, balance: response.data?.current_balance, data: response.data, statusCode: response.status };
    } catch (error) { return failed(error, 'Could not load Steadfast balance'); }
  }

  async getPayments(page = 1) {
    try { const response = await this.http.get('/payments', { params: { page } }); return { success: true as const, data: response.data, statusCode: response.status }; }
    catch (error) { return failed(error, 'Could not load Steadfast payments'); }
  }

  async getPayment(id: number) {
    try { const response = await this.http.get(`/payments/${id}`); return { success: true as const, data: response.data, statusCode: response.status }; }
    catch (error) { return failed(error, 'Could not load Steadfast payment details'); }
  }

  async getPoliceStations() {
    try { const response = await this.http.get('/police_stations'); return { success: true as const, data: response.data, statusCode: response.status }; }
    catch (error) { return failed(error, 'Could not load Steadfast police stations'); }
  }

  async fraudScore(phone: string) {
    try { const response = await this.http.get(`/fraud_check/score/${encodeURIComponent(phone)}`); return { success: response.data?.status === 200, data: response.data, statusCode: response.status }; }
    catch (error) { return failed(error, 'Could not load Steadfast fraud score'); }
  }
}
