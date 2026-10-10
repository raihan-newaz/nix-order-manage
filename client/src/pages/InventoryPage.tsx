import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Boxes, History, PackageCheck, Search, SlidersHorizontal, Warehouse, ExternalLink, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import type { Product, ProductVariant } from '../types';

type StockTarget = { product: Product; variant?: ProductVariant };
type StockRow = StockTarget & { stock: number; threshold: number; sku: string; label: string };
const variationLabel = (variant?: ProductVariant) => {
  if (!variant) return '';
  try { const attributes = variant.attributes ? JSON.parse(variant.attributes) : {}; const values = Object.values(attributes).filter(Boolean); if (values.length) return values.join(' / '); } catch { /* legacy variations */ }
  return [variant.color, variant.size].filter(Boolean).join(' / ') || variant.name;
};

export const InventoryPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<StockTarget | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [type, setType] = useState('MANUAL_ADJUSTMENT');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Movement history state
  const [historyTarget, setHistoryTarget] = useState<StockTarget | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (product: Product, variant?: ProductVariant) => {
    setHistoryTarget({ product, variant });
    setHistoryLoading(true);
    try {
      const params: any = { productId: product.id };
      if (variant?.id) params.variantId = variant.id;
      const { data } = await api.get('/inventory/stock-movements', { params });
      if (data?.success) {
        setHistoryList(data.movements || []);
      }
    } catch {
      toast.error('Failed to load stock movements');
    } finally {
      setHistoryLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/inventory/products'); setProducts(data.products || []); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not load inventory'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const rows = useMemo<StockRow[]>(() => products.flatMap<StockRow>(product => product.productType === 'VARIABLE' && product.variants?.length
    ? product.variants.filter(v => v.status !== 'ARCHIVED').map(variant => ({ product, variant, stock: variant.stockQuantity, threshold: variant.minStockThreshold ?? product.minStockThreshold, sku: variant.sku, label: `${product.name} · ${variationLabel(variant)}` }))
    : [{ product, variant: undefined, stock: product.stockQuantity, threshold: product.minStockThreshold, sku: product.sku, label: product.name }]
  ).filter(row => (!query || `${row.label} ${row.sku}`.toLowerCase().includes(query.toLowerCase())) && (!lowOnly || row.stock <= row.threshold)), [products, query, lowOnly]);
  const totals = useMemo(() => ({ units: rows.reduce((sum, row) => sum + row.stock, 0), low: rows.filter(row => row.stock > 0 && row.stock <= row.threshold).length, out: rows.filter(row => row.stock === 0).length }), [rows]);

  const openAdjustment = (product: Product, variant?: ProductVariant) => { setTarget({ product, variant }); setQuantity(1); setType('MANUAL_ADJUSTMENT'); setNote(''); };
  const adjust = async (event: React.FormEvent) => {
    event.preventDefault(); if (!target || quantity === 0) return;
    setSaving(true);
    try { await api.post('/inventory/stock-adjustment', { productId: target.product.id, variantId: target.variant?.id, type, quantity, note }); toast.success('Stock updated'); setTarget(null); load(); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not adjust stock'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-6 pb-10">
    <div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-600 dark:text-emerald-400">Stock operations</p><h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Inventory</h2><p className="mt-1 text-sm text-slate-500">Monitor availability and record every physical stock change. Product content is managed separately.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">{[[Warehouse, 'Available units', totals.units, 'text-emerald-600 dark:text-emerald-400'], [AlertTriangle, 'Low-stock SKUs', totals.low, 'text-amber-600'], [Boxes, 'Out of stock', totals.out, 'text-rose-600']].map(([Icon, label, value, color]: any) => <div key={label} className="rounded-2xl border border-slate-100/90 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><Icon className={`h-5 w-5 ${color}`}/><p className="mt-3 text-xs font-semibold text-slate-500">{label}</p><p className="text-2xl font-black">{value}</p></div>)}</div>
    <div className="overflow-hidden rounded-2xl border border-slate-100/90 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 sm:flex-row dark:border-slate-800"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product, variation or SKU…" className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"/></div><button onClick={() => setLowOnly(v => !v)} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold ${lowOnly ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 dark:border-slate-700'}`}><SlidersHorizontal className="h-4 w-4"/>Low stock only</button></div>
      {loading ? <div className="p-16 text-center text-sm text-slate-500">Loading stock…</div> : <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-slate-950"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Reorder level</th><th className="px-4 py-3">Health</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map(row => <tr key={row.variant?.id || row.product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30"><td className="px-4 py-3"><div className="flex items-center gap-3">{(row.variant?.image || row.product.image) ? <img src={row.variant?.image || row.product.image} alt="" className="h-10 w-10 rounded-lg object-cover"/> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 dark:bg-slate-800"><PackageCheck className="h-4 w-4 text-slate-400"/></span>}<div><b>{row.label}</b><p className="text-xs text-slate-400">{row.product.category || 'Uncategorised'}</p></div></div></td><td className="px-4 py-3 font-mono text-xs">{row.sku}</td><td className="px-4 py-3 text-lg font-black">{row.stock}</td><td className="px-4 py-3">{row.threshold}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.stock === 0 ? 'bg-rose-50 text-rose-700' : row.stock <= row.threshold ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{row.stock === 0 ? 'Out of stock' : row.stock <= row.threshold ? 'Low stock' : 'Healthy'}</span></td>              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Link
                    to={`/products/${row.product.id}/edit`}
                    title="Edit product"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                  <button
                    onClick={() => openHistory(row.product, row.variant)}
                    title="View movement history"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    History
                  </button>
                  <button
                    onClick={() => openAdjustment(row.product, row.variant)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50/50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                  >
                    <History className="h-3.5 w-3.5" />
                    Adjust
                  </button>
                </div>
              </td>
            </tr>)}</tbody></table>{rows.length === 0 && <div className="p-12 text-center text-sm text-slate-500">No inventory items match these filters.</div>}</div>}
    </div>
    {target && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setTarget(null); }}><form onSubmit={adjust} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"><h3 className="text-lg font-black">Adjust stock</h3><p className="mt-1 text-sm text-slate-500">{target.product.name}{target.variant ? ` · ${variationLabel(target.variant)}` : ''}</p><div className="mt-5 space-y-4"><label className="block text-xs font-bold">Movement type<select value={type} onChange={(e) => setType(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"><option value="MANUAL_ADJUSTMENT">Manual adjustment</option><option value="PURCHASE_IN">Purchase received</option><option value="RETURN_RESTOCK">Customer return</option><option value="DAMAGE_LOSS">Damage / loss</option></select></label><label className="block text-xs font-bold">Quantity change<input type="number" required value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"/><span className="mt-1 block text-[11px] font-normal text-slate-400">Use a positive number to add stock, negative to remove.</span></label><label className="block text-xs font-bold">Reason / reference<textarea required value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5 h-24 w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950" placeholder="PO number, cycle count, damage reason…"/></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setTarget(null)} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold dark:border-slate-700">Cancel</button><button disabled={saving} className="h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-4 text-sm font-bold disabled:opacity-60 transition">{saving ? 'Saving…' : 'Save adjustment'}</button></div></form></div>}

    {/* Stock Movement History Modal */}
    {historyTarget && (
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setHistoryTarget(null);
        }}
      >
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4 max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Stock Movement History</h3>
              <p className="text-xs text-slate-500">
                {historyTarget.product.name}
                {historyTarget.variant ? ` · ${variationLabel(historyTarget.variant)}` : ''}
              </p>
            </div>
            <button
              onClick={() => setHistoryTarget(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {historyLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading movements...</div>
            ) : historyList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No stock movements recorded yet.</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {historyList.map((m: any) => (
                  <div key={m.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            m.quantityChange > 0
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                          }`}
                        >
                          {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {m.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Balance after: <span className="font-bold">{m.balanceAfter}</span>
                        {m.note ? ` · ${m.note}` : ''}
                        {m.creator?.name ? ` · by ${m.creator.name}` : ''}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => setHistoryTarget(null)}
              className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
};
