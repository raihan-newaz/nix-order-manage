import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Package, Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import type { PurchaseOrder, Supplier } from '../types';
import { PurchaseCreateModal } from '../components/purchases/PurchaseCreateModal';

type Account = { id: string; name: string; balance: number };
type Warehouse = { id: string; name: string };
const amount = (value: number) => `৳${Number(value || 0).toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;

export const PurchasesPage: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newPurchase, setNewPurchase] = useState(false);
  const [newSupplier, setNewSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', company: '', address: '' });
  const [supplierSaving, setSupplierSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    Promise.allSettled([
      api.get('/purchases/suppliers'), api.get('/accounting/accounts'), api.get('/inventory/warehouses'),
    ]).then(([supplierResult, accountResult, warehouseResult]) => {
      if (supplierResult.status === 'fulfilled') setSuppliers(supplierResult.value.data.suppliers || []);
      if (accountResult.status === 'fulfilled') setAccounts(accountResult.value.data.accounts || []);
      if (warehouseResult.status === 'fulfilled') setWarehouses(warehouseResult.value.data.warehouses || []);
    });
  }, [refreshKey]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/purchases/orders', { params: { page, limit: 20, search: query, status: status === 'ALL' ? undefined : status } })
      .then(({ data }) => { if (!cancelled) { setPurchases(data.purchases || []); setTotal(data.pagination?.total || 0); setTotalPages(data.pagination?.totalPages || 1); } })
      .catch(() => { if (!cancelled) toast.error('Could not load purchases'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, query, status, refreshKey]);

  const saveSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    setSupplierSaving(true);
    try {
      await api.post('/purchases/suppliers', supplierForm);
      toast.success('Supplier added');
      setNewSupplier(false);
      setSupplierForm({ name: '', phone: '', company: '', address: '' });
      setRefreshKey((key) => key + 1);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not add supplier'); }
    finally { setSupplierSaving(false); }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-black tracking-tight"><Package className="h-6 w-6 text-emerald-600 dark:text-emerald-400"/> Purchases</h1><p className="text-sm text-slate-500">Purchase invoices, supplier dues, and catalogue stock inward.</p></div><div className="flex gap-2"><button onClick={() => setNewSupplier(true)} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900">Add supplier</button><button onClick={() => setNewPurchase(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold shadow transition"><Plus className="h-4 w-4"/> New purchase</button></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-100/90 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">Purchase invoices</p><p className="mt-1 text-2xl font-black">{total}</p></div><div className="rounded-2xl border border-slate-100/90 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">Suppliers</p><p className="mt-1 text-2xl font-black">{suppliers.length}</p></div><div className="rounded-2xl border border-slate-100/90 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">Supplier balance due</p><p className="mt-1 text-2xl font-black text-rose-600">{amount(suppliers.reduce((sum, supplier) => sum + Number(supplier.balanceDue || 0), 0))}</p></div></div>
    <div className="overflow-hidden rounded-2xl border border-slate-100/90 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 p-4 dark:border-slate-800"><div className="relative w-full max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice or supplier…" className="h-9 w-full rounded-xl border border-slate-200/80 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"/></div><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="ALL">All statuses</option><option value="RECEIVED">Received</option><option value="DRAFT">Draft</option><option value="CANCELLED">Cancelled</option></select></div>
      {loading ? <div className="p-12 text-center text-sm text-slate-500">Loading purchases…</div> : purchases.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">No purchases found.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Products</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Due</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Details</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{purchases.map((purchase) => <tr key={purchase.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="px-4 py-3"><Link to={`/purchases/${purchase.id}`} className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 hover:underline">{purchase.invoiceNumber}</Link></td><td className="px-4 py-3 font-semibold">{purchase.supplier?.name || 'Unknown supplier'}</td><td className="px-4 py-3 text-slate-500">{new Date(purchase.purchaseDate).toLocaleDateString()}</td><td className="max-w-[240px] truncate px-4 py-3 text-slate-600 dark:text-slate-300" title={purchase.items.map((item) => `${item.productName || item.product?.name || 'Deleted product'}${item.variantName ? ` / ${item.variantName}` : ''}`).join(', ')}>{purchase.items.length} item{purchase.items.length === 1 ? '' : 's'} · {purchase.items.map((item) => item.productName || item.product?.name || 'Deleted product').slice(0, 2).join(', ')}</td><td className="px-4 py-3 text-right font-bold">{amount(purchase.grandTotal)}</td><td className="px-4 py-3 text-right text-emerald-600">{amount(purchase.paidAmount)}</td><td className="px-4 py-3 text-right font-semibold text-rose-600">{amount(purchase.dueAmount)}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{purchase.status}</span></td><td className="px-4 py-3 text-right"><Link to={`/purchases/${purchase.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700"><Eye className="h-3.5 w-3.5"/> View</Link></td></tr>)}</tbody></table></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800"><span>Showing {purchases.length} of {total} · 20 per page</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1.5 font-bold disabled:opacity-40 dark:border-slate-700"><ChevronLeft className="h-4 w-4"/> Previous</button><span>Page {page} of {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1.5 font-bold disabled:opacity-40 dark:border-slate-700">Next <ChevronRight className="h-4 w-4"/></button></div></div>
    </div>
    {newPurchase && <PurchaseCreateModal suppliers={suppliers} accounts={accounts} warehouses={warehouses} onClose={() => setNewPurchase(false)} onCreated={() => { setNewPurchase(false); setPage(1); setRefreshKey((key) => key + 1); }}/>} 
    {newSupplier && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewSupplier(false); }}><section role="dialog" aria-modal="true" aria-label="Add supplier" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">Add supplier</h2><button onClick={() => setNewSupplier(false)} aria-label="Close"><X className="h-5 w-5"/></button></div><form onSubmit={saveSupplier} className="space-y-3">{(['name', 'phone', 'company', 'address'] as const).map((field) => <label key={field} className="block text-xs font-bold capitalize">{field}{['name', 'phone'].includes(field) ? ' *' : ''}<input required={['name', 'phone'].includes(field)} value={supplierForm[field]} onChange={(event) => setSupplierForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"/></label>)}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setNewSupplier(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700">Cancel</button><button disabled={supplierSaving} className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-4 py-2 text-sm font-bold shadow transition disabled:opacity-50">{supplierSaving ? 'Saving…' : 'Save supplier'}</button></div></form></section></div>}
  </div>;
};
