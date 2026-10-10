import { useState } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950';
const buttonClass = 'rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700 disabled:opacity-50';

export function SteadfastPanel() {
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [score, setScore] = useState<any>(null);
  const [paymentId, setPaymentId] = useState('');
  const [paymentDetail, setPaymentDetail] = useState<any>(null);
  const [returnId, setReturnId] = useState('');
  const [returnDetail, setReturnDetail] = useState<any>(null);
  const [pickup, setPickup] = useState({ address_id: '', police_station_id: '', address: '', contact_number: '', estim_qty: '1', note: '' });

  const read = async (path: string, onData: (value: any) => void) => {
    setBusy(true);
    try { const { data } = await api.get(path); onData(data.data ?? data); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Steadfast request failed'); }
    finally { setBusy(false); }
  };
  const refresh = async () => {
    setBusy(true);
    try {
      const [balanceRes, paymentRes, returnRes, requestRes] = await Promise.all([
        api.get('/couriers/steadfast/balance'), api.get('/couriers/steadfast/payments'),
        api.get('/couriers/steadfast/returns'), api.get('/couriers/steadfast/requests'),
      ]);
      setBalance(Number(balanceRes.data.data?.current_balance ?? 0));
      setPayments(paymentRes.data.data?.payments || []);
      setReturns(returnRes.data.data?.data || returnRes.data.data?.return_requests || []);
      setRequests(requestRes.data.requests || []);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not load Steadfast account'); }
    finally { setBusy(false); }
  };
  const createPickup = async () => {
    if (!window.confirm('Send this pickup request to Steadfast now?')) return;
    setBusy(true);
    try {
      await api.post('/couriers/steadfast/pickups', {
        address_id: Number(pickup.address_id), police_station_id: Number(pickup.police_station_id),
        address: pickup.address, contact_number: pickup.contact_number, estim_qty: Number(pickup.estim_qty), note: pickup.note || undefined,
      });
      toast.success('Pickup request submitted');
      const { data } = await api.get('/couriers/steadfast/requests'); setRequests(data.requests || []);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Pickup request failed'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">Steadfast operations</h2><p className="text-xs text-slate-500">Live balance, payouts, returns, pickup and customer risk</p></div><button disabled={busy} onClick={refresh} className={buttonClass}>Refresh account data</button></div>
    {balance !== null && <div className="rounded-xl bg-emerald-50 p-4 text-sm dark:bg-emerald-500/10">Current payable balance <b className="ml-2 text-lg">৳{balance.toLocaleString()}</b></div>}
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><h3 className="text-sm font-bold">Payouts</h3><div className="flex gap-2"><input className={inputClass} placeholder="Payment ID, e.g. SFC-88213" value={paymentId} onChange={e => setPaymentId(e.target.value)}/><button disabled={busy || !paymentId.trim()} className={buttonClass} onClick={() => read(`/couriers/steadfast/payments/${encodeURIComponent(paymentId.trim())}`, setPaymentDetail)}>Details</button></div>{paymentDetail && <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-950">{JSON.stringify(paymentDetail, null, 2)}</pre>}{payments.slice(0, 10).map((item: any) => <div key={item.payment_id} className="flex justify-between border-t border-slate-100 pt-2 text-xs dark:border-slate-800"><span>{item.payment_id} · {item.method} · {item.status_label}</span><b>৳{Number(item.amount || 0).toLocaleString()}</b></div>)}</div>
      <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><h3 className="text-sm font-bold">Return requests</h3><div className="flex gap-2"><input className={inputClass} placeholder="Return request ID" value={returnId} onChange={e => setReturnId(e.target.value)}/><button disabled={busy || !returnId.trim()} className={buttonClass} onClick={() => read(`/couriers/steadfast/returns/${encodeURIComponent(returnId.trim())}`, setReturnDetail)}>Details</button></div>{returnDetail && <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-950">{JSON.stringify(returnDetail, null, 2)}</pre>}{returns.slice(0, 10).map((item: any) => <p key={item.id} className="border-t border-slate-100 pt-2 text-xs dark:border-slate-800">#{item.id} · consignment {item.consignment_id} · {item.status}</p>)}</div>
      <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><h3 className="text-sm font-bold">Request pickup</h3><p className="text-xs text-slate-500">Choose your Steadfast merchant address ID and a service police station.</p><div className="grid grid-cols-2 gap-2"><input className={inputClass} type="number" min="1" placeholder="Merchant address ID" value={pickup.address_id} onChange={e => setPickup({ ...pickup, address_id: e.target.value })}/><select className={inputClass} value={pickup.police_station_id} onChange={e => setPickup({ ...pickup, police_station_id: e.target.value })}><option value="">Police station</option>{stations.map((item: any) => <option key={item.id} value={item.id}>{item.name} {item.district?.name ? `· ${item.district.name}` : ''}</option>)}</select></div><button disabled={busy} onClick={() => read('/couriers/steadfast/police-stations', value => setStations(Array.isArray(value) ? value : value?.police_stations || value?.data || []))} className={buttonClass}>Load police stations</button><input className={inputClass} placeholder="Pickup address" value={pickup.address} onChange={e => setPickup({ ...pickup, address: e.target.value })}/><div className="grid grid-cols-2 gap-2"><input className={inputClass} placeholder="Contact phone" value={pickup.contact_number} onChange={e => setPickup({ ...pickup, contact_number: e.target.value })}/><input className={inputClass} type="number" min="1" placeholder="Estimated parcels" value={pickup.estim_qty} onChange={e => setPickup({ ...pickup, estim_qty: e.target.value })}/></div><input className={inputClass} placeholder="Note (optional)" value={pickup.note} onChange={e => setPickup({ ...pickup, note: e.target.value })}/><button disabled={busy || !pickup.address_id || !pickup.police_station_id || !pickup.address || !pickup.contact_number} onClick={createPickup} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Submit pickup request</button>{requests.slice(0, 5).map((item: any) => <p key={item.id} className="text-xs text-slate-500">{item.type} #{item.externalId} · {item.status}</p>)}</div>
      <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><h3 className="text-sm font-bold">Customer fraud signal</h3><p className="text-xs text-slate-500">A score is informational, not an automatic rejection decision.</p><div className="flex gap-2"><input className={inputClass} placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)}/><button disabled={busy || !/^01[3-9]\d{8}$/.test(phone)} className={buttonClass} onClick={() => read(`/couriers/steadfast/fraud-score/${phone}`, setScore)}>Check</button></div>{score && <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-950">{JSON.stringify(score, null, 2)}</pre>}</div>
    </div>
  </section>;
}
