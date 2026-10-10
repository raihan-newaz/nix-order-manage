import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, Boxes, CheckSquare, ChevronLeft, ChevronRight, CircleDollarSign, ImageOff, Layers3, Plus, RotateCcw, Search, ShoppingBag, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import type { Product } from '../types';

const money = (value: number) => `৳${Number(value || 0).toLocaleString()}`;

export const ProductsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(params.get('search') || '');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [archivingId, setArchivingId] = useState('');
  const [pendingAction, setPendingAction] = useState<{ kind: 'TRASH' | 'PERMANENT_DELETE'; ids: string[]; names: string[]; single: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/inventory/products', { params: { search: params.get('search') || undefined, status: status === 'ALL' ? undefined : status, page, limit: 20 } });
      setProducts(data.products || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not load products');
    } finally { setLoading(false); }
  };
  useEffect(() => { setQuery(params.get('search') || ''); setPage(Number(params.get('page')) || 1); setSelectedIds([]); }, [params.toString()]);
  useEffect(() => { load(); }, [params.toString(), page, status]);
  useEffect(() => {
    const activeQuery = params.get('search') || '';
    if (query.trim() === activeQuery) return;
    const timer = window.setTimeout(() => setSearch(query), 300);
    return () => window.clearTimeout(timer);
  }, [query, params.toString()]);

  const visible = useMemo(() => products.filter((product) => status === 'ALL' || product.status === status), [products, status]);
  const stats = useMemo(() => ({
    active: products.filter((p) => p.status === 'ACTIVE').length,
    low: products.filter((p) => p.stockQuantity <= p.minStockThreshold).length,
    value: products.reduce((sum, p) => sum + p.stockQuantity * p.buyPrice, 0),
  }), [products]);

  const archive = (product: Product) => setPendingAction({ kind: 'TRASH', ids: [product.id], names: [product.name], single: true });

  const confirmProductAction = async () => {
    if (!pendingAction) return;
    setBulkSaving(true);
    if (pendingAction.single) setArchivingId(pendingAction.ids[0]);
    try {
      if (pendingAction.kind === 'PERMANENT_DELETE') {
        const { data } = await api.post('/inventory/products/permanent-delete', { productIds: pendingAction.ids });
        if (data.count) toast.success(`${data.count} product${data.count === 1 ? '' : 's'} permanently deleted`);
        if (data.blocked?.length) toast.error(`${data.blocked.length} kept in Trash: purchase/stock history must be preserved`);
        if (!data.count && !data.blocked?.length) toast.error('No products were deleted. Refresh the Trash and try again.');
      } else if (pendingAction.single) {
        const { data } = await api.delete(`/inventory/products/${pendingAction.ids[0]}`);
        toast.success(data.message || 'Product moved to Trash');
      } else {
        const { data } = await api.post('/inventory/products/bulk', { productIds: pendingAction.ids, action: 'ARCHIVE' });
        if (!data.count) throw new Error('No products were moved to Trash. Refresh the list and try again.');
        toast.success(`${data.count} product${data.count === 1 ? '' : 's'} moved to Trash`);
      }
      setPendingAction(null);
      setSelectedIds([]);
      await load();
    } catch (error: any) { toast.error(error.response?.data?.message || error.message || 'Could not archive product(s)'); }
    finally { setBulkSaving(false); setArchivingId(''); }
  };

  const restore = async (product: Product) => {
    setArchivingId(product.id);
    try { const { data } = await api.post(`/inventory/products/${product.id}/restore`); toast.success(data.message || 'Product restored as draft'); await load(); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not restore product'); }
    finally { setArchivingId(''); }
  };

  const restoreSelected = async () => {
    if (!selectedIds.length) return;
    setBulkSaving(true);
    try {
      const { data } = await api.post('/inventory/products/bulk-restore', { productIds: selectedIds });
      toast.success(data.message || 'Products restored as draft');
      setSelectedIds([]);
      await load();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not restore selected products'); }
    finally { setBulkSaving(false); }
  };

  const setSearch = (value: string) => {
    const next = new URLSearchParams(params);
    value.trim() ? next.set('search', value.trim()) : next.delete('search');
    next.delete('page');
    setParams(next);
  };
  const setPageAndUrl = (nextPage: number) => {
    const next = new URLSearchParams(params);
    nextPage > 1 ? next.set('page', String(nextPage)) : next.delete('page');
    setParams(next);
  };
  const toggleAll = () => setSelectedIds(selectedIds.length === visible.length ? [] : visible.map((product) => product.id));
  const toggleOne = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const bulkUpdate = async (action: 'ACTIVATE' | 'DRAFT' | 'OUT_OF_STOCK' | 'ARCHIVE') => {
    if (!selectedIds.length) return;
    if (action === 'ARCHIVE') {
      const names = products.filter((product) => selectedIds.includes(product.id)).map((product) => product.name);
      setPendingAction({ kind: 'TRASH', ids: [...selectedIds], names, single: false });
      return;
    }
    setBulkSaving(true);
    try {
      const { data } = await api.post('/inventory/products/bulk', { productIds: selectedIds, action });
      toast.success(data.message || 'Products updated');
      setSelectedIds([]);
      await load();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not update selected products'); }
    finally { setBulkSaving(false); }
  };

  return <div className="space-y-4 pb-8">
    <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center dark:border-slate-800">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Products</h2><p className="text-xs text-slate-500">Storefront content, pricing, media, SEO and variations.</p></div>
      <div className="flex shrink-0 gap-2"><button type="button" onClick={() => { setStatus(status === 'ARCHIVED' ? 'ALL' : 'ARCHIVED'); setSelectedIds([]); setPageAndUrl(1); }} aria-pressed={status === 'ARCHIVED'} className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-medium ${status === 'ARCHIVED' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300' : 'border-slate-200/80 bg-white text-slate-700 hover:border-rose-300 hover:text-rose-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}><Trash2 className="h-4 w-4"/>Trash</button><Link to="/products/new" className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"><Plus className="h-4 w-4"/>Add product</Link></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {[['Active products', stats.active, ShoppingBag], ['Low stock', stats.low, Boxes], ['Inventory value', money(stats.value), CircleDollarSign]].map(([label, value, Icon]: any) => <div key={label} className="rounded-2xl border border-slate-100/90 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><Icon className="mb-2 h-4 w-4 text-emerald-600 dark:text-emerald-400"/><p className="text-xs font-medium text-slate-400">{label}</p><p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{value}</p></div>)}
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-100/90 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row dark:border-slate-800">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, SKU, barcode or variant…" className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950"/></div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setSelectedIds([]); setPageAndUrl(1); }} className="h-10 rounded-xl border border-slate-200/80 bg-white px-3 text-sm font-semibold dark:border-slate-800 dark:bg-slate-950"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="OUT_OF_STOCK">Out of stock</option><option value="ARCHIVED">Trash</option></select>
      </div>
      {selectedIds.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10"><span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"><CheckSquare className="h-4 w-4"/>{selectedIds.length} selected</span><div className="flex flex-wrap gap-2">{status === 'ARCHIVED' ? <><button disabled={bulkSaving} onClick={restoreSelected} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5"/>Restore selected</button><button disabled={bulkSaving} onClick={() => setPendingAction({ kind: 'PERMANENT_DELETE', ids: [...selectedIds], names: products.filter((product) => selectedIds.includes(product.id)).map((product) => product.name), single: false })} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Trash2 className="h-3.5 w-3.5"/>Delete permanently</button></> : <><button disabled={bulkSaving} onClick={() => bulkUpdate('ACTIVATE')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Make active</button><button disabled={bulkSaving} onClick={() => bulkUpdate('DRAFT')} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Move to draft</button><button disabled={bulkSaving} onClick={() => bulkUpdate('OUT_OF_STOCK')} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Mark out of stock</button><button disabled={bulkSaving} onClick={() => bulkUpdate('ARCHIVE')} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Trash2 className="h-3.5 w-3.5"/>Move to Trash</button></>}</div></div>}
      {loading ? <div className="p-16 text-center text-sm text-slate-500">Loading catalogue…</div> : visible.length === 0 ? <div className="p-16 text-center"><Layers3 className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-3 font-bold">{status === 'ARCHIVED' ? 'Trash is empty' : 'No products found'}</p><p className="text-sm text-slate-500">{status === 'ARCHIVED' ? 'Products you move to Trash will appear here.' : 'Create a product or change the current filters.'}</p></div> : <><div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-slate-950"><tr><th className="w-12 px-4 py-3"><input aria-label="Select all products on this page" type="checkbox" checked={selectedIds.length === visible.length && visible.length > 0} onChange={toggleAll} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"/></th><th className="px-4 py-3">Product</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Pricing</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Storefront</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{visible.map((product) => <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="px-4 py-3"><input aria-label={`Select ${product.name}`} type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => toggleOne(product.id)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"/></td><td className="px-4 py-3"><div className="flex items-center gap-3">{product.image ? <img src={product.image} alt="" className="h-12 w-12 rounded-xl border border-slate-200 object-cover dark:border-slate-700"/> : <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800"><ImageOff className="h-4 w-4 text-slate-400"/></span>}<div><Link to={`/products/${product.id}/edit`} className="font-bold text-slate-950 hover:text-emerald-600 dark:text-white">{product.name}</Link><p className="mt-0.5 text-xs text-slate-500">{product.sku}{product.category ? ` · ${product.category}` : ''}</p></div></div></td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{product.productType || 'SIMPLE'}</span><p className="mt-1 text-xs text-slate-400">{product.variants?.filter(v => v.status !== 'ARCHIVED').length || 0} variants</p></td><td className="px-4 py-3"><b>{money(product.salePrice || product.regularPrice)}</b>{product.salePrice < product.regularPrice && <p className="text-xs text-slate-400 line-through">{money(product.regularPrice)}</p>}</td><td className="px-4 py-3"><b className={product.stockQuantity <= product.minStockThreshold ? 'text-rose-600' : ''}>{product.stockQuantity}</b><p className="text-xs text-slate-400">Reorder at {product.minStockThreshold}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${product.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{product.status === 'ARCHIVED' ? 'TRASH' : product.status}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-2">{product.status === 'ARCHIVED' ? <><button disabled={archivingId === product.id} onClick={() => restore(product)} title="Restore as draft" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-50 dark:border-slate-700"><RotateCcw className="h-4 w-4"/></button><button disabled={bulkSaving} onClick={() => setPendingAction({ kind: 'PERMANENT_DELETE', ids: [product.id], names: [product.name], single: true })} title="Delete permanently" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-rose-300 hover:text-rose-600 disabled:opacity-50 dark:border-slate-700"><Trash2 className="h-4 w-4"/></button></> : <><Link to={`/products/${product.id}/edit`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700">Edit</Link><button disabled={archivingId === product.id} onClick={() => archive(product)} title="Move to Trash" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-rose-300 hover:text-rose-600 disabled:opacity-50 dark:border-slate-700"><Archive className="h-4 w-4"/></button></>}</div></td></tr>)}</tbody></table></div><div className="flex flex-col justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm sm:flex-row sm:items-center dark:border-slate-800"><span className="text-slate-500">Showing {products.length} of {total} products · 20 per page</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPageAndUrl(page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-slate-700"><ChevronLeft className="h-4 w-4"/>Previous</button><span className="text-xs font-bold text-slate-500">Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPageAndUrl(page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-slate-700">Next<ChevronRight className="h-4 w-4"/></button></div></div></>}
    </div>
    {pendingAction && createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !bulkSaving) setPendingAction(null); }}><section role="dialog" aria-modal="true" aria-labelledby="product-action-dialog-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10">{pendingAction.kind === 'TRASH' ? <Archive className="h-5 w-5"/> : <Trash2 className="h-5 w-5"/>}</div><h2 id="product-action-dialog-title" className="text-lg font-black text-slate-950 dark:text-white">{pendingAction.kind === 'TRASH' ? `Move ${pendingAction.single ? 'product' : `${pendingAction.ids.length} products`} to Trash?` : `Permanently delete ${pendingAction.single ? 'this product' : `these ${pendingAction.ids.length} products`}?`}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{pendingAction.names.slice(0, 3).join(', ')}{pendingAction.names.length > 3 ? ` and ${pendingAction.names.length - 3} more` : ''}. {pendingAction.kind === 'TRASH' ? 'It will disappear from the storefront and can be restored from Trash.' : 'This cannot be undone. Purchase and stock history will keep product/variant snapshots, but this product will be removed.'}</p><div className="mt-6 flex justify-end gap-2"><button type="button" disabled={bulkSaving} onClick={() => setPendingAction(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Cancel</button><button type="button" disabled={bulkSaving} onClick={confirmProductAction} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{bulkSaving ? 'Working…' : pendingAction.kind === 'TRASH' ? 'Move to Trash' : 'Delete permanently'}</button></div></section></div>, document.body)}
  </div>;
};

