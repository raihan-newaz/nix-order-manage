import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

type Area = { externalId: string; name: string; districtName?: string; active: boolean };
type Store = { id: number; name: string; address: string; area_name: string; area_id: number; phone: string };
type Event = { id: string; event: string; occurredAt: string; trackingMessage?: string; merchantOrderId?: string; consignmentId?: string; applied: boolean };
const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';

export const RedXPanel: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [draft, setDraft] = useState({ name: '', phone: '', address: '', area_id: '' });
  const [areaSearch, setAreaSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const [storeResponse, areaResponse, eventResponse] = await Promise.all([
        api.get('/couriers/redx/stores'), api.get('/couriers/locations/REDX?level=AREA'), api.get('/couriers/redx/events'),
      ]);
      setStores(storeResponse.data.data || []);
      setAreas(areaResponse.data.locations || []);
      setEvents(eventResponse.data.events || []);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not load RedX data'); }
  };
  useEffect(() => { load(); }, []);
  const createStore = async () => {
    setBusy(true);
    try {
      await api.post('/couriers/redx/stores', { ...draft, area_id: Number(draft.area_id) });
      toast.success('RedX pickup store created');
      setDraft({ name: '', phone: '', address: '', area_id: '' });
      await load();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not create pickup store'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">RedX pickup stores & events</h2><p className="text-xs text-slate-500">Delivery areas use RedX IDs; new stores are created in the selected environment.</p></div><button onClick={load} className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700">Refresh</button></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold">Pickup stores ({stores.length})</h3>
        <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">{stores.map(store => <p key={store.id} className="px-3 py-2 text-xs"><span className="font-medium">{store.name}</span> #{store.id} · {store.area_name}<span className="block text-slate-500">{store.address} · {store.phone}</span></p>)}{!stores.length && <p className="p-3 text-xs text-slate-500">No pickup stores returned.</p>}</div>
        <h3 className="text-xs font-semibold">Create pickup store</h3>
        <div className="grid grid-cols-2 gap-2"><input className={input} placeholder="Store name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/><input className={input} placeholder="01XXXXXXXXX" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })}/><input className={`${input} col-span-2`} placeholder="Full pickup address" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })}/><input className={`${input} col-span-2`} placeholder="Search RedX pickup area" value={areaSearch} onChange={e => setAreaSearch(e.target.value)}/><select className={`${input} col-span-2`} value={draft.area_id} onChange={e => setDraft({ ...draft, area_id: e.target.value })}><option value="">Select area</option>{areas.filter(area => area.active && (!areaSearch || `${area.name} ${area.districtName || ''}`.toLowerCase().includes(areaSearch.toLowerCase()) || area.externalId === draft.area_id)).slice(0, 150).map(area => <option key={area.externalId} value={area.externalId}>{area.name}{area.districtName ? ` · ${area.districtName}` : ''}</option>)}</select></div>
        <button disabled={busy || !draft.name || !draft.phone || !draft.address || !draft.area_id} onClick={createStore} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-40 dark:bg-emerald-600">Create store</button>
      </div>
      <div><h3 className="text-xs font-semibold">Latest status callbacks</h3><div className="mt-2 max-h-72 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">{events.slice(0, 15).map(event => <p key={event.id} className="px-3 py-2 text-xs"><span className="font-medium">{event.event}</span> · {event.consignmentId}<span className="block text-slate-500">{event.trackingMessage || event.merchantOrderId} · {new Date(event.occurredAt).toLocaleString()} · {event.applied ? 'Applied' : 'Recorded'}</span></p>)}{!events.length && <p className="p-3 text-xs text-slate-500">No RedX callbacks received yet.</p>}</div></div>
    </div>
  </section>;
};
