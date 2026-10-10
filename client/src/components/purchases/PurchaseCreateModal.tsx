import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import type { Product, ProductVariant, Supplier } from '../../types';

type Account = { id: string; name: string; balance: number };
type Warehouse = { id: string; name: string };
type Line = { productId: string; variantId?: string; name: string; sku: string; quantity: number; unitCost: number };

const input = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950';
const label = 'mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300';
const amount = (value: number) => `৳${value.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;

export const PurchaseCreateModal: React.FC<{ suppliers: Supplier[]; accounts: Account[]; warehouses: Warehouse[]; onClose: () => void; onCreated: () => void }> = ({ suppliers, accounts, warehouses, onClose, onCreated }) => {
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidAmount, setPaidAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setCatalogLoading(true);
      try {
        const res = await api.get('/inventory/products', { params: { search: search.trim(), limit: 30 } });
        setCatalog(res.data.products || []);
      } catch { setCatalog([]); }
      finally { setCatalogLoading(false); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0), [lines]);
  const total = Math.max(0, subtotal + tax - discount);
  const addLine = (product: Product, variant?: ProductVariant) => {
    const key = `${product.id}:${variant?.id || ''}`;
    if (lines.some((line) => `${line.productId}:${line.variantId || ''}` === key)) { toast.error('This item is already on the invoice'); return; }
    setLines((current) => [...current, {
      productId: product.id, variantId: variant?.id,
      name: variant ? `${product.name} · ${variant.name}` : product.name,
      sku: variant?.sku || product.sku, quantity: 1, unitCost: variant?.buyPrice ?? product.buyPrice ?? 0,
    }]);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supplierId || !lines.length) { toast.error('Choose a supplier and at least one product'); return; }
    if (paidAmount > 0 && !accountId) { toast.error('Choose a payment account'); return; }
    setSaving(true);
    try {
      const res = await api.post('/purchases/orders', {
        supplierId, warehouseId: warehouseId || undefined, accountId: accountId || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined, purchaseDate, paidAmount, discount, tax, note,
        items: lines.map(({ productId, variantId, quantity, unitCost }) => ({ productId, variantId, quantity, unitCost })),
      });
      toast.success(res.data.message || 'Purchase recorded');
      onCreated();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not create purchase'); }
    finally { setSaving(false); }
  };

  return createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Create purchase" className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><div><h2 className="text-lg font-black">New purchase</h2><p className="text-xs text-slate-500">Choose catalogue products and their exact variations.</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5"/></button></div>
      <form onSubmit={submit} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className={label}>Supplier *</label><select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={input}><option value="">Choose supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
          <div><label className={label}>Purchase date</label><input type="date" required value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} className={input}/></div>
          <div><label className={label}>Invoice number</label><input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Auto-generated if blank" className={input}/></div>
          <div><label className={label}>Warehouse</label><select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className={input}><option value="">Default / unassigned</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <label className={label}>Add products</label>
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product name, SKU, barcode, colour or size" className={`${input} pl-9`}/></div>
          <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
            {catalogLoading ? <p className="p-3 text-xs text-slate-500">Searching catalogue…</p> : catalog.length ? catalog.map((product) => {
              const variants = (product.variants || []).filter((variant) => variant.status !== 'ARCHIVED');
              return <div key={product.id} className="border-b border-slate-100 p-2 last:border-0 dark:border-slate-800"><p className="px-1 text-xs font-bold">{product.name} <span className="font-normal text-slate-500">{product.sku}</span></p><div className="mt-1 flex flex-wrap gap-1">{product.productType === 'VARIABLE' ? variants.map((variant) => <button type="button" key={variant.id} onClick={() => addLine(product, variant)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700"><Plus className="h-3 w-3"/>{variant.name} · {variant.sku}</button>) : <button type="button" onClick={() => addLine(product)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700"><Plus className="h-3 w-3"/> Add product</button>}{product.productType === 'VARIABLE' && !variants.length && <span className="px-1 text-xs text-amber-600">No available variations</span>}</div></div>;
            }) : <p className="p-3 text-xs text-slate-500">No matching products. Try a name or SKU.</p>}
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-slate-50 text-slate-500 dark:bg-slate-950"><tr><th className="p-3">Product / variation</th><th className="p-3">Qty</th><th className="p-3">Unit cost</th><th className="p-3 text-right">Line total</th><th className="p-3"/></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{lines.map((line, index) => <tr key={`${line.productId}:${line.variantId || ''}`}><td className="p-3"><b>{line.name}</b><div className="text-slate-500">{line.sku}</div></td><td className="p-3"><input aria-label={`Quantity for ${line.name}`} type="number" min="1" step="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item))} className={`${input} w-20`}/></td><td className="p-3"><input aria-label={`Unit cost for ${line.name}`} type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, unitCost: Number(event.target.value) } : item))} className={`${input} w-28`}/></td><td className="p-3 text-right font-bold">{amount(line.quantity * line.unitCost)}</td><td className="p-3"><button type="button" aria-label={`Remove ${line.name}`} onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></button></td></tr>)}{!lines.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">Select a product above to start the invoice.</td></tr>}</tbody></table></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><label className={label}>Discount</label><input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} className={input}/></div><div><label className={label}>Tax</label><input type="number" min="0" step="0.01" value={tax} onChange={(event) => setTax(Number(event.target.value))} className={input}/></div><div><label className={label}>Paid amount</label><input type="number" min="0" max={total} step="0.01" value={paidAmount} onChange={(event) => setPaidAmount(Number(event.target.value))} className={input}/></div><div><label className={label}>Payment account {paidAmount > 0 && '*'}</label><select required={paidAmount > 0} value={accountId} onChange={(event) => setAccountId(event.target.value)} className={input}><option value="">Unpaid</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({amount(account.balance)})</option>)}</select></div></div>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]"><div><label className={label}>Internal note</label><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className={`${input} h-auto py-2`}/></div><div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950"><div className="flex justify-between gap-8 text-slate-500"><span>Subtotal</span><span>{amount(subtotal)}</span></div><div className="mt-1 flex justify-between gap-8 font-black"><span>Total</span><span>{amount(total)}</span></div><div className="mt-1 flex justify-between gap-8 text-rose-600"><span>Due</span><span>{amount(Math.max(0, total - paidAmount))}</span></div></div></div>
      </form>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800"><button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700">Cancel</button><button type="button" onClick={(event) => { const form = event.currentTarget.closest('section')?.querySelector('form'); form?.requestSubmit(); }} disabled={saving || !lines.length} className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-5 py-2 text-sm font-bold transition-colors disabled:opacity-50">{saving ? 'Saving…' : 'Record purchase & restock'}</button></div>
    </section>
  </div>, document.body);
};
