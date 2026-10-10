import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, HardDrive, ImagePlus, Images, Loader2, Pencil, Search, Trash2, UploadCloud, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import type { MediaAsset } from '../components/MediaPicker';

const humanSize = (size = 0) => size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`;

export const MediaGalleryPage = () => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'name' | 'size'>('recent');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [altText, setAltText] = useState('');
  const [savingAlt, setSavingAlt] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const load = () => api.get('/media').then((res) => setAssets(res.data.assets || [])).catch(() => toast.error('Could not load media library')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    if (files.some((file) => !file.type.startsWith('image/'))) { toast.error('Only image files are supported'); return; }
    if (files.some((file) => file.size > 8 * 1024 * 1024)) { toast.error('Every image must be 8 MB or smaller'); return; }
    setUploading(true);
    const uploaded: MediaAsset[] = [];
    try {
      for (const file of files) {
        const data = new FormData();
        data.append('file', file);
        const response = await api.post('/media/upload', data, { headers: { 'Content-Type': 'multipart/form-data' } });
        uploaded.push(response.data.asset);
      }
      setAssets((current) => [...uploaded, ...current]);
      toast.success(`${uploaded.length} image${uploaded.length === 1 ? '' : 's'} added to Media Gallery`);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Upload failed'); }
    finally { setUploading(false); }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    await uploadFiles(Array.from(event.target.files || []));
    event.target.value = '';
  };
  const drop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (!uploading) await uploadFiles(Array.from(event.dataTransfer.files));
  };

  const copy = async (url: string) => { await navigator.clipboard.writeText(url); toast.success('Image URL copied'); };
  const remove = async (asset: MediaAsset) => {
    if (!window.confirm(`Delete ${asset.fileName}? This cannot be undone.`)) return;
    try {
      await api.delete(`/media/${asset.id}`);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      if (selected?.id === asset.id) setSelected(null);
      toast.success('Image deleted');
    } catch { toast.error('Could not delete image'); }
  };
  const openDetails = (asset: MediaAsset) => { setSelected(asset); setAltText(asset.altText || ''); };
  const saveAltText = async () => {
    if (!selected) return;
    setSavingAlt(true);
    try {
      const response = await api.patch(`/media/${selected.id}`, { altText });
      setAssets((current) => current.map((asset) => asset.id === selected.id ? response.data.asset : asset));
      setSelected(response.data.asset);
      toast.success('Image details updated');
    } catch { toast.error('Could not update image details'); }
    finally { setSavingAlt(false); }
  };

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return assets.filter((asset) => `${asset.fileName} ${asset.altText || ''}`.toLowerCase().includes(normalized)).sort((a, b) => {
      if (sort === 'name') return a.fileName.localeCompare(b.fileName);
      if (sort === 'size') return (b.size || 0) - (a.size || 0);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [assets, query, sort]);
  const totalSize = assets.reduce((sum, asset) => sum + (asset.size || 0), 0);

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1"><h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Media Gallery</h1><p className="text-sm text-slate-500">Product, category and storefront images in one library.</p></div>
      <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-60 dark:bg-[#d8ff55] dark:text-slate-950">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{uploading ? 'Uploading…' : 'Upload images'}</button>
      <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={upload} />
    </div>

    <section className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900"><span className="inline-flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300"><Images className="h-3.5 w-3.5 text-emerald-500" />{assets.length} assets</span><span className="inline-flex items-center gap-1.5 text-slate-500"><HardDrive className="h-3.5 w-3.5" />{humanSize(totalSize)} used</span><span className="inline-flex items-center gap-1.5 text-slate-500"><Check className="h-3.5 w-3.5 text-emerald-500" />Connected to all image pickers</span></section>

    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row dark:border-slate-800 dark:bg-slate-900">
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-950"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filename or alt text…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"><option value="recent">Newest first</option><option value="name">Name A–Z</option><option value="size">Largest first</option></select>
    </div>

    <div onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragActive(false); }} onDrop={drop} className={`relative rounded-xl transition ${dragActive ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-950' : ''}`}>
      {dragActive && <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-xl border-2 border-dashed border-emerald-500 bg-emerald-50/90 text-sm font-bold text-emerald-700 dark:bg-emerald-950/90 dark:text-emerald-200"><span className="inline-flex items-center gap-2"><UploadCloud className="h-5 w-5"/>Drop images to upload</span></div>}
      {loading ? <div className="flex min-h-64 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading media…</div> : visible.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
        {visible.map((asset) => <article className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" key={asset.id}>
          <button type="button" onClick={() => openDetails(asset)} className="relative block w-full overflow-hidden bg-slate-100 text-left dark:bg-slate-800"><img src={asset.url} alt={asset.altText || asset.fileName} className="aspect-square w-full object-cover transition duration-200 group-hover:scale-[1.03]" /><span className="absolute inset-x-0 bottom-0 truncate bg-slate-950/75 px-2 py-1.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">{asset.fileName}</span></button>
          <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100"><button onClick={() => copy(asset.url)} className="rounded bg-white/95 p-1.5 text-slate-700 shadow-sm"><Copy className="h-3 w-3" /></button><button onClick={() => remove(asset)} className="rounded bg-white/95 p-1.5 text-rose-600 shadow-sm" aria-label={`Delete ${asset.fileName}`}><Trash2 className="h-3 w-3" /></button></div>
        </article>)}
      </div> : <div className="rounded-xl border-2 border-dashed border-slate-200 p-16 text-center dark:border-slate-800"><Images className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-bold text-slate-700 dark:text-slate-200">{query ? 'No matching images' : 'Media Gallery is empty'}</p><p className="mt-1 text-sm text-slate-400">{query ? 'Try another filename or alt text.' : 'Drag images here or use Upload images.'}</p></div>}
    </div>

    {selected && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="w-full max-w-3xl overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-[#101a2c]"><header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><div><h2 className="font-extrabold text-slate-950 dark:text-white">Image details</h2><p className="text-xs text-slate-400">Improve accessibility and searchability</p></div><button type="button" onClick={() => setSelected(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></header><div className="grid gap-5 p-5 md:grid-cols-[280px_1fr]"><img src={selected.url} alt={selected.altText || selected.fileName} className="aspect-square w-full rounded-xl bg-slate-100 object-contain dark:bg-slate-950" /><div className="space-y-4"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Filename</p><p className="mt-1 break-all text-sm font-semibold dark:text-white">{selected.fileName}</p></div><div className="grid grid-cols-2 gap-3"><div><p className="text-xs font-bold text-slate-400">Type</p><p className="mt-1 text-sm dark:text-white">{selected.mimeType?.replace('image/', '').toUpperCase() || 'IMAGE'}</p></div><div><p className="text-xs font-bold text-slate-400">Size</p><p className="mt-1 text-sm dark:text-white">{humanSize(selected.size)}</p></div></div><label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Alt text<textarea value={altText} onChange={(event) => setAltText(event.target.value)} rows={3} placeholder="Describe this image for accessibility and search" className="field resize-none" /></label><p className="text-[11px] leading-5 text-slate-400">Describe the subject and context. Avoid phrases like “image of”.</p><div className="flex gap-2"><button type="button" onClick={saveAltText} disabled={savingAlt} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60 dark:bg-[#d8ff55] dark:text-slate-950">{savingAlt && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save details</button><button type="button" onClick={() => copy(selected.url)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Copy URL</button></div></div></div></section></div>}
  </div>;
};
