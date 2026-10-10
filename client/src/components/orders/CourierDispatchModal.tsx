import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Order } from '../../types';
import api from '../../lib/api';
import { Truck, X, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface CourierDispatchModalProps {
  order: Order | null;
  onClose: () => void;
  onSuccess: (updatedOrder: Order) => void;
}

type Location = { id: string; externalId: string; name: string; normalizedName: string; parentExternalId?: string; districtName?: string; active: boolean };
const normalize = (value: string) => value.toLowerCase().normalize('NFKC').replace(/\b(district|zila|zilla)\b/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const autoMatch = (items: Location[], hints: string[], address: string): Location | undefined => {
  for (const hint of hints) {
    const target = normalize(hint || '');
    if (!target) continue;
    const matches = items.filter(item => normalize(item.name) === target);
    if (matches.length === 1) return matches[0];
  }
  const words = ` ${normalize(address)} `;
  const matches = items.filter(item => normalize(item.name).length >= 4 && words.includes(` ${normalize(item.name)} `));
  return matches.length === 1 ? matches[0] : undefined;
};

export const CourierDispatchModal: React.FC<CourierDispatchModalProps> = ({
  order,
  onClose,
  onSuccess,
}) => {
  const [courier, setCourier] = useState<'STEADFAST' | 'PATHAO' | 'REDX'>('STEADFAST');
  const [weight, setWeight] = useState(0.5);
  const [specialInstruction, setSpecialInstruction] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Pathao specific state
  const [cities, setCities] = useState<Location[]>([]);
  const [stores, setStores] = useState<Array<{ store_id: number | string; store_name: string; is_active: number }>>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [zones, setZones] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Location[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [manualArea, setManualArea] = useState(order?.area || '');
  const [deliveryType, setDeliveryType] = useState(48);
  const [sfDeliveryType, setSfDeliveryType] = useState<0 | 1>(0);
  const [itemType, setItemType] = useState<1 | 2>(2);
  const [priceQuote, setPriceQuote] = useState<number | null>(null);
  const [redxAreas, setRedxAreas] = useState<Location[]>([]);
  const [redxAreaId, setRedxAreaId] = useState('');
  const [redxAreaQuery, setRedxAreaQuery] = useState(order?.area || '');
  const [redxStores, setRedxStores] = useState<Array<{ id: number; name: string; area_id: number }>>([]);
  const [redxStoreId, setRedxStoreId] = useState('');
  const manuallySelected = useRef({ district: false, thana: false, area: false });
  const locationProvider = courier;

  useEffect(() => {
    let cancelled = false;
    manuallySelected.current = { district: false, thana: false, area: false };
    setSelectedCity(''); setSelectedZone(''); setSelectedArea(''); setCities([]); setZones([]); setAreas([]);
    setRedxAreaId(''); setRedxAreas([]); setRedxStores([]); setRedxStoreId('');
    if (courier === 'REDX') {
      api.get('/couriers/locations/REDX?level=AREA').then(({ data }) => { if (!cancelled) setRedxAreas(data.locations || []); })
        .catch(error => { if (!cancelled) toast.error(error.response?.data?.message || 'Could not load RedX areas'); });
      api.get('/couriers/redx/stores').then(({ data }) => { if (!cancelled) setRedxStores(data.data || []); })
        .catch(error => { if (!cancelled) toast.error(error.response?.data?.message || 'Could not load RedX pickup stores'); });
    } else api.get(`/couriers/locations/${locationProvider}?level=DISTRICT`)
      .then(({ data }) => { if (!cancelled) setCities(data.locations || []); })
      .catch((error) => { if (!cancelled) toast.error(error.response?.data?.message || 'Could not load courier districts'); });
    if (courier === 'PATHAO') api.get('/couriers/pathao/stores').then(({ data }) => {
      setStores(data.data || []); setSelectedStore(String(data.selectedStoreId || ''));
    }).catch((error) => toast.error(error.response?.data?.message || 'Could not load Pathao pickup stores'));
    return () => { cancelled = true; };
  }, [courier, locationProvider]);

  useEffect(() => {
    if (courier !== 'REDX' || !order || !redxAreas.length || manuallySelected.current.area || redxAreaId) return;
    const district = normalize(order.district || order.city || '');
    const candidates = district ? redxAreas.filter(item => !item.districtName || normalize(item.districtName) === district) : redxAreas;
    const match = autoMatch(candidates, [order.area || ''], order.customerAddress);
    if (match) setRedxAreaId(match.externalId);
  }, [courier, order, redxAreas, redxAreaId]);

  useEffect(() => {
    if (!order || !cities.length || manuallySelected.current.district || selectedCity) return;
    const match = autoMatch(cities, [order.district || '', order.city || ''], order.customerAddress);
    if (match) setSelectedCity(match.externalId);
  }, [cities, order, selectedCity]);

  useEffect(() => {
    let cancelled = false;
    setSelectedZone(''); setSelectedArea(''); setZones([]); setAreas([]);
    if (!selectedCity) return;
    api.get(`/couriers/locations/${locationProvider}?level=THANA&parentId=${selectedCity}`).then((res) => { if (!cancelled) setZones(res.data.locations || []); }).catch(() => { if (!cancelled) toast.error('Could not load courier thanas/zones'); });
    return () => { cancelled = true; };
  }, [locationProvider, selectedCity]);

  useEffect(() => {
    if (!order || !zones.length || manuallySelected.current.thana || selectedZone) return;
    const match = autoMatch(zones, [order.zone || '', order.city || ''], order.customerAddress);
    if (match) setSelectedZone(match.externalId);
  }, [zones, order, selectedZone]);

  useEffect(() => {
    let cancelled = false;
    setSelectedArea(''); setAreas([]);
    if (courier !== 'PATHAO' || !selectedZone) return;
    api.get(`/couriers/locations/PATHAO?level=AREA&parentId=${selectedZone}`).then((res) => { if (!cancelled) setAreas(res.data.locations || []); }).catch(() => { if (!cancelled) toast.error('Could not load Pathao areas'); });
    return () => { cancelled = true; };
  }, [courier, selectedZone]);

  useEffect(() => {
    if (!order || !areas.length || manuallySelected.current.area || selectedArea) return;
    const match = autoMatch(areas, [order.area || ''], order.customerAddress);
    if (match) setSelectedArea(match.externalId);
  }, [areas, order, selectedArea]);

  useEffect(() => { setPriceQuote(null); }, [courier, selectedCity, selectedZone, selectedStore, redxAreaId, redxStoreId, deliveryType, itemType, weight]);

  const calculatePrice = async () => {
    try {
      if (courier === 'REDX') {
        const pickup = redxStores.find(store => String(store.id) === redxStoreId);
        if (!pickup) return;
        const response = await api.post('/couriers/redx/charge', { deliveryAreaId: Number(redxAreaId), pickupAreaId: pickup.area_id, cashCollectionAmount: codAmount, weightGrams: Math.round(weight * 1000) });
        setPriceQuote(Number(response.data.data?.deliveryCharge || 0) + Number(response.data.data?.codCharge || 0));
        return;
      }
      const response = await api.post('/couriers/pathao/price', { cityId: Number(selectedCity), zoneId: Number(selectedZone), storeId: selectedStore ? Number(selectedStore) : undefined, weight, deliveryType, itemType });
      setPriceQuote(Number(response.data.data?.final_price));
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not calculate Pathao delivery fee'); }
  };

  if (!order) return null;

  const handleDispatch = async () => {
    setLoading(true);
    try {
      const res = await api.post('/couriers/dispatch', {
        orderId: order.id,
        courierName: courier,
        weight,
        cityId: selectedCity ? Number(selectedCity) : undefined,
        zoneId: selectedZone ? Number(selectedZone) : undefined,
        areaId: courier === 'REDX' ? Number(redxAreaId) : selectedArea ? Number(selectedArea) : undefined,
        areaName: courier === 'STEADFAST' ? manualArea.trim() || undefined : undefined,
        deliveryType: courier === 'STEADFAST' ? sfDeliveryType : deliveryType,
        itemType,
        storeId: courier === 'REDX' ? redxStoreId ? Number(redxStoreId) : undefined : selectedStore ? Number(selectedStore) : undefined,
        itemDescription,
        secondaryPhone: secondaryPhone.trim() || undefined,
        specialInstruction,
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Parcel successfully sent to courier!');
        onSuccess(res.data.order);
        onClose();
      } else {
        toast.error(res.data?.message || 'Failed to dispatch order');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Dispatch failed');
    } finally {
      setLoading(false);
    }
  };

  const codAmount = order.codAmount > 0 ? order.codAmount : order.grandTotal - order.advancePaid;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[calc(100vh-2rem)] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200/60 dark:border-emerald-500/20">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg">Send Order to Courier</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Order #{order.orderNumber} • Courier booking & tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Customer Summary Card */}
          <div className="bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Recipient Name:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{order.customerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Recipient Phone:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{order.customerPhone}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">Delivery Address:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 text-right max-w-xs">{order.customerAddress || 'No address provided'}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">COD Cash to Collect:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">৳{codAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Courier Selector Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Select Courier Provider
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'STEADFAST', name: 'Steadfast', desc: '1-Click API Entry' },
                { id: 'PATHAO', name: 'Pathao', desc: 'Auto City/Zone API' },
                { id: 'REDX', name: 'RedX', desc: 'Instant Parcel API' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCourier(c.id as any)}
                  className={`p-3 text-left rounded-xl border transition-all ${
                    courier === c.id
                      ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <p className="font-bold text-xs sm:text-sm">{c.name}</p>
                  <p className="text-[11px] opacity-75 mt-0.5">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Parcel Weight (KG)
              </label>
              <input
                type="number"
                step="0.1"
                min={courier === 'PATHAO' ? '0.5' : '0.1'}
                max={courier === 'PATHAO' ? '10' : '20'}
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 0.5)}
                className="w-full h-9 bg-slate-50/70 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Customer District
              </label>
              <div className="h-9 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 px-3 flex items-center text-xs text-slate-700 dark:text-slate-300 truncate">
                {order.district || order.city || 'Not specified'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3.5">
            <div className="col-span-2">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Courier Location</p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Matched from the customer address. Review and adjust manually if needed.
              </p>
            </div>
            {courier !== 'REDX' && <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              District / City
              <select
                value={selectedCity}
                onChange={e => {
                  manuallySelected.current.district = true;
                  manuallySelected.current.thana = false;
                  manuallySelected.current.area = false;
                  setSelectedCity(e.target.value);
                }}
                className="mt-1 w-full h-9 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="">Select district</option>
                {cities.filter(item => item.active).map(item => (
                  <option key={item.id} value={item.externalId}>{item.name}</option>
                ))}
              </select>
            </label>}
            {courier !== 'REDX' && <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Thana / Zone
              <select
                value={selectedZone}
                disabled={!selectedCity}
                onChange={e => {
                  manuallySelected.current.thana = true;
                  manuallySelected.current.area = false;
                  setSelectedZone(e.target.value);
                }}
                className="mt-1 w-full h-9 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                <option value="">Select thana</option>
                {zones.filter(item => item.active).map(item => (
                  <option key={item.id} value={item.externalId}>{item.name}</option>
                ))}
              </select>
            </label>}
            {courier === 'PATHAO' && (
              <label className="col-span-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                Area
                <select
                  value={selectedArea}
                  disabled={!selectedZone}
                  onChange={e => {
                    manuallySelected.current.area = true;
                    setSelectedArea(e.target.value);
                  }}
                  className="mt-1 w-full h-9 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="">Select area (optional)</option>
                  {areas.filter(item => item.active).map(item => (
                    <option key={item.id} value={item.externalId}>{item.name}</option>
                  ))}
                </select>
                {selectedZone && !areas.length && (
                  <span className="mt-1 block text-[11px] text-amber-600 dark:text-amber-300">
                    No area list available for this zone. District and zone are sufficient to dispatch.
                  </span>
                )}
              </label>
            )}
            {courier === 'REDX' && <div className="col-span-2 space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">RedX delivery area (required)
                <input value={redxAreaQuery} onChange={e => { setRedxAreaQuery(e.target.value); manuallySelected.current.area = true; setRedxAreaId(''); }} placeholder="Search delivery area or district" className="mt-1 w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900" />
              </label>
              <select value={redxAreaId} onChange={e => { manuallySelected.current.area = true; setRedxAreaId(e.target.value); }} className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900">
                <option value="">Select the exact RedX area</option>
                {redxAreas.filter(item => item.active && (!redxAreaQuery || `${item.name} ${item.districtName || ''}`.toLowerCase().includes(redxAreaQuery.toLowerCase()) || item.externalId === redxAreaId)).slice(0, 150).map(item => <option key={item.id} value={item.externalId}>{item.name}{item.districtName ? ` · ${item.districtName}` : ''}</option>)}
              </select>
              {redxAreaId && <p className="text-[11px] text-emerald-700">RedX area ID: {redxAreaId}</p>}
            </div>}
            {courier === 'STEADFAST' && (
              <label className="col-span-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                Area / Locality (optional)
                <input
                  type="text"
                  maxLength={100}
                  value={manualArea}
                  onChange={e => setManualArea(e.target.value)}
                  placeholder="Enter locality when provider has no area list"
                  className="mt-1 w-full h-9 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                  Steadfast provides district and police station IDs, but no separate area dropdown.
                </span>
              </label>
            )}
          </div>

          {courier === 'REDX' && <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/40 p-3.5 dark:border-red-900/40 dark:bg-red-950/20">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Pickup store
              <select value={redxStoreId} onChange={e => setRedxStoreId(e.target.value)} className="mt-1 w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900">
                <option value="">Use RedX default pickup store</option>
                {redxStores.map(store => <option key={store.id} value={store.id}>{store.name} (#{store.id})</option>)}
              </select>
            </label>
            <div className="flex items-center gap-3">
              <button type="button" disabled={!redxAreaId || !redxStoreId} onClick={calculatePrice} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium disabled:opacity-40">Calculate RedX fee</button>
              {priceQuote !== null && <span className="text-xs font-medium">Estimated fee: ৳{priceQuote}</span>}
            </div>
          </div>}

          {/* Steadfast specific fields */}
          {courier === 'STEADFAST' && (
            <div className="grid gap-3 rounded-xl border border-emerald-200/80 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 sm:grid-cols-2">
              <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Delivery Type
                <select
                  value={sfDeliveryType}
                  onChange={(event) => setSfDeliveryType(Number(event.target.value) as 0 | 1)}
                  className="mt-1 w-full h-9 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value={0}>Home delivery</option>
                  <option value={1}>Point delivery</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Alternative Phone (optional)
                <input
                  type="tel"
                  maxLength={11}
                  value={secondaryPhone}
                  onChange={(event) => setSecondaryPhone(event.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="mt-1 w-full h-9 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </label>
              <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 sm:col-span-2">
                Item Description (optional)
                <input
                  type="text"
                  maxLength={255}
                  value={itemDescription}
                  onChange={(event) => setItemDescription(event.target.value)}
                  placeholder="Defaults to the order's product names"
                  className="mt-1 w-full h-9 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </label>
            </div>
          )}

          {/* Pathao specific fields */}
          {courier === 'PATHAO' && (
            <div className="grid grid-cols-2 gap-3.5 p-3.5 bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-xl">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Pickup Store</label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Use configured default store</option>
                  {stores.filter((store) => Number(store.is_active) === 1).map((store) => (
                    <option key={store.store_id} value={store.store_id}>
                      {store.store_name} (#{store.store_id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Delivery Type</label>
                <select
                  value={deliveryType}
                  onChange={(e) => setDeliveryType(Number(e.target.value))}
                  className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value={48}>Normal (48h)</option>
                  <option value={12}>On demand (12h)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Item Type</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(Number(e.target.value) as 1 | 2)}
                  className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value={2}>Parcel</option>
                  <option value={1}>Document</option>
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <button
                  type="button"
                  disabled={!selectedCity || !selectedZone}
                  onClick={calculatePrice}
                  className="h-8 rounded-lg border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/50 disabled:opacity-40 transition-colors"
                >
                  Calculate Pathao Fee
                </button>
                {priceQuote !== null && Number.isFinite(priceQuote) && (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    Estimated fee: ৳{priceQuote}
                  </span>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Item Description (optional)</label>
                <input
                  type="text"
                  maxLength={180}
                  value={itemDescription}
                  onChange={(event) => setItemDescription(event.target.value)}
                  placeholder="Defaults to the order's product names"
                  className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Secondary Phone (optional)</label>
                <input
                  type="tel"
                  inputMode="tel"
                  maxLength={11}
                  value={secondaryPhone}
                  onChange={(event) => setSecondaryPhone(event.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Special Delivery Instruction (For Courier Rider)
            </label>
            <input
              type="text"
              placeholder="e.g. Call before delivery, handle with care"
              value={specialInstruction}
              onChange={(e) => setSpecialInstruction(e.target.value)}
              className="w-full h-9 bg-slate-50/70 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50/80 dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || (courier === 'REDX' ? !redxAreaId : !selectedCity || !selectedZone)}
            onClick={handleDispatch}
            className="h-9 flex items-center gap-2 px-5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Confirm & Dispatch to {courier}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
