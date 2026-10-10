import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import type { Order } from '../../types';

type Props = { order: Order; onClose: () => void; onSuccess: () => void };

const editableStatuses = new Set(['PENDING', 'CONFIRMED', 'PACKAGING', 'HOLD']);

export const OrderEditModal: React.FC<Props> = ({ order, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerName: order.customerName || '', customerPhone: order.customerPhone || '', customerAddress: order.customerAddress || '',
    district: order.district || '', city: order.city || '', zone: order.zone || '', area: order.area || '',
    paymentMethod: order.paymentMethod || 'COD', deliveryCharge: String(order.deliveryCharge ?? 0),
    discount: String(order.discount ?? 0), advancePaid: String(order.advancePaid ?? 0), internalNote: order.internalNote || '', customerNote: order.customerNote || '',
  });
  const canEdit = editableStatuses.has(order.status) && !order.courierName;
  const totals = useMemo(() => {
    const delivery = Math.max(0, Number(form.deliveryCharge) || 0);
    const discount = Math.max(0, Number(form.discount) || 0);
    const advance = Math.max(0, Number(form.advancePaid) || 0);
    const grand = Math.max(0, order.subtotal + delivery - discount);
    return { grand, cod: Math.max(0, grand - advance) };
  }, [form.advancePaid, form.deliveryCharge, form.discount, order.subtotal]);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      await api.patch(`/orders/${order.id}`, { ...form, deliveryCharge: Number(form.deliveryCharge), discount: Number(form.discount), advancePaid: Number(form.advancePaid) });
      toast.success('Order updated'); onSuccess(); onClose();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not update order'); }
    finally { setSaving(false); }
  };
  const field = 'h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950';
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Edit order">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900"><div><h3 className="text-lg font-black text-slate-950 dark:text-white">Edit {order.orderNumber}</h3><p className="mt-1 text-xs text-slate-500">Customer, delivery, payment and notes only. Items and status use their dedicated workflows.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5"/></button></div>
        {!canEdit && <div className="mx-6 mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This order is already dispatched or closed, so editing is locked to protect its courier and payment history.</div>}
        <fieldset disabled={!canEdit || saving} className="space-y-5 p-6 disabled:opacity-60"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700 dark:text-slate-200">Customer name<input required value={form.customerName} onChange={(e) => update('customerName', e.target.value)} className={`${field} mt-1.5`}/></label><label className="text-sm font-bold text-slate-700 dark:text-slate-200">Phone<input required value={form.customerPhone} onChange={(e) => update('customerPhone', e.target.value)} className={`${field} mt-1.5`}/></label></div><label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Delivery address<textarea required value={form.customerAddress} onChange={(e) => update('customerAddress', e.target.value)} className={`${field} mt-1.5 min-h-20 py-2`}/></label><div className="grid gap-4 sm:grid-cols-4">{(['district', 'city', 'zone', 'area'] as const).map((key) => <label key={key} className="text-sm font-bold capitalize text-slate-700 dark:text-slate-200">{key}<input value={form[key]} onChange={(e) => update(key, e.target.value)} className={`${field} mt-1.5`}/></label>)}</div><div className="grid gap-4 sm:grid-cols-4"><label className="text-sm font-bold text-slate-700 dark:text-slate-200">Payment<select value={form.paymentMethod} onChange={(e) => update('paymentMethod', e.target.value)} className={`${field} mt-1.5`}><option>COD</option><option>BKASH</option><option>NAGAD</option><option>BANK</option><option>PREPAID</option></select></label>{(['deliveryCharge', 'discount', 'advancePaid'] as const).map((key) => <label key={key} className="text-sm font-bold capitalize text-slate-700 dark:text-slate-200">{key.replace(/([A-Z])/g, ' $1')}<input min="0" type="number" value={form[key]} onChange={(e) => update(key, e.target.value)} className={`${field} mt-1.5`}/></label>)}</div><div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-950"><div className="flex justify-between"><span>Updated total</span><b>৳{totals.grand.toLocaleString()}</b></div><div className="mt-1 flex justify-between text-slate-500"><span>COD due</span><b>৳{totals.cod.toLocaleString()}</b></div></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700 dark:text-slate-200">Customer note<textarea value={form.customerNote} onChange={(e) => update('customerNote', e.target.value)} className={`${field} mt-1.5 min-h-20 py-2`}/></label><label className="text-sm font-bold text-slate-700 dark:text-slate-200">Internal note<textarea value={form.internalNote} onChange={(e) => update('internalNote', e.target.value)} className={`${field} mt-1.5 min-h-20 py-2`}/></label></div></fieldset>
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700">Close</button>{canEdit && <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50"><Save className="h-4 w-4"/>{saving ? 'Saving…' : 'Save changes'}</button>}</div>
      </form>
    </div>,
    document.body
  );
};
