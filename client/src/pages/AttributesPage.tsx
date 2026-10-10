import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, ListPlus, Pencil, Plus, Search, Tags, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { AttributeTermsEditor } from '../components/AttributeTermsEditor';

type Attribute = { id: string; name: string; slug: string; type: string; displayStyle: string; optionColors: Record<string, string>; options: string[]; orderedOptions: string[]; orderBy: string; productCount: number };
const empty = { type: 'TEXT', name: '', slug: '', options: [] as string[], optionColors: {} as Record<string, string>, displayStyle: 'SOFT', orderBy: 'MENU_ORDER' };
const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const AttributesPage = () => {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<Attribute | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/inventory/attributes'); setAttributes(data.attributes || []); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not load product attributes'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const reset = () => { setEditing(null); setForm(empty); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const options = [...new Set(form.options.map((option) => option.trim()).filter(Boolean))];
    if (!options.length) { toast.error('Add at least one individual option'); return; }
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), slug: form.slug.trim() || slugify(form.name), options, optionColors: Object.fromEntries(Object.entries(form.optionColors).filter(([term]) => options.includes(term))), type: form.type === 'SIZE_NUMBER' ? 'SIZE_NUMBER' : form.type };
      if (editing) await api.put(`/inventory/attributes/${editing.id}`, payload);
      else await api.post('/inventory/attributes', payload);
      toast.success(editing ? 'Attribute updated' : 'Attribute created');
      reset();
      await load();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not save attribute'); }
    finally { setSaving(false); }
  };
  const edit = (attribute: Attribute) => {
    setEditing(attribute);
    setForm({ type: attribute.type || 'TEXT', name: attribute.name, slug: attribute.slug, options: attribute.options, optionColors: attribute.optionColors || {}, displayStyle: attribute.displayStyle || 'SOFT', orderBy: attribute.orderBy || 'MENU_ORDER' });
  };
  const remove = async (attribute: Attribute) => {
    if (!window.confirm(`Delete the reusable “${attribute.name}” attribute? Products already using it retain their saved options.`)) return;
    try { await api.delete(`/inventory/attributes/${attribute.id}`); toast.success('Attribute deleted'); await load(); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not delete attribute'); }
  };
  const visible = useMemo(() => attributes.filter((attribute) => `${attribute.name} ${attribute.slug} ${attribute.options.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [attributes, query]);

  return <div className="space-y-5 pb-8">
    <header className="flex flex-col justify-between gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center dark:border-slate-800"><div><div className="flex items-center gap-2"><Tags className="h-5 w-5 text-emerald-600 dark:text-emerald-400"/><h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Product attributes</h1></div><p className="mt-1 text-xs text-slate-500">Manage reusable option sets like Color, Size and Fabric. Add them to products and generate variations from their terms.</p></div><span className="w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{attributes.length} attributes</span></header>
    <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={submit} className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{editing ? 'Edit attribute' : 'Add new attribute'}</h2><p className="mt-0.5 text-xs text-slate-500">Terms become selectable product options.</p></div>{editing && <button type="button" onClick={reset} aria-label="Cancel editing" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4"/></button>}</div>
        <div className="space-y-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Attribute type<select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value, name: current.name || ({ COLOR: 'Color', SIZE_TEXT: 'Size', SIZE_NUMBER: 'Size' } as Record<string,string>)[event.target.value] || '' }))} className="field"><option value="TEXT">Text</option><option value="COLOR">Color swatches</option><option value="SIZE_TEXT">Size · text (XS, S, M…)</option><option value="SIZE_NUMBER">Size · number (38, 40…)</option><option value="NUMBER">Number</option></select><span className="mt-1 block font-normal text-slate-400">Choose the type first; storefront controls adapt to it.</span></label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Name<input required maxLength={80} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, slug: editing ? current.slug : slugify(event.target.value) }))} className="field" placeholder="e.g. Color"/></label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Storefront option shape<select value={form.displayStyle} onChange={(event) => setForm((current) => ({ ...current, displayStyle: event.target.value }))} className="field"><option value="SOFT">Soft rounded</option><option value="CIRCLE">Circle</option><option value="SQUARE">Square</option></select></label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Slug<input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} className="field" placeholder="color"/></label>
          <div><div className="mb-2 flex items-end justify-between gap-2"><label className="text-xs font-medium text-slate-600 dark:text-slate-300">{form.type === 'COLOR' ? 'Color names & swatches' : form.type.startsWith('SIZE') ? 'Size options / terms' : 'Options / terms'} <span className="font-normal text-slate-400">({form.options.length})</span></label><span className="text-[10px] text-slate-400">Add one option at a time</span></div><AttributeTermsEditor options={form.options} onChange={(options) => setForm((current) => ({ ...current, options, optionColors: Object.fromEntries(Object.entries(current.optionColors).filter(([term]) => options.includes(term))) }))} allowReorder={form.orderBy === 'MENU_ORDER'} placeholder={form.type === 'COLOR' ? 'e.g. Navy' : form.type === 'SIZE_NUMBER' ? 'e.g. 38' : 'e.g. Medium'}/>{form.type === 'COLOR' && <div className="mt-3 space-y-2">{form.options.map((term) => <label key={term} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700"><input type="color" value={form.optionColors[term] || '#171815'} onChange={(event) => setForm((current) => ({ ...current, optionColors: { ...current.optionColors, [term]: event.target.value } }))} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"/><span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: form.optionColors[term] || '#171815' }}/><span className="font-medium text-slate-800 dark:text-slate-200">{term}</span></label>)}</div>}</div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Default sort order<select value={form.orderBy} onChange={(event) => setForm((current) => ({ ...current, orderBy: event.target.value }))} className="field"><option value="MENU_ORDER">Custom ordering</option><option value="NAME">Name</option><option value="NAME_NUM">Name (numeric)</option><option value="ID">Original term order</option></select><span className="mt-1 block font-normal text-slate-400">{form.orderBy === 'MENU_ORDER' ? 'Drag terms or use the arrows to set their order.' : 'Terms will be sorted automatically; the custom order is preserved.'}</span></label>
          <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-950 shadow-sm transition hover:bg-slate-800">{editing ? <Check className="h-4 w-4"/> : <Plus className="h-4 w-4"/>}{saving ? 'Saving…' : editing ? 'Update attribute' : 'Save attribute'}</button>
        </div>
      </form>
      <section className="overflow-hidden rounded-2xl border border-slate-100/90 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"><div className="flex items-center gap-2"><ListPlus className="h-4 w-4 text-slate-400"/><span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Reusable attributes</span></div><label className="relative block sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search attributes or terms…" className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"/></label></div>
        {loading ? <div className="p-12 text-center text-xs text-slate-500">Loading attributes…</div> : visible.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{visible.map((attribute) => <article key={attribute.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">{attribute.name}</h3><code className="text-xs text-slate-400">/{attribute.slug}</code><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800">{attribute.type || 'TEXT'}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800">{attribute.productCount} products</span></div><div className="mt-2 flex flex-wrap gap-1.5">{(attribute.orderedOptions || attribute.options).map((option, index) => <span key={`${index}-${option}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">{attribute.type === 'COLOR' && <i className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: attribute.optionColors?.[option] || option.toLowerCase() }}/>}{option}</span>)}</div></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => edit(attribute)} aria-label={`Edit ${attribute.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400 transition"><Pencil className="h-4 w-4"/></button><button type="button" onClick={() => remove(attribute)} aria-label={`Delete ${attribute.name}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"><Trash2 className="h-4 w-4"/></button></div></article>)}</div> : <div className="p-12 text-center"><Tags className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-3 font-semibold text-slate-800 dark:text-slate-200">{query ? 'No matching attributes' : 'No attributes yet'}</p><p className="mt-1 text-xs text-slate-500">Create a reusable attribute and its terms to use across products.</p></div>}
      </section>
    </div>
  </div>;
};
