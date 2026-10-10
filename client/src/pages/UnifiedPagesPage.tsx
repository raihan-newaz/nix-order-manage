import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ExternalLink, Layers, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { errorMessage } from '../builder/useStudio';

type StudioPage = { id: string; title: string; slug: string; publishedSlug: string | null; publishedVersion: number | null; updatedAt: string };
type StorePage = { id: string; title: string; slug: string; status: 'DRAFT' | 'PUBLISHED' | 'TRASH'; isActive: boolean; isSystem: boolean; updatedAt: string };
type LandingLink = { storePageId: string; builderPageId: string; thankYouPageId?: string };
const storefrontUrl = (import.meta as { env?: { VITE_STOREFRONT_URL?: string } }).env?.VITE_STOREFRONT_URL || 'http://localhost:3001';

export function UnifiedPagesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [studioPages, setStudioPages] = useState<StudioPage[]>([]);
  const [storePages, setStorePages] = useState<StorePage[]>([]);
  const [links, setLinks] = useState<LandingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [kind, setKind] = useState<'landing' | 'visual'>(params.get('create') === 'visual' ? 'visual' : 'landing');
  const filter = params.get('type') || 'all';
  const load = async () => {
    try {
      const [studio, store, linked] = await Promise.all([api.get('/builder/pages'), api.get('/storefront/manage/pages'), api.get('/builder/landings')]);
      setStudioPages(studio.data.pages || []); setStorePages(store.data.pages || []); setLinks(linked.data.links || []);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const linkedBuilderIds = new Set(links.flatMap(link => [link.builderPageId, ...(link.thankYouPageId ? [link.thankYouPageId] : [])]));
  const entries = useMemo(() => [
    ...storePages.filter(page => page.status !== 'TRASH').map(page => ({ kind: page.slug.startsWith('flow-') ? 'landing' as const : 'content' as const, id: page.id, title: page.title, slug: page.slug.replace(/^flow-/, ''), published: page.status === 'PUBLISHED' && page.isActive, updatedAt: page.updatedAt, builderId: links.find(link => link.storePageId === page.id)?.builderPageId, isSystem: page.isSystem })),
    ...studioPages.filter(page => !linkedBuilderIds.has(page.id)).map(page => ({ kind: 'visual' as const, id: page.id, title: page.title, slug: `b/${page.publishedSlug || page.slug}`, published: Boolean(page.publishedVersion), updatedAt: page.updatedAt, builderId: page.id, isSystem: false }))
  ].filter(page => (filter === 'all' || filter === page.kind) && `${page.title} ${page.slug}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [studioPages, storePages, links, filter, query]);
  const openPage = async (entry: typeof entries[number]) => {
    if (entry.builderId) { navigate(`/builder/${entry.builderId}`); return; }
    if (entry.kind === 'content') { navigate(`/pages/${entry.id}/edit`); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/builder/landings/${entry.id}/connect`);
      navigate(`/builder/${data.link.builderPageId}`);
      if (data.warnings?.length) toast('Review imported sections before publishing.', { duration: 6000 });
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const endpoint = kind === 'landing' ? '/builder/landings' : '/builder/pages';
      const { data } = await api.post(endpoint, { title: title.trim(), slug: slug.trim() });
      navigate(`/builder/${kind === 'landing' ? data.link.builderPageId : data.id}`);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const counts = { all: storePages.filter(page => page.status !== 'TRASH').length + studioPages.filter(page => !linkedBuilderIds.has(page.id)).length, landing: storePages.filter(page => page.slug.startsWith('flow-') && page.status !== 'TRASH').length, content: storePages.filter(page => !page.slug.startsWith('flow-') && page.status !== 'TRASH').length, visual: studioPages.filter(page => !linkedBuilderIds.has(page.id)).length };
  return <div className="mx-auto max-w-7xl space-y-5 pb-16">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Pages</h1><p className="mt-1 text-sm text-slate-500">Manage landing pages, storefront content, and visual pages in one place. Landing pages open in Visual Studio.</p></div><Link to="/pages/new" className="rounded-xl border px-3 py-2 text-xs font-semibold">Create content page</Link></div>
    <form onSubmit={create} className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Create a page</h2><div className="flex gap-2"><button type="button" onClick={() => setKind('landing')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${kind === 'landing' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Landing + checkout</button><button type="button" onClick={() => setKind('visual')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${kind === 'visual' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Visual page</button></div></div><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><label className="text-xs font-semibold">Title<input required maxLength={120} className="field mt-1" value={title} onChange={event => { setTitle(event.target.value); setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} placeholder="Page title"/></label><label className="text-xs font-semibold">Public URL<input required maxLength={90} pattern="[a-z0-9]+(-[a-z0-9]+)*" className="field mt-1" value={slug} onChange={event => setSlug(event.target.value)} placeholder="page-url"/></label><button type="submit" disabled={busy} className="self-end rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} className="mr-1 inline"/>Create & open Studio</button></div><p className="mt-3 text-xs text-slate-500">{kind === 'landing' ? `Store URL: ${storefrontUrl}/${slug || 'page-url'} · Add products in Checkout settings, then Publish.` : `Visual URL: ${storefrontUrl}/b/${slug || 'page-url'}`}</p></form>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap gap-2">{(['all','landing','content','visual'] as const).map(type => <button key={type} onClick={() => setParams(type === 'all' ? {} : { type })} className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === type ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}>{type === 'all' ? 'All pages' : type === 'landing' ? 'Landing pages' : type === 'content' ? 'Content pages' : 'Visual pages'} <span className="opacity-60">{counts[type]}</span></button>)}</div><label className="flex items-center gap-2 rounded-lg border px-3 dark:border-slate-700"><Search size={16}/><input className="bg-transparent py-2 text-sm outline-none" placeholder="Search pages" value={query} onChange={event => setQuery(event.target.value)}/></label></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{loading ? <p className="text-sm text-slate-500">Loading pages…</p> : entries.map(entry => <article key={`${entry.kind}-${entry.id}`} className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase dark:bg-slate-800">{entry.kind === 'landing' ? 'Landing + checkout' : entry.kind === 'content' ? entry.isSystem ? 'Store content' : 'Content page' : 'Visual page'}</span><span className={`text-xs font-bold ${entry.published ? 'text-emerald-600' : 'text-amber-600'}`}>{entry.published ? 'LIVE' : 'DRAFT'}</span></div><h3 className="mt-4 truncate font-bold">{entry.title}</h3><p className="mt-1 truncate font-mono text-xs text-slate-500">/{entry.slug}</p><div className="mt-5 flex items-center justify-between border-t pt-4 dark:border-slate-800"><button disabled={busy} onClick={() => { void openPage(entry); }} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Layers size={14}/>{entry.kind === 'content' ? 'Edit content' : entry.builderId ? 'Open Studio' : 'Import to Studio'}</button>{entry.published && <a href={`${storefrontUrl}/${entry.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">Live <ExternalLink size={14}/></a>}</div></article>)}{!loading && !entries.length && <p className="text-sm text-slate-500">No pages found.</p>}</div>
    <p className="text-xs text-slate-500">Store content pages keep their existing editor and URLs. Landing pages use Visual Studio for design, checkout settings, and publishing.</p>
  </div>;
}

export function LegacyLandingRedirect() {
  const { id } = useParams(); const navigate = useNavigate();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id) return;
    api.post(`/builder/landings/${id}/connect`).then(({ data }) => navigate(`/builder/${data.link.builderPageId}?checkout=1`, { replace: true })).catch(err => setError(errorMessage(err)));
  }, [id, navigate]);
  return <div className="p-8 text-sm">{error ? <><p role="alert">{error}</p><Link className="text-emerald-700" to="/pages?type=landing">Return to landing pages</Link></> : 'Opening landing page in Visual Studio…'}</div>;
}
