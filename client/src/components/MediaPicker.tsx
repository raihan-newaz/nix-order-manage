import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, CloudUpload, Image as ImageIcon, Images, Loader2, Search, Trash2, Upload, X } from 'lucide-react';
import api from '../lib/api';

export type MediaAsset = {
  id: string;
  url: string;
  fileName: string;
  altText?: string | null;
  mimeType?: string;
  size?: number;
  createdAt?: string;
};

type MediaPickerProps = {
  value: string[];
  onChange: (urls: string[]) => void;
  multiple?: boolean;
  maxSelection?: number;
  compact?: boolean;
  title?: string;
};

const formatSize = (size = 0) =>
  size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.ceil(size / 1024))} KB`;

export function MediaPicker({ value, onChange, multiple = false, maxSelection, compact = false, title }: MediaPickerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const limit = multiple ? maxSelection ?? Number.POSITIVE_INFINITY : 1;

  useEffect(() => {
    if (!open) return;
    setSelected(value.filter(Boolean));
    setQuery('');
    setError('');
    setLoading(true);
    api.get('/media')
      .then((response) => setAssets(response.data.assets || []))
      .catch(() => setError('Could not load Media Gallery. Please try again.'))
      .finally(() => setLoading(false));
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return assets
      .filter((asset) => `${asset.fileName} ${asset.altText || ''}`.toLowerCase().includes(normalized))
      .sort((a, b) => sort === 'name'
        ? a.fileName.localeCompare(b.fileName)
        : new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [assets, query, sort]);

  const toggle = (url: string) => {
    setError('');
    setSelected((current) => {
      if (current.includes(url)) return current.filter((item) => item !== url);
      if (!multiple) return [url];
      if (current.length >= limit) {
        setError(`You can select up to ${limit} images.`);
        return current;
      }
      return [...current, url];
    });
  };

  const uploadFiles = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (images.length !== files.length) { setError('Only image files can be uploaded.'); return; }
    const oversized = images.find((file) => file.size > 8 * 1024 * 1024);
    if (oversized) { setError(`${oversized.name} is larger than 8 MB.`); return; }
    if (!images.length) return;
    setUploading(true);
    setError('');
    try {
      const uploaded: MediaAsset[] = [];
      for (const file of images) {
        const body = new FormData();
        body.append('file', file);
        const response = await api.post('/media/upload', body, { headers: { 'Content-Type': 'multipart/form-data' } });
        uploaded.push(response.data.asset);
      }
      setAssets((current) => [...uploaded, ...current]);
      setSelected((current) => {
        const next = multiple ? [...current, ...uploaded.map((asset) => asset.url)] : [uploaded[0].url];
        return Array.from(new Set(next)).slice(0, limit);
      });
    } catch (uploadError: any) {
      setError(uploadError.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => uploadFiles(Array.from(event.target.files || []));
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    uploadFiles(Array.from(event.dataTransfer.files || []));
  };
  const cleanValue = value.filter(Boolean);

  return <div className="min-w-0">
    {compact ? (
      <div className="inline-flex items-center gap-1">
        <button type="button" onClick={() => setOpen(true)} className="group inline-flex h-10 min-w-[116px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-left text-xs font-semibold text-slate-600 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {cleanValue[0] ? <img src={cleanValue[0]} alt="Selected" className="h-7 w-7 rounded-md bg-slate-100 object-cover" /> : <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 dark:bg-slate-800"><ImageIcon className="h-3.5 w-3.5" /></span>}
          <span className="min-w-0 flex-1 truncate">{cleanValue[0] ? 'Change' : 'Choose image'}</span>
        </button>
        {!!cleanValue[0] && <button type="button" onClick={() => onChange([])} aria-label="Clear selected image" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"><X className="h-3.5 w-3.5" /></button>}
      </div>
    ) : (
      <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        {cleanValue.length ? <div className="mb-3 flex flex-wrap gap-2">{cleanValue.map((url, index) => <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"><img src={url} alt={`Selected image ${index + 1}`} className="h-16 w-16 bg-slate-100 object-cover" /><button type="button" aria-label={`Remove selected image ${index + 1}`} onClick={() => onChange(cleanValue.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-950/75 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 focus:opacity-100"><X className="h-3.5 w-3.5" /></button></div>)}</div> : <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3 text-slate-400 dark:bg-slate-950/60"><Images className="h-5 w-5" /><span className="text-xs font-medium">No image selected</span></div>}
        <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-[#d8ff55] dark:text-slate-950"><Images className="h-4 w-4" /> {cleanValue.length ? 'Manage images' : 'Choose from gallery'}</button>{!!cleanValue.length && <span className="text-[11px] font-medium text-slate-400">{cleanValue.length} selected{Number.isFinite(limit) ? ` · max ${limit}` : ''}</span>}</div>
      </div>
    )}

    {open && createPortal(<div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={title || 'Media Gallery picker'} onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section className="flex h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#f7f6f2] shadow-2xl sm:h-[min(780px,90dvh)] sm:rounded-2xl dark:bg-[#07101f]">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6 dark:border-slate-800 dark:bg-[#101a2c]">
          <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d8ff55] text-slate-950"><Images className="h-5 w-5" /></span><div className="min-w-0"><h2 className="truncate text-base font-extrabold tracking-tight text-slate-950 dark:text-white">{title || (multiple ? 'Choose gallery images' : 'Choose an image')}</h2><p className="text-xs text-slate-500">Connected to Media Gallery · {assets.length} assets</p></div></div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close media picker"><X className="h-5 w-5" /></button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-h-0 flex-col border-slate-200 lg:border-r dark:border-slate-800">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-white/80 p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-[#101a2c]/80">
              <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-slate-400 dark:border-slate-700 dark:bg-slate-950"><Search className="h-4 w-4 text-slate-400" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by filename or alt text…" className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white" /></label>
              <div className="flex items-center gap-2"><label className="relative flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">Sort: {sort === 'recent' ? 'Newest' : 'Name'} <ChevronDown className="h-3.5 w-3.5" /><select aria-label="Sort media" value={sort} onChange={(event) => setSort(event.target.value as 'recent' | 'name')} className="absolute inset-0 cursor-pointer opacity-0"><option value="recent">Newest</option><option value="name">Name</option></select></label><button type="button" aria-label="Upload images" onClick={() => fileInput.current?.click()} disabled={uploading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-60 dark:bg-[#d8ff55] dark:text-slate-950"><Upload className="h-4 w-4" /> <span className="hidden sm:inline">Upload</span></button><input ref={fileInput} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={handleFiles} /></div>
            </div>
            {error && <div role="alert" className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {loading ? <div className="grid min-h-64 place-items-center text-sm text-slate-500"><span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Loading Media Gallery…</span></div> : visibleAssets.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">{visibleAssets.map((asset) => { const isSelected = selected.includes(asset.url); return <button type="button" aria-pressed={isSelected} key={asset.id} onClick={() => toggle(asset.url)} className={`group overflow-hidden rounded-xl border-2 bg-white text-left transition dark:bg-slate-900 ${isSelected ? 'border-slate-950 ring-2 ring-[#d8ff55] dark:border-[#d8ff55]' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'}`}><span className="relative block aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800"><img src={asset.url} alt={asset.altText || asset.fileName} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /><span className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border text-white shadow ${isSelected ? 'border-slate-950 bg-slate-950 dark:border-[#d8ff55] dark:bg-[#d8ff55] dark:text-slate-950' : 'border-white/70 bg-slate-950/25'}`}>{isSelected && <Check className="h-3.5 w-3.5" />}</span></span><span className="block truncate px-2.5 pt-2 text-xs font-bold text-slate-700 dark:text-slate-200">{asset.fileName}</span><span className="block px-2.5 pb-2 pt-0.5 text-[10px] text-slate-400">{formatSize(asset.size)}</span></button>; })}</div> : <div className="grid min-h-64 place-items-center rounded-2xl border-2 border-dashed border-slate-200 text-center dark:border-slate-800"><div><Images className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">{query ? 'No matching images' : 'Your Media Gallery is empty'}</p><p className="mt-1 text-xs text-slate-400">{query ? 'Try a different search term.' : 'Upload an image to get started.'}</p></div></div>}
            </div>
          </div>
          <aside className="hidden min-h-0 flex-col bg-white lg:flex dark:bg-[#101a2c]">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Upload new</p><div onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} className={`mt-3 rounded-xl border-2 border-dashed p-5 text-center transition ${dragging ? 'border-[#9fc400] bg-[#efffc1]' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50'}`}>{uploading ? <Loader2 className="mx-auto h-7 w-7 animate-spin text-slate-500" /> : <CloudUpload className="mx-auto h-7 w-7 text-slate-400" />}<p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-200">{uploading ? 'Uploading…' : 'Drop images here'}</p><p className="mt-1 text-[10px] leading-4 text-slate-400">JPG, PNG, WebP or GIF<br />Maximum 8 MB each</p><button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="mt-3 text-xs font-bold text-slate-700 underline underline-offset-4 dark:text-slate-200">Browse files</button></div></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5"><div className="flex items-center justify-between"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Selected</p>{!!selected.length && <button type="button" onClick={() => setSelected([])} className="text-[10px] font-bold text-rose-500">Clear all</button>}</div>{selected.length ? <div className="mt-3 space-y-2">{selected.map((url, index) => <div key={`${url}-${index}`} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"><img src={url} alt="" className="h-10 w-10 rounded-md object-cover" /><span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">Image {index + 1}</span><button type="button" onClick={() => setSelected((current) => current.filter((item) => item !== url))} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div> : <p className="mt-4 text-xs leading-5 text-slate-400">Choose {multiple ? 'one or more images' : 'an image'} from your library.</p>}</div>
          </aside>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-6 dark:border-slate-800 dark:bg-[#101a2c]"><span className="text-xs font-semibold text-slate-500">{selected.length} selected{Number.isFinite(limit) ? ` of ${limit}` : ''}</span><div className="flex gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancel</button><button type="button" disabled={uploading || !selected.length} onClick={() => { onChange(selected); setOpen(false); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#d8ff55] dark:text-slate-950"><Check className="h-4 w-4" /> {selected.length ? `Use ${selected.length === 1 ? 'image' : `${selected.length} images`}` : 'Select an image'}</button></div></footer>
      </section>
    </div>, document.body)}
  </div>;
}
