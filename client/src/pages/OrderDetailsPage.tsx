import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Box, CalendarClock, CheckCircle2, Copy, MapPin, MessageCircle, Phone, Printer, Truck, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import type { Order } from '../types';
import { InvoiceModal } from '../components/orders/InvoiceModal';
import { OrderEditModal } from '../components/orders/OrderEditModal';
import { CustomerHistoryCard, type CustomerHistory } from '../components/orders/CustomerHistoryCard';
import { CourierDispatchModal } from '../components/orders/CourierDispatchModal';

const statuses = ['PENDING', 'CONFIRMED', 'PACKAGING', 'HANDED_OVER', 'IN_TRANSIT', 'DELIVERED', 'PARTIAL_DELIVERED', 'HOLD', 'CANCELLED', 'RETURNED', 'FAKE_TRASH'];
const money = (value: number) => `৳${Number(value || 0).toLocaleString()}`;
const pretty = (value?: string) => (value || '—').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());

export const OrderDetailsPage: React.FC = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistory | null>(null);
  const [trackingRefreshing, setTrackingRefreshing] = useState(false);
  const [pathaoEvents, setPathaoEvents] = useState<Array<{ id: string; event: string; occurredAt: string; applied: boolean; reason?: string; returnConsignmentId?: string; collectedAmount?: number; deliveryFee?: number; invoiceId?: string }>>([]);
  const [pathaoRecoveryCode, setPathaoRecoveryCode] = useState('');
  const [pathaoRecoveryBusy, setPathaoRecoveryBusy] = useState(false);
  const [steadfastEvents, setSteadfastEvents] = useState<Array<{ id: string; event: string; trackingMessage?: string; occurredAt: string; applied: boolean }>>([]);
  const [steadfastTrackings, setSteadfastTrackings] = useState<any[]>([]);
  const [steadfastRecoveryId, setSteadfastRecoveryId] = useState('');
  const [steadfastRecoveryBusy, setSteadfastRecoveryBusy] = useState(false);
  const [redxEvents, setRedxEvents] = useState<Array<{ id: string; event: string; trackingMessage?: string; occurredAt: string; applied: boolean }>>([]);
  const [redxTracking, setRedxTracking] = useState<Array<{ message_en?: string; message_bn?: string; time?: string }>>([]);
  const [redxRecoveryId, setRedxRecoveryId] = useState('');
  const [redxBusy, setRedxBusy] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const load = async () => { try { const { data } = await api.get(`/orders/${id}`); setOrder(data.order); setCustomerHistory(data.customerHistory || null); } catch (error: any) { toast.error(error.response?.data?.message || 'Order not found'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    api.get('/users').then(({ data }) => {
      if (data?.users) setStaffList(data.users.filter((u: any) => u.status === 'ACTIVE'));
    }).catch(() => undefined);
  }, []);
  const updateAssignment = async (assignedToId: string | null) => {
    if (!order) return;
    try {
      const res = await api.patch(`/orders/${order.id}/assignment`, { assignedToId });
      if (res.data?.success) {
        toast.success(assignedToId ? 'Assigned team member' : 'Order unassigned');
        load();
      }
    } catch (e: any) { toast.error(e.response?.data?.message || 'Could not update assignment'); }
  };
  const updatePriority = async (priority: 'NORMAL' | 'URGENT') => {
    if (!order || order.priority === priority) return;
    try {
      const res = await api.patch(`/orders/${order.id}/priority`, { priority });
      if (res.data?.success) {
        toast.success(`Priority set to ${priority}`);
        load();
      }
    } catch (e: any) { toast.error(e.response?.data?.message || 'Could not update priority'); }
  };
  useEffect(() => {
    if (order?.courierName !== 'PATHAO' || !id) return;
    api.get(`/couriers/pathao/events?orderId=${encodeURIComponent(id)}&limit=100`)
      .then(({ data }) => setPathaoEvents(data.events || []))
      .catch(() => setPathaoEvents([]));
  }, [id, order?.courierName]);
  useEffect(() => {
    if (order?.courierName !== 'STEADFAST' || !id) return;
    api.get(`/couriers/steadfast/events?orderId=${encodeURIComponent(id)}`).then(({ data }) => setSteadfastEvents(data.events || [])).catch(() => setSteadfastEvents([]));
    if (order.courierConsignmentId) api.get(`/couriers/steadfast/orders/${id}/trackings`).then(({ data }) => setSteadfastTrackings(data.data || [])).catch(() => setSteadfastTrackings([]));
  }, [id, order?.courierName, order?.courierConsignmentId]);
  useEffect(() => {
    if (order?.courierName !== 'REDX' || !id) return;
    api.get(`/couriers/redx/events?orderId=${encodeURIComponent(id)}`).then(({ data }) => setRedxEvents(data.events || [])).catch(() => setRedxEvents([]));
    if (order.courierConsignmentId) api.get(`/couriers/redx/orders/${id}`).then(({ data }) => setRedxTracking(data.tracking || [])).catch(() => setRedxTracking([]));
  }, [id, order?.courierName, order?.courierConsignmentId]);
  const updateStatus = async (status: string) => { if (!order || status === order.status) return; setUpdating(true); try { await api.patch(`/orders/${order.id}/status`, { status }); toast.success(`Order moved to ${pretty(status)}`); load(); } catch (error: any) { toast.error(error.response?.data?.message || 'Could not update status'); } finally { setUpdating(false); } };
  const copy = (value: string) => navigator.clipboard.writeText(value).then(() => toast.success('Copied'));
  const refreshPathao = async () => {
    if (!order) return;
    setTrackingRefreshing(true);
    try { const { data } = await api.post(`/couriers/pathao/orders/${order.id}/refresh`); setOrder(data.order); toast.success(`Pathao status: ${data.courierStatus}`); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not refresh Pathao tracking'); }
    finally { setTrackingRefreshing(false); }
  };
  const resolvePathao = async (action: 'ATTACH' | 'CLEAR') => {
    if (!order) return;
    if (action === 'CLEAR' && !window.confirm('Only continue after checking Pathao and confirming no booking exists. A late booking could otherwise cause a duplicate shipment.')) return;
    setPathaoRecoveryBusy(true);
    try {
      const payload = action === 'ATTACH' ? { action, consignmentId: pathaoRecoveryCode.trim() } : { action, confirmation: 'NO_PATHAO_BOOKING_CONFIRMED' };
      const { data } = await api.post(`/couriers/pathao/orders/${order.id}/resolve`, payload);
      setOrder(data.order);
      toast.success(action === 'ATTACH' ? 'Verified Pathao consignment attached' : 'Uncertain booking cleared');
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not resolve Pathao booking'); }
    finally { setPathaoRecoveryBusy(false); }
  };
  const refreshSteadfast = async () => {
    if (!order) return;
    setTrackingRefreshing(true);
    try { const { data } = await api.post(`/couriers/steadfast/orders/${order.id}/refresh`); setOrder(data.order); toast.success(`Steadfast status: ${data.deliveryStatus}`); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not refresh Steadfast tracking'); }
    finally { setTrackingRefreshing(false); }
  };
  const refreshRedx = async () => {
    if (!order) return;
    setTrackingRefreshing(true);
    try { const { data } = await api.post(`/couriers/redx/orders/${order.id}/refresh`); setOrder(data.order); toast.success(`RedX status: ${data.parcel?.status || 'updated'}`); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not refresh RedX parcel'); }
    finally { setTrackingRefreshing(false); }
  };
  const cancelRedx = async () => {
    if (!order) return;
    const reason = window.prompt('Why should RedX cancel this parcel?');
    if (!reason) return;
    setRedxBusy(true);
    try { await api.patch(`/couriers/redx/orders/${order.id}`, { propertyName: 'status', value: 'cancelled', reason }); toast.success('RedX accepted the cancellation request. Refresh tracking to confirm.'); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not request cancellation'); }
    finally { setRedxBusy(false); }
  };
  const changeRedxAddress = async () => {
    if (!order) return;
    const value = window.prompt('New delivery address for RedX', order.customerAddress);
    if (!value || value.trim().length < 8) return;
    const reason = window.prompt('Reason for this RedX address change');
    if (!reason) return;
    setRedxBusy(true);
    try { await api.patch(`/couriers/redx/orders/${order.id}`, { propertyName: 'delivery_address', value: value.trim(), reason }); toast.success('RedX accepted the address change request. Confirm it in the RedX portal.'); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not request address change'); }
    finally { setRedxBusy(false); }
  };
  const resolveRedx = async (action: 'ATTACH' | 'CLEAR') => {
    if (!order) return;
    if (action === 'CLEAR' && !window.confirm(`Check invoice ${order.orderNumber} in the RedX merchant portal first. Clear only if no parcel was created.`)) return;
    setRedxBusy(true);
    try { const { data } = await api.post(`/couriers/redx/orders/${order.id}/resolve`, action === 'ATTACH' ? { action, trackingId: redxRecoveryId.trim() } : { action, confirmation: 'NO_REDX_BOOKING_CONFIRMED' }); setOrder(data.order); toast.success(action === 'ATTACH' ? 'Verified RedX tracking attached' : 'Booking cleared for retry'); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not resolve RedX booking'); }
    finally { setRedxBusy(false); }
  };
  const requestSteadfastReturn = async () => {
    if (!order) return;
    const reason = window.prompt('Why should Steadfast return this parcel?');
    if (reason === null) return;
    if (!window.confirm('Submit this return request to Steadfast?')) return;
    try { await api.post(`/couriers/steadfast/orders/${order.id}/returns`, { reason }); toast.success('Steadfast return request submitted'); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not request return'); }
  };
  const resolveSteadfast = async (action: 'ATTACH' | 'CLEAR') => {
    if (!order) return;
    if (action === 'CLEAR' && !window.confirm(`Check invoice ${order.orderNumber} in the Steadfast merchant panel first. Only unlock retry if NO booking exists. Continue?`)) return;
    setSteadfastRecoveryBusy(true);
    try {
      const payload = action === 'ATTACH' ? { action, consignmentId: steadfastRecoveryId.trim() } : { action, confirmation: 'NO_STEADFAST_BOOKING_CONFIRMED' };
      const { data } = await api.post(`/couriers/steadfast/orders/${order.id}/resolve`, payload);
      setOrder(data.order);
      toast.success(action === 'ATTACH' ? 'Steadfast consignment verified and attached' : 'Booking cleared for retry');
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not resolve booking'); }
    finally { setSteadfastRecoveryBusy(false); }
  };

  if (loading) return <div className="py-24 text-center text-sm text-slate-500">Loading order…</div>;
  if (!order) return <div className="py-24 text-center"><p className="font-bold">Order not found</p><Link className="mt-3 inline-block text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline" to="/orders">Back to orders</Link></div>;
  let checkoutDetails: Record<string, string> = {};
  try { checkoutDetails = JSON.parse(order.checkoutDetails || '{}'); } catch { checkoutDetails = {}; }
  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div className="flex items-center gap-3"><Link to="/orders" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><ArrowLeft className="h-4 w-4"/></Link><div><div className="flex items-center gap-2"><h2 className="text-2xl font-semibold">Order {order.orderNumber}</h2>{order.isFraudSuspect && <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-medium text-rose-700">RISK</span>}{order.isDuplicate && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-700">DUPLICATE</span>}</div><p className="mt-1 text-xs text-slate-500">Placed {new Date(order.createdAt).toLocaleString()} · Last updated {new Date(order.updatedAt).toLocaleString()}</p></div></div><div className="flex flex-wrap gap-2">{!order.courierName && ['PENDING', 'CONFIRMED', 'PACKAGING', 'HOLD'].includes(order.status) && <button onClick={() => setEditOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium dark:border-slate-700 dark:bg-slate-900">Edit order</button>}<button onClick={() => setInvoiceOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium dark:border-slate-700 dark:bg-slate-900"><Printer className="h-4 w-4"/>Invoice</button><select disabled={updating} value={order.status} onChange={(e) => updateStatus(e.target.value)} className="h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-4 text-sm font-medium shadow transition outline-none">{statuses.map(status => <option key={status} value={status}>{pretty(status)}</option>)}</select></div></div>
    {(order.isFraudSuspect || order.isDuplicate) && <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/><div><b>Review before fulfilment</b><p className="text-sm opacity-80">{order.isFraudSuspect ? 'Customer history triggered a risk flag. ' : ''}{order.isDuplicate ? 'A recent order has the same customer phone number.' : ''}</p></div></div>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-100/90 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800"><Box className="h-5 w-5 text-emerald-600 dark:text-emerald-400"/><h3 className="font-black">Order items</h3></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{order.items.map(item => <div key={item.id} className="flex items-center gap-4 p-5">{(item.variant?.image || item.product?.image) ? <img src={item.variant?.image || item.product?.image} alt="" className="h-16 w-16 rounded-xl object-cover"/> : <span className="grid h-16 w-16 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800"><Box className="h-5 w-5 text-slate-400"/></span>}<div className="min-w-0 flex-1"><b className="block truncate">{item.productName}</b><p className="mt-1 text-xs text-slate-500">{item.variantName || [item.color, item.size].filter(Boolean).join(' / ') || 'Standard'} · SKU {item.productSku || '—'}</p><p className="mt-2 text-xs font-bold text-slate-900 dark:text-slate-100">{money(item.unitPrice)} × {item.quantity}</p></div><b>{money(item.totalPrice)}</b></div>)}</div><div className="ml-auto max-w-sm space-y-2 border-t border-slate-200/80 p-5 text-sm dark:border-slate-800"><div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(order.subtotal)}</span></div><div className="flex justify-between text-slate-500"><span>Delivery</span><span>{money(order.deliveryCharge)}</span></div>{order.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{money(order.discount)}</span></div>}<div className="flex justify-between border-t border-slate-200/80 pt-3 text-lg font-black dark:border-slate-700"><span>Grand total</span><span>{money(order.grandTotal)}</span></div><div className="flex justify-between text-xs text-slate-500"><span>Advance paid</span><span>{money(order.advancePaid)}</span></div><div className="flex justify-between rounded-xl bg-emerald-50 p-3 font-black text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"><span>COD to collect</span><span>{money(order.codAmount)}</span></div></div></section>
      <section className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold">Payment</h3><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-slate-500">Method</dt><dd>{pretty(order.paymentMethod)}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd>{pretty(order.paymentStatus)}</dd></div></dl></div><div className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold">Courier information</h3><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-2"><dt className="text-slate-500">Provider</dt><dd>{pretty(order.courierName)}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Tracking</dt><dd className="break-all font-mono text-xs">{order.courierTrackingCode || 'Not dispatched'}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Consignment</dt><dd className="break-all font-mono text-xs">{order.courierConsignmentId || '—'}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Courier status</dt><dd>{pretty(order.courierStatus)}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Courier charge</dt><dd>{money(order.courierCharge)}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">COD received</dt><dd>{money(order.courierCodReceived)}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Settlement</dt><dd>{pretty(order.courierSettlementStatus)}</dd></div>{order.courierStoreId && <div className="flex justify-between gap-2"><dt className="text-slate-500">Pickup store</dt><dd>#{order.courierStoreId}</dd></div>}</dl></div></section>
      {(order.internalNote || order.customerNote || Object.keys(checkoutDetails).length > 0) && <section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><h3 className="font-black">Notes & checkout details</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{order.customerNote && <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950"><b className="text-xs uppercase text-slate-400">Customer note</b><p className="mt-2 text-sm">{order.customerNote}</p></div>}{order.internalNote && <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-500/10"><b className="text-xs uppercase text-amber-600">Internal note</b><p className="mt-2 text-sm">{order.internalNote}</p></div>}{Object.entries(checkoutDetails).map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950"><b className="text-xs uppercase text-slate-400">{label}</b><p className="mt-2 text-sm">{String(value)}</p></div>)}</div></section>}
    </div><aside className="space-y-5"><section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400"/><h3 className="font-black">Customer</h3></div><p className="mt-4 font-bold">{order.customerName}</p><button onClick={() => copy(order.customerPhone)} className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-600">{order.customerPhone}<Copy className="h-3 w-3"/></button><div className="mt-4 grid grid-cols-2 gap-2"><a href={`tel:${order.customerPhone}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white dark:bg-white dark:text-slate-950"><Phone className="h-4 w-4"/>Call</a><a target="_blank" rel="noreferrer" href={`https://wa.me/88${order.customerPhone.replace(/\D/g, '')}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white"><MessageCircle className="h-4 w-4"/>WhatsApp</a></div></section><section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400"/><h3 className="font-black">Delivery address</h3></div><p className="mt-4 text-sm leading-6">{order.customerAddress}</p><p className="mt-2 text-xs text-slate-500">{[order.area, order.zone, order.city, order.district].filter(Boolean).join(', ')}</p></section>      <section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-emerald-600 dark:text-emerald-400"/>
            <h3 className="font-black">Fulfilment</h3>
          </div>
          <button
            onClick={() => updatePriority(order.priority === 'URGENT' ? 'NORMAL' : 'URGENT')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
              order.priority === 'URGENT'
                ? 'bg-amber-500 text-white shadow hover:bg-amber-600'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {order.priority === 'URGENT' ? '⚡ URGENT PRIORITY' : 'Normal Priority'}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500"/>
            <div>
              <b className="text-sm">Order received</b>
              <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Truck className="h-5 w-5 text-emerald-600 dark:text-emerald-400"/>
            <div className="flex-1">
              <b className="text-sm">Current stage: {pretty(order.status)}</b>
              <div className="mt-2 flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500">Assigned Team Member:</label>
                <select
                  value={order.assignedTo?.id || ''}
                  onChange={(e) => updateAssignment(e.target.value ? e.target.value : null)}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>
    </aside></div>
    {order.courierName === 'PATHAO' && <section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><h3 className="font-black">Pathao delivery timeline</h3><p className="mt-1 text-xs text-slate-500">Signed courier updates are saved here, including return and payment events.</p>{pathaoEvents.length ? <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{pathaoEvents.map((event) => <div key={event.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:justify-between"><div><b>{pretty(event.event.replace(/^order\./, ''))}</b><p className="text-xs text-slate-500">{[event.reason, event.returnConsignmentId && `Return #${event.returnConsignmentId}`, event.invoiceId && `Invoice #${event.invoiceId}`, event.collectedAmount !== undefined && `Collected ${money(event.collectedAmount)}`, event.deliveryFee !== undefined && `Fee ${money(event.deliveryFee)}`].filter(Boolean).join(' · ') || (event.applied ? 'Order synchronized' : 'Recorded')}</p></div><span className="shrink-0 text-xs text-slate-500">{new Date(event.occurredAt).toLocaleString()}</span></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No Pathao webhook events received yet.</p>}</section>}
    {order.courierName === 'STEADFAST' && <section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black">Steadfast tracking</h3><p className="text-xs text-slate-500">Consignment #{order.courierConsignmentId || 'Awaiting confirmation'} · {order.courierTrackingCode || 'No tracking code yet'}</p></div><div className="flex gap-2">{order.courierConsignmentId && <button disabled={trackingRefreshing} onClick={refreshSteadfast} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700">{trackingRefreshing ? 'Checking…' : 'Refresh status'}</button>}{order.courierConsignmentId && !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(order.status) && <button onClick={requestSteadfastReturn} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Request return</button>}</div></div>{order.courierTrackingLink?.startsWith('https://') && <a href={order.courierTrackingLink} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">Open Steadfast tracking ↗</a>}{!order.courierConsignmentId && ['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'].includes(order.courierStatus || '') && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Booking outcome is uncertain. Check invoice {order.orderNumber} in the Steadfast portal before attempting another dispatch.</p>}{steadfastTrackings.map((item: any, index) => <p key={index} className="mt-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">{item.text || item.message || item.tracking_message || item.status || JSON.stringify(item)} <span className="text-xs text-slate-500">{item.created_at || item.date || ''}</span></p>)}{steadfastEvents.map(event => <p key={event.id} className="mt-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800"><b>{pretty(event.event)}</b> · {event.trackingMessage || (event.applied ? 'Order synchronized' : 'Recorded')} <span className="text-xs text-slate-500">{new Date(event.occurredAt).toLocaleString()}</span></p>)}</section>}
    {order.courierName === 'STEADFAST' && !order.courierConsignmentId && ['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'].includes(order.courierStatus || '') && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-700/50 dark:bg-amber-500/10"><h3 className="font-black">Resolve Steadfast booking</h3><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Find invoice {order.orderNumber} in Steadfast first. A consignment ID can be attached only if it appears in that invoice’s tracking history. Unlock retry only after confirming no booking exists.</p><div className="mt-3 flex flex-wrap gap-2"><input value={steadfastRecoveryId} onChange={event => setSteadfastRecoveryId(event.target.value)} placeholder="Verified consignment ID" className="min-w-[190px] flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-700 dark:bg-slate-900"/><button disabled={steadfastRecoveryBusy || !/^\d+$/.test(steadfastRecoveryId.trim())} onClick={() => resolveSteadfast('ATTACH')} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Verify & attach</button><button disabled={steadfastRecoveryBusy} onClick={() => resolveSteadfast('CLEAR')} className="rounded-lg border border-amber-400 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-50">No booking exists — unlock retry</button></div></section>}
    {order.courierName === 'PATHAO' && !order.courierConsignmentId && ['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'].includes(order.courierStatus || '') && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-700/50 dark:bg-amber-500/10"><h3 className="font-black">Pathao booking awaiting confirmation</h3><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Do not send this order again until Pathao confirms whether a consignment was created. Check the Pathao merchant panel using order #{order.orderNumber}.</p><div className="mt-3 flex flex-wrap gap-2"><input value={pathaoRecoveryCode} onChange={(event) => setPathaoRecoveryCode(event.target.value)} placeholder="Verified consignment ID" className="min-w-[190px] flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-700 dark:bg-slate-900"/><button disabled={pathaoRecoveryBusy || !pathaoRecoveryCode.trim()} onClick={() => resolvePathao('ATTACH')} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Verify & attach</button>{order.courierStatus === 'BOOKING_UNCERTAIN' && <button disabled={pathaoRecoveryBusy} onClick={() => resolvePathao('CLEAR')} className="rounded-lg border border-amber-400 px-3 py-2 text-xs font-bold text-amber-900 dark:text-amber-200 disabled:opacity-50">No booking exists — unlock retry</button>}</div></section>}
    {order.courierName === 'PATHAO' && order.courierConsignmentId && <button disabled={trackingRefreshing} onClick={refreshPathao} className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-900 disabled:opacity-50">{trackingRefreshing ? 'Checking Pathao…' : 'Refresh Pathao tracking'}</button>}
    {order.courierName === 'REDX' && order.courierConsignmentId && <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">RedX parcel</h3><p className="text-xs text-slate-500">Tracking #{order.courierConsignmentId} · {pretty(order.courierStatus || '')}</p></div><div className="flex flex-wrap gap-2"><button disabled={trackingRefreshing} onClick={refreshRedx} className="rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:opacity-50 dark:border-slate-700">Refresh status</button>{!['DELIVERED', 'CANCELLED', 'RETURNED'].includes(order.status) && <><button disabled={redxBusy} onClick={changeRedxAddress} className="rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:opacity-50 dark:border-slate-700">Request address change</button><button disabled={redxBusy} onClick={cancelRedx} className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700 disabled:opacity-50">Request cancellation</button></>}</div></div>
      {redxTracking.map((item, index) => <p key={index} className="mt-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">{item.message_en || item.message_bn} <span className="text-slate-500">{item.time ? new Date(item.time).toLocaleString() : ''}</span></p>)}
      {redxEvents.map(event => <p key={event.id} className="mt-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">{pretty(event.event)} · {event.trackingMessage || (event.applied ? 'Order synchronized' : 'Recorded')} <span className="text-slate-500">{new Date(event.occurredAt).toLocaleString()}</span></p>)}
    </section>}
    {order.courierName === 'REDX' && !order.courierConsignmentId && ['BOOKING_REQUESTED', 'BOOKING_UNCERTAIN'].includes(order.courierStatus || '') && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-700/50 dark:bg-amber-500/10"><h3 className="font-semibold">Resolve RedX booking</h3><p className="mt-1 text-xs">Check invoice {order.orderNumber} in RedX before attempting another dispatch.</p><div className="mt-3 flex flex-wrap gap-2"><input value={redxRecoveryId} onChange={e => setRedxRecoveryId(e.target.value)} placeholder="Verified tracking ID" className="min-w-[190px] flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"/><button disabled={redxBusy || !redxRecoveryId.trim()} onClick={() => resolveRedx('ATTACH')} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50">Verify & attach</button>{order.courierStatus === 'BOOKING_UNCERTAIN' && <button disabled={redxBusy} onClick={() => resolveRedx('CLEAR')} className="rounded-lg border border-amber-400 px-3 py-2 text-xs text-amber-900 disabled:opacity-50">No booking exists — unlock retry</button>}</div></section>}
    <CustomerHistoryCard history={customerHistory}/>
    {!order.courierName && !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(order.status) && <button onClick={() => setDispatchOpen(true)} className="w-fit rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-4 py-2 text-sm font-medium shadow transition">Select courier & dispatch</button>}
    {editOpen && <OrderEditModal order={order} onClose={() => setEditOpen(false)} onSuccess={load}/>}
    {dispatchOpen && <CourierDispatchModal order={order} onClose={() => setDispatchOpen(false)} onSuccess={(updated) => { setOrder({ ...order, ...updated }); load(); }}/>} 
    {invoiceOpen && <InvoiceModal order={order} onClose={() => setInvoiceOpen(false)}/>} 
  </div>;
};
