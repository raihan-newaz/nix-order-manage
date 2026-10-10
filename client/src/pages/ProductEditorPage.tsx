import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Image as ImageIcon, Plus, Save, Search, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { MediaPicker } from '../components/MediaPicker';
import { AttributeTermsEditor } from '../components/AttributeTermsEditor';
import type { Product, ProductVariant } from '../types';

type ProductAttribute = { attributeId?: string; name: string; type?: string; displayStyle?: string; optionColors?: Record<string,string>; options: string[]; visible: boolean; variation: boolean };
type GlobalAttribute = { id: string; name: string; slug: string; type?: string; displayStyle?: string; optionColors?: Record<string,string>; options: string[]; orderedOptions?: string[]; orderBy: string };
type VariantDraft = Omit<Partial<ProductVariant>, 'attributes'> & { attributes?: Record<string, string>; clientId: string };
const emptyForm = { name: '', slug: '', sku: '', barcode: '', category: 'Fashion', description: '', status: 'DRAFT', productType: 'SIMPLE', buyPrice: 0, regularPrice: 0, salePrice: 0, stockQuantity: 0, minStockThreshold: 5, image: '', gallery: [] as string[], metaTitle: '', metaDescription: '' };
const inputClass = 'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950';
const labelClass = 'text-xs font-normal text-slate-600 dark:text-slate-300';

const parseJson = (value: unknown, fallback: any) => {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};
const normalizeAttributes = (value: unknown): ProductAttribute[] => {
  const parsed = parseJson(value, []);
  if (Array.isArray(parsed)) return parsed.map((item: any) => {
    const rawOptions = item.options ?? item.values ?? [];
    const options = Array.isArray(rawOptions) ? rawOptions.map(String) : String(rawOptions).split(/[|,]/).map((option) => option.trim()).filter(Boolean);
    return { attributeId: item.attributeId || item.id, name: String(item.name || '').trim(), type: item.type || 'TEXT', displayStyle: item.displayStyle || 'SOFT', optionColors: item.optionColors || {}, options, visible: item.visible !== false, variation: item.variation !== false };
  }).filter((item) => item.name);
  if (parsed && typeof parsed === 'object') return Object.entries(parsed).map(([name, options]) => ({ name, options: Array.isArray(options) ? options.map(String) : String(options).split(',').map((option) => option.trim()).filter(Boolean), visible: true, variation: true }));
  return [];
};
const normalizeVariantAttributes = (variant: ProductVariant): Record<string, string> => {
  const parsed = parseJson(variant.attributes, {});
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, string>;
  return { ...(variant.color ? { Color: variant.color } : {}), ...(variant.size ? { Size: variant.size } : {}) };
};

export const ProductEditorPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState(emptyForm);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [productAttributes, setProductAttributes] = useState<ProductAttribute[]>([]);
  const [globalAttributes, setGlobalAttributes] = useState<GlobalAttribute[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof emptyForm, value: any) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    api.get('/inventory/categories').then(({ data }) => setCategories(data.categories || [])).catch(() => undefined);
    api.get('/inventory/attributes').then(({ data }) => setGlobalAttributes(data.attributes || [])).catch(() => undefined);
    if (!id) return;
    api.get(`/inventory/products/${id}`).then(({ data }) => {
      const p: Product = data.product;
      let gallery: string[] = [];
      try { gallery = p.gallery ? JSON.parse(p.gallery) : []; } catch { gallery = []; }
      setForm({ name: p.name, slug: p.slug || '', sku: p.sku, barcode: p.barcode || '', category: p.category || '', description: p.description || '', status: p.status, productType: p.productType || 'SIMPLE', buyPrice: p.buyPrice, regularPrice: p.regularPrice, salePrice: p.salePrice, stockQuantity: p.stockQuantity, minStockThreshold: p.minStockThreshold, image: p.image || '', gallery, metaTitle: p.metaTitle || '', metaDescription: p.metaDescription || '' });
      const savedAttributes = normalizeAttributes(p.attributes);
      const savedVariants = (p.variants || []).filter(v => v.status !== 'ARCHIVED').map(v => ({ ...v, attributes: normalizeVariantAttributes(v), clientId: v.id }));
      const inferredAttributes = [...new Set(savedVariants.flatMap((variant) => Object.keys(variant.attributes || {})))].map((name) => ({ name, options: [...new Set(savedVariants.map((variant) => variant.attributes?.[name]).filter(Boolean) as string[])], visible: true, variation: true }));
      setProductAttributes(savedAttributes.length ? savedAttributes : inferredAttributes);
      setVariants(savedVariants);
    }).catch((error) => { toast.error(error.response?.data?.message || 'Product not found'); navigate('/products'); }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!globalAttributes.length) return;
    setProductAttributes((current) => {
      let changed = false;
      const next = current.map((attribute) => {
        if (!attribute.name) return attribute;
        const saved = globalAttributes.find((item) => item.id === attribute.attributeId) || globalAttributes.find((item) => item.name.toLowerCase() === attribute.name.toLowerCase());
        if (!saved) return attribute;
        const available = saved.orderedOptions || saved.options;
        const selected = new Set(attribute.options);
        const options = [...available.filter((option) => selected.has(option)), ...attribute.options.filter((option) => !available.includes(option))];
        if (attribute.attributeId === saved.id && attribute.name === saved.name && attribute.type === saved.type && JSON.stringify(attribute.optionColors || {}) === JSON.stringify(saved.optionColors || {}) && options.every((option, index) => option === attribute.options[index])) return attribute;
        changed = true;
        return { ...attribute, attributeId: saved.id, name: saved.name, type: saved.type || 'TEXT', displayStyle: saved.displayStyle || 'SOFT', optionColors: saved.optionColors || {}, options };
      });
      return changed ? next : current;
    });
  }, [globalAttributes, productAttributes]);

  const margin = useMemo(() => form.salePrice ? Math.round(((form.salePrice - form.buyPrice) / form.salePrice) * 100) : 0, [form.salePrice, form.buyPrice]);
  const addVariant = () => setVariants((current) => [...current, { clientId: crypto.randomUUID(), name: '', sku: '', color: '', size: '', barcode: '', buyPrice: form.buyPrice, regularPrice: form.regularPrice, salePrice: form.salePrice, stockQuantity: 0, minStockThreshold: 3, image: '', status: 'ACTIVE' }]);
  const updateVariant = (clientId: string, key: keyof VariantDraft, value: any) => setVariants((current) => current.map((v) => v.clientId === clientId ? { ...v, [key]: value } : v));
  const addAttribute = () => setProductAttributes((current) => [...current, { name: '', options: [], visible: true, variation: true }]);
  const addGlobalAttribute = (id: string) => {
    const selected = globalAttributes.find((attribute) => attribute.id === id);
    if (!selected) return;
    setProductAttributes((current) => current.some((attribute) => attribute.attributeId === id || attribute.name.toLowerCase() === selected.name.toLowerCase())
      ? current
      : [...current, { attributeId: selected.id, name: selected.name, type: selected.type || 'TEXT', displayStyle: selected.displayStyle || 'SOFT', optionColors: selected.optionColors || {}, options: selected.orderedOptions || selected.options, visible: true, variation: true }]);
  };
  const updateAttribute = (index: number, patch: Partial<ProductAttribute>) => setProductAttributes((current) => current.map((attribute, i) => i === index ? { ...attribute, ...patch } : attribute));
  const generateVariations = () => {
    const variationAttributes = productAttributes.filter((attribute) => attribute.variation && attribute.name.trim() && attribute.options.length);
    if (!variationAttributes.length) { toast.error('Add at least one attribute and enable “Used for variations”'); return; }
    const combinationCount = variationAttributes.reduce((count, attribute) => count * attribute.options.length, 1);
    if (combinationCount > 200) { toast.error('A product can have at most 200 variations at once'); return; }
    const combinations = variationAttributes.reduce<Record<string, string>[]>((rows, attribute) => rows.flatMap((row) => attribute.options.map((option) => ({ ...row, [attribute.name]: option }))), [{}]);
    setVariants((current) => {
      const combinationKey = (attributes: Record<string, string> = {}) => JSON.stringify(variationAttributes.map((attribute) => [attribute.name, attributes[attribute.name] || '']));
      const existing = new Map(current.map((variant) => [combinationKey(variant.attributes), variant]));
      return combinations.map((attributes) => {
        const matched = existing.get(combinationKey(attributes));
        return matched ? { ...matched, attributes: { ...matched.attributes, ...attributes } } : { clientId: crypto.randomUUID(), name: '', sku: '', attributes, buyPrice: form.buyPrice, regularPrice: form.regularPrice, salePrice: form.salePrice, stockQuantity: 0, minStockThreshold: 3, image: '', status: 'ACTIVE' };
      });
    });
    setForm((current) => ({ ...current, productType: 'VARIABLE' }));
    toast.success(`${combinations.length} variation combinations generated`);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    if (Number(form.salePrice) > Number(form.regularPrice) && form.regularPrice > 0) { toast.error('Sale price cannot be higher than regular price'); return; }
    if (form.productType === 'VARIABLE' && variants.length === 0) { toast.error('Add at least one variation'); return; }
    setSaving(true);
    const attributes = productAttributes.filter((attribute) => attribute.name.trim()).map((attribute) => ({ ...attribute, name: attribute.name.trim(), options: [...new Set(attribute.options.map((option) => option.trim()).filter(Boolean))] }));
    const payload = { ...form, slug: form.slug.trim() || undefined, sku: form.sku.trim() || undefined, barcode: form.barcode.trim() || undefined, gallery: form.gallery, attributes, variants: form.productType === 'VARIABLE' ? variants.map(({ clientId, ...variant }) => variant) : [] };
    try {
      const { data } = editing ? await api.put(`/inventory/products/${id}`, payload) : await api.post('/inventory/products', payload);
      toast.success(editing ? 'Product updated' : 'Product created');
      navigate(`/products/${data.product.id}/edit`, { replace: true });
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not save product'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-24 text-center text-sm text-slate-500">Loading product…</div>;
  return <form onSubmit={save} className="mx-auto max-w-7xl space-y-6 pb-12">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><Link to="/products" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><ArrowLeft className="h-4 w-4"/></Link><div><p className="text-xs font-normal uppercase tracking-[.18em] text-emerald-600 dark:text-emerald-400">{editing ? 'Edit catalogue item' : 'New catalogue item'}</p><h2 className="text-2xl font-normal text-slate-950 dark:text-white">{editing ? form.name : 'Create product'}</h2></div></div><div className="flex gap-2"><Link to="/products" className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-normal dark:border-slate-700">Cancel</Link><button disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-5 text-sm font-normal shadow transition disabled:opacity-60"><Save className="h-4 w-4"/>{saving ? 'Saving…' : 'Save product'}</button></div></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><h3 className="font-normal">Product information</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><label className={`${labelClass} md:col-span-2`}>Product name *<input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Oversized cotton shirt"/></label><label className={labelClass}>SKU<input className={inputClass} value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Auto-generated if blank"/></label><label className={labelClass}>Barcode<input className={inputClass} value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="Auto-generated if blank"/></label><label className={labelClass}>Category<input list="product-categories" className={inputClass} value={form.category} onChange={(e) => set('category', e.target.value)}/><datalist id="product-categories">{categories.map(c => <option key={c.id} value={c.name}/>)}</datalist></label><label className={labelClass}>Product type<select className={inputClass} value={form.productType} onChange={(e) => set('productType', e.target.value)}><option value="SIMPLE">Simple product</option><option value="VARIABLE">Variable product</option></select></label><label className={`${labelClass} md:col-span-2`}>Description<textarea className={`${inputClass} h-36 py-3`} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Materials, fit, care instructions and product details…"/></label></div></section>
        <section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400"/><h3 className="font-normal">Media</h3></div><div className="mt-4 grid gap-5 md:grid-cols-2"><MediaPicker title="Primary product image" value={form.image ? [form.image] : []} onChange={(urls) => set('image', urls[0] || '')}/><MediaPicker title="Product gallery" multiple maxSelection={12} value={form.gallery} onChange={(urls) => set('gallery', urls)}/></div></section>
        <section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><h3 className="font-normal">Pricing & inventory</h3><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className={labelClass}>Cost price<input type="number" min="0" step="0.01" className={inputClass} value={form.buyPrice} onChange={(e) => set('buyPrice', Number(e.target.value))}/></label><label className={labelClass}>Regular price<input type="number" min="0" step="0.01" className={inputClass} value={form.regularPrice} onChange={(e) => set('regularPrice', Number(e.target.value))}/></label><label className={labelClass}>Sale price<input type="number" min="0" step="0.01" className={inputClass} value={form.salePrice} onChange={(e) => set('salePrice', Number(e.target.value))}/></label>{form.productType === 'SIMPLE' && <label className={labelClass}>Stock quantity<input type="number" min="0" className={inputClass} value={form.stockQuantity} onChange={(e) => set('stockQuantity', Number(e.target.value))}/></label>}<label className={labelClass}>Low-stock threshold<input type="number" min="0" className={inputClass} value={form.minStockThreshold} onChange={(e) => set('minStockThreshold', Number(e.target.value))}/></label><div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10"><p className="text-xs font-normal text-emerald-700 dark:text-emerald-300">Estimated margin</p><p className="mt-1 text-xl font-normal text-emerald-800 dark:text-emerald-200">{margin}%</p></div></div></section>
        <section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="font-normal">Attributes</h3><p className="text-xs text-slate-500">Create options like Color, Size or Fabric. Mark attributes used for variations to generate every combination.</p></div><div className="flex flex-wrap gap-2">{globalAttributes.length > 0 && <select aria-label="Add saved attribute" defaultValue="" onChange={(event) => { addGlobalAttribute(event.target.value); event.currentTarget.value = ''; }} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"><option value="">Add saved attribute…</option>{globalAttributes.map((attribute) => <option key={attribute.id} value={attribute.id}>{attribute.name} ({attribute.options.length})</option>)}</select>}<button type="button" onClick={addAttribute} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-normal text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Plus className="h-4 w-4"/>Add custom attribute</button><Link to="/attributes" className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-600 hover:border-emerald-300 dark:border-slate-700 dark:text-slate-300">Manage attributes</Link></div></div>
          <div className="mt-4 space-y-3">{productAttributes.map((attribute, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"><label className={labelClass}>Name<input className={inputClass} value={attribute.name} onChange={(event) => updateAttribute(index, { name: event.target.value })} placeholder="e.g. Color"/></label><label className="flex items-center gap-2 pt-5 text-xs font-normal text-slate-600 dark:text-slate-300"><input type="checkbox" checked={attribute.visible} onChange={(event) => updateAttribute(index, { visible: event.target.checked })}/>Visible</label><label className="flex items-center gap-2 pt-5 text-xs font-normal text-slate-600 dark:text-slate-300"><input type="checkbox" checked={attribute.variation} onChange={(event) => updateAttribute(index, { variation: event.target.checked })}/>Used for variations</label><button type="button" aria-label="Remove attribute" onClick={() => setProductAttributes((current) => current.filter((_, i) => i !== index))} className="mt-5 rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></button><div className="md:col-span-4"><p className={labelClass}>Options / terms <span className="font-normal text-slate-400">— add each term individually</span></p><div className="mt-2"><AttributeTermsEditor options={attribute.options} onChange={(options) => updateAttribute(index, { options, optionColors: Object.fromEntries(Object.entries(attribute.optionColors || {}).filter(([term]) => options.includes(term))) })} allowReorder={!attribute.attributeId} placeholder={`Add ${attribute.name || 'attribute'} option`}/></div>{attribute.type === 'COLOR' && <div className="mt-3 flex flex-wrap gap-2">{attribute.options.map((option) => <label key={option} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700"><input type="color" value={attribute.optionColors?.[option] || '#171815'} onChange={(event) => updateAttribute(index, { optionColors: { ...attribute.optionColors, [option]: event.target.value } })} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"/><span>{option}</span></label>)}</div>}</div></div>)}</div>
          {productAttributes.some((attribute) => attribute.variation && attribute.options.length) && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-500">Existing matching variations keep their stock, price, SKU and image.</p><button type="button" onClick={generateVariations} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-3 py-2 text-xs font-normal shadow transition"><Plus className="h-4 w-4"/>Generate variations</button></div>}
        </section>
        {form.productType === 'VARIABLE' && <section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><div><h3 className="font-normal">Variations ({variants.length})</h3><p className="text-xs text-slate-500">Each combination has its own SKU, image, price and stock.</p></div><button type="button" onClick={addVariant} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-normal text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Plus className="h-4 w-4"/>Add variation</button></div><div className="mt-4 space-y-3">{variants.map((v, index) => <div key={v.clientId} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="mb-3 flex items-center justify-between"><b className="text-sm font-normal">Variation {index + 1} · {Object.values(v.attributes || {}).join(' / ') || 'New option'}</b><button type="button" onClick={() => setVariants(current => current.filter(item => item.clientId !== v.clientId))} className="text-rose-500"><Trash2 className="h-4 w-4"/></button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{productAttributes.filter((attribute) => attribute.variation).map((attribute) => <label key={attribute.name} className={labelClass}>{attribute.name}<select className={inputClass} value={v.attributes?.[attribute.name] || ''} onChange={(event) => updateVariant(v.clientId, 'attributes', { ...v.attributes, [attribute.name]: event.target.value })}><option value="">Choose {attribute.name}</option>{attribute.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>)}<label className={labelClass}>SKU<input className={inputClass} value={v.sku || ''} onChange={(e) => updateVariant(v.clientId, 'sku', e.target.value)} placeholder="Auto if blank"/></label><label className={labelClass}>Stock<input type="number" min="0" className={inputClass} value={v.stockQuantity || 0} onChange={(e) => updateVariant(v.clientId, 'stockQuantity', Number(e.target.value))}/></label><label className={labelClass}>Regular price<input type="number" min="0" className={inputClass} value={v.regularPrice || 0} onChange={(e) => updateVariant(v.clientId, 'regularPrice', Number(e.target.value))}/></label><label className={labelClass}>Sale price<input type="number" min="0" className={inputClass} value={v.salePrice || 0} onChange={(e) => updateVariant(v.clientId, 'salePrice', Number(e.target.value))}/></label><label className={labelClass}>Cost<input type="number" min="0" step="0.01" className={inputClass} value={v.buyPrice || 0} onChange={(e) => updateVariant(v.clientId, 'buyPrice', Number(e.target.value))}/></label><label className={labelClass}>Status<select className={inputClass} value={v.status || 'ACTIVE'} onChange={(e) => updateVariant(v.clientId, 'status', e.target.value)}><option value="ACTIVE">Active</option><option value="OUT_OF_STOCK">Out of stock</option></select></label><div className="sm:col-span-2 lg:col-span-4"><MediaPicker compact title={`Variation ${index + 1} image`} value={v.image ? [v.image] : []} onChange={(urls) => updateVariant(v.clientId, 'image', urls[0] || '')}/></div></div></div>)}</div></section>}
        <section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2"><Search className="h-5 w-5 text-emerald-600 dark:text-emerald-400"/><h3 className="font-normal">Search engine listing</h3></div><div className="mt-4 space-y-4"><label className={labelClass}>Meta title<input maxLength={70} className={inputClass} value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} placeholder={form.name || 'Product title'}/><span className="mt-1 block text-right text-[10px] text-slate-400">{form.metaTitle.length}/70</span></label><label className={labelClass}>Meta description<textarea maxLength={160} className={`${inputClass} h-24 py-3`} value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} placeholder="A concise description for search results…"/><span className="mt-1 block text-right text-[10px] text-slate-400">{form.metaDescription.length}/160</span></label></div></section>
      </div>
      <aside className="space-y-5"><section className="rounded-2xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h3 className="font-normal">Product URL</h3><label className={`${labelClass} mt-4 block`}>URL slug<input className={inputClass} value={form.slug} maxLength={160} onChange={(event) => set('slug', event.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="e.g. dubai-cherry-borka"/><span className="mt-2 block break-all text-xs text-slate-500">/product/{form.slug || 'generated-on-save'}</span></label><p className="mt-2 text-xs text-slate-500">Use letters, numbers and hyphens. Each product needs a unique URL.</p></section><section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><h3 className="font-normal">Publishing</h3><label className={`${labelClass} mt-4 block`}>Storefront status<select className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value)}><option value="DRAFT">Draft — hidden</option><option value="ACTIVE">Active — visible</option><option value="OUT_OF_STOCK">Out of stock</option></select></label><p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-950">Only active products are shown to customers. Product media is selected directly from Media Gallery and stays reusable across the storefront.</p></section><section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"><h3 className="font-normal">Storefront preview</h3><div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">{form.image ? <img src={form.image} alt="" className="aspect-square w-full object-cover"/> : <div className="grid aspect-square place-items-center bg-slate-100 text-xs text-slate-400 dark:bg-slate-800">No cover image</div>}<div className="p-4"><p className="font-normal">{form.name || 'Untitled product'}</p><p className="mt-1 text-sm font-normal text-emerald-600 dark:text-emerald-400">৳{Number(form.salePrice || form.regularPrice).toLocaleString()}</p></div></div></section></aside>
    </div>
  </form>;
};
