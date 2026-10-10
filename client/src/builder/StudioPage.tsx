import { Component, type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowUpRight, Copy, Download, Eye, Layers, Plus,
  Search, Trash2, Upload,
  Settings, History, X, Sun, Moon, ExternalLink, Globe, LayoutTemplate,
  Shield, Clock, Sliders, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Canvas } from './Canvas';
import { Inspector } from './Inspector';
import { DesignPanel } from './DesignPanel';
import { Navigator } from './Navigator';
import { AccessPanel } from './AccessPanel';
import { ThemePanel } from './ThemePanel';
import { SubmissionsPanel } from './SubmissionsPanel';
import { ContextMenu } from './ContextMenu';
import { useLoopData } from './useLoopData';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useStudio, downloadDocument, errorMessage } from './useStudio';
import { CheckoutSettings } from '../pages/LandingPagesPage';
import type { LandingBlock } from '../pages/landingTemplates';
import { type BuilderNode, type PageDocument, cloneNode, createNode, findNode, widgets, renderPage, migrateDocument } from './core';
import { handleShortcut } from './shortcuts';
import './studio.css';

export const widgetIcons: Record<string, string> = {
  container: 'eicon-flex',
  flex: 'eicon-flex',
  grid: 'eicon-grid-layout',
  section: 'eicon-columns',
  column: 'eicon-column',
  heading: 'eicon-t-letter',
  text: 'eicon-text',
  paragraph: 'eicon-editor-paragraph',
  blockquote: 'eicon-blockquote',
  code: 'eicon-code',
  badge: 'eicon-tag',
  'text-editor': 'eicon-text',
  button: 'eicon-button',
  link: 'eicon-editor-link',
  image: 'eicon-image',
  video: 'eicon-youtube',
  audio: 'eicon-headphones',
  divider: 'eicon-divider',
  spacer: 'eicon-spacer',
  anchor: 'eicon-anchor',
  'google-maps': 'eicon-google-maps',
  icon: 'eicon-favorite',
  'icon-box': 'eicon-icon-box',
  'image-box': 'eicon-image-box',
  'star-rating': 'eicon-rating',
  'image-carousel': 'eicon-slider-push',
  gallery: 'eicon-gallery-grid',
  'icon-list': 'eicon-bullet-list',
  counter: 'eicon-counter',
  progress: 'eicon-skill-bar',
  testimonial: 'eicon-testimonial',
  tabs: 'eicon-tabs',
  accordion: 'eicon-accordion',
  toggle: 'eicon-toggle',
  'social-icons': 'eicon-social-icons',
  alert: 'eicon-alert',
  'product-title': 'eicon-product-title',
  'product-price': 'eicon-product-price',
  'product-button': 'eicon-cart',
  countdown: 'eicon-countdown',
  'size-chart': 'eicon-table',
  'trust-badges': 'eicon-shield-check',
  'pricing-table': 'eicon-price-table',
  nav: 'eicon-nav-menu',
  details: 'eicon-accordion',
  form: 'eicon-form-horizontal',
  'form-field': 'eicon-text-field',
  'form-submit': 'eicon-button',
  component: 'eicon-kit-parts',
  loop: 'eicon-post-list',
  notice: 'eicon-info-circle'
};

class CanvasBoundary extends Component<{ children: ReactNode; resetKey: PageDocument }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: { resetKey: PageDocument }) { if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false }); }
  render() { return this.state.failed ? <div className="studio-empty">Unable to render this element. Undo the last change or export the document for recovery.</div> : this.props.children; }
}

type PageSummary = { id: string; title: string; slug: string; publishedSlug: string | null; version: number; publishedVersion: number | null; updatedAt: string };
const storefrontUrl = (import.meta as { env?: { VITE_STOREFRONT_URL?: string } }).env?.VITE_STOREFRONT_URL || 'http://localhost:3001';

export function BuilderPagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [accessOpen, setAccessOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [landingLinks, setLandingLinks] = useState<Record<string, { storePageId: string; slug: string; status: string; isActive: boolean }>>({});
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT' | 'LANDING'>('ALL');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/builder/pages').catch(() => ({ data: { pages: [] } })),
      api.get('/builder/capabilities').catch(() => ({ data: { permissions: { edit: true } } })),
      api.get('/builder/landings').catch(() => ({ data: { links: [] } }))
    ])
      .then(([result, access, links]) => {
        setPages(result.data.pages || []);
        setCanEdit(access.data?.permissions?.edit ?? true);
        setLandingLinks(
          Object.fromEntries(
            (links.data.links || []).map((link: { builderPageId: string; storePageId: string; storePage?: { slug?: string; status?: string; isActive?: boolean } }) => [
              link.builderPageId,
              { storePageId: link.storePageId, slug: link.storePage?.slug || '', status: link.storePage?.status || 'DRAFT', isActive: Boolean(link.storePage?.isActive) }
            ])
          )
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a page title');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const result = await api.post('/builder/pages', { title, slug });
      toast.success('Page created successfully!');
      navigate(`/builder/${result.data.id}`);
    } catch (e) {
      setError(errorMessage(e));
      toast.error(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const deletePage = async (page: PageSummary) => {
    if (!window.confirm(`Are you sure you want to delete "${page.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/builder/pages/${page.id}`);
      toast.success('Page deleted');
      setPages(curr => curr.filter(p => p.id !== page.id));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard!');
  };

  const filteredPages = pages.filter(page => {
    const isLanding = Boolean(landingLinks[page.id]);
    const matchesFilter =
      filter === 'ALL'
        ? true
        : filter === 'PUBLISHED'
        ? Boolean(page.publishedVersion)
        : filter === 'DRAFT'
        ? !page.publishedVersion
        : isLanding;
    const matchesSearch =
      query.trim() === '' ||
      page.title.toLowerCase().includes(query.toLowerCase()) ||
      page.slug.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: pages.length,
    published: pages.filter(p => p.publishedVersion).length,
    drafts: pages.filter(p => !p.publishedVersion).length,
    landings: Object.keys(landingLinks).length
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* Top Header - Compact, Space-Efficient & Clean */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Visual Studio</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300 border border-pink-200 dark:border-pink-800 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
              Elementor Engine
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Create and edit visual pages and landing flows with 100% Elementor drag-and-drop capabilities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/landing-pages"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <LayoutTemplate size={14} className="text-slate-500" />
            Landing Flows
          </Link>
          <button
            type="button"
            onClick={() => setThemeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <Globe size={14} className="text-slate-500" />
            Headers & Footers
          </button>
          {user?.role === 'SUPER_ADMIN' && (
            <button
              type="button"
              onClick={() => setAccessOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition shadow-sm"
            >
              <Shield size={14} className="text-slate-500" />
              Staff Access
            </button>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Total Pages</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Layers size={20} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Published Live</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.published}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Drafts in Progress</span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.drafts}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock size={20} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Landing Flows</span>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.landings}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <LayoutTemplate size={20} />
          </div>
        </div>
      </div>

      {/* Create New Page Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Plus size={18} className="text-emerald-600" />
            Create New Visual Page
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Start with a blank canvas or import template blocks. Your existing storefront stays live.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs dark:bg-red-950/30 dark:border-red-900 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Page Title <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-emerald-400 transition"
              placeholder="e.g. Mega Summer Sale Promo"
              required
              maxLength={120}
              value={title}
              onChange={event => {
                setTitle(event.target.value);
                setSlug(
                  event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                );
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              URL Slug <span className="text-red-500">*</span>
            </label>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 overflow-hidden dark:border-slate-700 dark:bg-slate-800 focus-within:border-emerald-500 dark:focus-within:border-emerald-400 transition">
              <span className="px-3 py-2.5 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700 flex items-center font-mono">
                /b/
              </span>
              <input
                className="w-full bg-transparent px-3 py-2.5 text-sm outline-none dark:text-white font-mono"
                placeholder="summer-sale"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={120}
                value={slug}
                onChange={event => setSlug(event.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating || !canEdit}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50 h-[42px] shadow-sm shadow-emerald-600/20"
          >
            <Plus size={16} />
            {creating ? 'Creating…' : 'Create & Open Studio'}
          </button>
        </form>
      </div>

      {/* Pages Filter Bar & Search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: 'ALL', label: 'All Pages', count: stats.total },
              { key: 'PUBLISHED', label: 'Published', count: stats.published },
              { key: 'DRAFT', label: 'Drafts', count: stats.drafts },
              { key: 'LANDING', label: 'Landing Flows', count: stats.landings }
            ] as const
          ).map(item => (
            <button
              type="button"
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition flex items-center gap-2 ${
                filter === item.key
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <span>{item.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                filter === item.key ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex min-w-[240px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            className="w-full bg-transparent outline-none text-xs sm:text-sm text-slate-900 dark:text-white"
            placeholder="Search pages by title or URL..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Pages Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          Loading your Studio pages…
        </div>
      ) : !filteredPages.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          <Layers size={36} className="mx-auto text-slate-400 mb-3 opacity-60" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">No pages found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {query ? 'Try searching with a different keyword or change the filter.' : 'Your first visual page starts here. Enter a title above to begin.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPages.map(page => {
            const isLanding = Boolean(landingLinks[page.id]);
            const landingInfo = landingLinks[page.id];
            const liveUrl = isLanding && landingInfo.status === 'PUBLISHED' && landingInfo.isActive
              ? `${storefrontUrl}/${landingInfo.slug.replace(/^flow-/, '')}`
              : !isLanding && page.publishedSlug
              ? `/b/${page.publishedSlug}`
              : null;
            const displayRoute = isLanding
              ? `/${landingInfo.slug.replace(/^flow-/, '')}`
              : `/b/${page.publishedSlug || page.slug}`;

            return (
              <article
                key={page.id}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Badges & Trash */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          page.publishedVersion
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${page.publishedVersion ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {page.publishedVersion ? 'PUBLISHED' : 'DRAFT'}
                      </span>

                      {isLanding && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          Landing Flow
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono text-slate-400">v{page.version}</span>
                      <button
                        type="button"
                        onClick={() => deletePage(page)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition opacity-0 group-hover:opacity-100"
                        title="Delete page"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Card Title & Icon Art */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 font-bold">
                      <Layers size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate" title={page.title}>
                        {page.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                        <span className="truncate">{displayRoute}</span>
                        <button
                          type="button"
                          onClick={() => { if (liveUrl) copyUrl(liveUrl.startsWith('/') ? `${window.location.origin}${liveUrl}` : liveUrl); }}
                          disabled={!liveUrl}
                          className="text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-slate-200"
                          title={liveUrl ? 'Copy live URL' : 'Publish the checkout to make this URL live'}
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                      {isLanding && <p className="mt-1 text-[11px] text-slate-500">Checkout: {landingInfo.status.toLowerCase()}{landingInfo.isActive ? '' : ' · inactive'}</p>}
                    </div>
                  </div>

                  {/* Update metadata */}
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-4">
                    <Clock size={12} />
                    <span>Updated {new Date(page.updatedAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to={`/builder/${page.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 transition shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-pink-400 inline-block"></span>
                    Open in Studio
                    <ArrowUpRight size={14} />
                  </Link>

                  <div className="flex items-center gap-1.5">
                    {liveUrl && (
                      <a
                        href={liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                        title="View live published page"
                      >
                        <ExternalLink size={13} />
                        Live
                      </a>
                    )}

                    {isLanding && (
                      <Link
                        to={`/landing-pages/${landingInfo.storePageId}/edit`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                        title="Edit checkout & offer settings"
                      >
                        <Sliders size={13} />
                        Settings
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Access Panel Modal */}
      {accessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Shield className="text-emerald-600" size={20} />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Studio Staff Permissions</h3>
              </div>
              <button
                onClick={() => setAccessOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <AccessPanel />
          </div>
        </div>
      )}

      {/* Theme (Headers & Footers) Modal */}
      {themeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Globe className="text-emerald-600" size={20} />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Site Headers & Footers</h3>
              </div>
              <button
                onClick={() => setThemeOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <ThemePanel pages={pages} canEdit={canEdit} />
          </div>
        </div>
      )}
    </div>
  );
}

export function StudioPage() {
  const { theme, toggleTheme } = useTheme();
  const { id } = useParams(); const studio = useStudio(id); const navigate = useNavigate();
  const [landing, setLanding] = useState<{ storePageId: string; builderPageId: string; thankYouPageId?: string; pageKind?: string; storePage: { slug: string; status: string; isActive: boolean }; warnings: string[]; missingNodes: BuilderNode[] } | null>(null);
  const [landingChecked, setLandingChecked] = useState(false);
  type CheckoutDraft = { storePageId: string; slug: string; title: string; metaTitle: string; metaDescription: string; checkout: Extract<LandingBlock, { type: 'CHECKOUT' }>; version: number; status: string; isActive: boolean };
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).get('checkout') === '1') setCheckoutOpen(true); }, [id]);
  const [checkoutDirty, setCheckoutDirty] = useState(false);
  useEffect(() => { if (!checkoutDirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [checkoutDirty]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [products, setProducts] = useState<Array<{ id: string; name: string; image?: string; regularPrice: number; salePrice: number; inStock: boolean; productType?: 'SIMPLE' | 'VARIABLE'; variants?: Array<{ id: string; name: string; regularPrice: number; salePrice: number; inStock: boolean }> }>>([]);
  const [productRefresh, setProductRefresh] = useState(0);
  const loadCheckout = async () => {
    if (!id) return;
    const { data } = await api.get<CheckoutDraft>(`/builder/landings/by-builder/${id}/checkout`);
    setCheckoutDraft(data); setCheckoutDirty(false);
  };
  useEffect(() => { if (!id) return; setLandingChecked(false); api.get(`/builder/landings/by-builder/${id}`).then(({ data }) => setLanding(data.link)).catch(() => setLanding(null)).finally(() => setLandingChecked(true)); }, [id]);
  useEffect(() => { if (landing && landing.pageKind !== 'thank-you') void loadCheckout().catch(error => studio.setError(errorMessage(error))); else setCheckoutDraft(null); }, [id, landing?.storePageId]);
  useEffect(() => {
    if (!checkoutOpen) return;
    const timer = window.setTimeout(() => { api.get('/storefront/products', { params: { search: productQuery, limit: 60 } }).then(({ data }) => setProducts(data.products || [])).catch(() => undefined); }, 250);
    return () => window.clearTimeout(timer);
  }, [checkoutOpen, productQuery, productRefresh]);
  const connectToLanding = async () => {
    if (!id) return;
    try {
      const { data } = await api.post(`/builder/landings/from-builder/${id}`);
      setLanding({ ...data.link, warnings: [], missingNodes: [] });
      toast.success('Studio page connected to a checkout landing draft.');
    } catch (error) { toast.error(errorMessage(error)); }
  };
  const [selected, select] = useState<string | null>(null); const [panel, setPanel] = useState('elements'); const [device, setDevice] = useState('desktop'); const [zoom, setZoom] = useState(0.8); const [search, setSearch] = useState('');
  const [revisions, setRevisions] = useState<Array<{ id: string; version: number; action: string; authorName: string; createdAt: string }>>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]); const [templateName, setTemplateName] = useState('');
  const [clipboard, setClipboard] = useState<BuilderNode | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: BuilderNode } | null>(null);
  const [showFloatingNavigator, setShowFloatingNavigator] = useState(true);
  const importFile = useRef<HTMLInputElement>(null);

  const doc = studio.history?.present;
  const hasForm = (item: BuilderNode): boolean => ['form', 'form-field', 'form-submit'].includes(item.type) || item.children.some(hasForm);
  const oldOrderSections = doc?.rootNodes.filter(item => hasForm(item) && /(?:order|checkout).*(?:form|section)|(?:form|section).*(?:order|checkout)/i.test(item.name || '')) || [];
  const node = doc && selected ? findNode(doc.rootNodes, selected) : undefined;
  const dynamic = useLoopData(doc);

  const action = (name: 'copy' | 'paste' | 'pasteStyle' | 'resetStyle' | 'duplicate' | 'remove') => {
    if (!doc) return;
    if (name === 'copy' && node) {
      setClipboard(structuredClone(node));
      return;
    }
    if (name === 'paste' && clipboard) {
      const copy = cloneNode(clipboard);
      studio.command({ type: 'insert', node: copy, parentId: node && widgets.get(node.type)?.children ? node.id : undefined });
      select(copy.id);
    }
    if (name === 'pasteStyle' && clipboard && node) {
      studio.command({
        type: 'update',
        id: node.id,
        patch: {
          styles: structuredClone(clipboard.styles),
          responsiveStyles: structuredClone(clipboard.responsiveStyles),
          states: structuredClone(clipboard.states),
          shapeDividers: structuredClone(clipboard.shapeDividers),
          advanced: structuredClone(clipboard.advanced)
        }
      }, `pasteStyle:${node.id}`);
    }
    if (name === 'resetStyle' && node) {
      studio.command({
        type: 'update',
        id: node.id,
        patch: { styles: {}, responsiveStyles: {}, states: {}, shapeDividers: undefined, advanced: undefined }
      }, `resetStyle:${node.id}`);
    }
    if ((name === 'duplicate' || name === 'remove') && selected) {
      studio.command({ type: name, id: selected });
    }
    if (name === 'remove') select(null);
  };

  const saveCheckout = async () => {
    if (!id || !checkoutDraft || !checkoutDirty) return true;
    setCheckoutBusy(true);
    try {
      const { title, metaTitle, metaDescription, checkout, version } = checkoutDraft;
      const { data } = await api.put<CheckoutDraft>(`/builder/landings/by-builder/${id}/checkout`, { title, metaTitle, metaDescription, checkout, version });
      setCheckoutDraft(data); setCheckoutDirty(false); toast.success('Checkout draft saved'); return true;
    } catch (error) { studio.setError(errorMessage(error)); return false; }
    finally { setCheckoutBusy(false); }
  };
  const publishDesign = async () => {
    if (landing?.warnings.length && !window.confirm(`Review imported sections before publishing: ${landing.warnings.join(' ')} Continue?`)) return false;
    if (landing && !(await saveCheckout())) return false;
    if (await studio.publish()) {
      if (landing && landing.pageKind !== 'thank-you') {
        try { await loadCheckout(); } catch (error) { studio.setError(errorMessage(error)); }
        toast.success('Landing design and checkout are live');
      }
      return true;
    }
    return false;
  };

  const restoreMissingSections = async () => {
    if (!landing?.missingNodes.length) return;
    for (const missing of landing.missingNodes) studio.command({ type: 'insert', node: missing });
    try {
      await studio.save();
      const { data } = await api.get(`/builder/landings/by-builder/${id}`);
      setLanding(data.link);
      toast.success('Missing landing sections added to the Studio draft');
    } catch (error) { studio.setError(errorMessage(error)); }
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleShortcut(event, {
      undo: () => studio.travel('undo'),
      redo: () => studio.travel('redo'),
      save: () => void studio.save().catch(() => {}),
      publish: publishDesign,
      copy: () => action('copy'),
      paste: () => action('paste'),
      duplicate: () => action('duplicate'),
      remove: () => action('remove'),
      deselect: () => select(null)
    });
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });

  useEffect(() => {
    if (panel === 'history') api.get(`/builder/pages/${id}/revisions`).then(result => setRevisions(result.data.revisions)).catch(e => studio.setError(errorMessage(e)));
    if (panel === 'templates') api.get('/builder/templates').then(result => setTemplates(result.data.templates)).catch(e => studio.setError(errorMessage(e)));
  }, [panel, id, studio.version]);

  if (!doc) return <div className="studio-loading"><Layers size={32} /><h2>{studio.status}</h2>{studio.error && <p role="alert">{studio.error}</p>}<Link to="/builder">Return to pages</Link></div>;

  const add = (type: string) => {
    const next = createNode(type);
    studio.command({ type: 'insert', node: next, parentId: node && widgets.get(node.type)?.children ? node.id : undefined });
    select(next.id);
  };

  const width = device === 'desktop' ? 1200 : doc.breakpoints.find(bp => bp.id === device)?.maxWidth || 640;
  let warnings: string[] = []; try { warnings = renderPage(doc).warnings; } catch { /* Canvas boundary provides recovery. */ }

  const importDocument = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 2000000) throw new Error('Imports must be smaller than 2 MB');
      const payload = JSON.parse(await file.text());
      if (payload.format !== 'nix-studio' || payload.version !== 1) throw new Error('Unsupported Studio export');
      const imported = migrateDocument(payload.document);
      imported.title = doc.title;
      imported.slug = doc.slug;
      renderPage(imported);
      if (window.confirm('Replace the current draft with this document? You can undo this change.')) {
        studio.command({ type: 'replace', document: imported });
      }
    } catch (e) { studio.setError(errorMessage(e)); }
  };

  return <div className={`studio-app elementor-workspace-app ${theme}`}>
    {landing && landing.pageKind !== 'thank-you' && <div className="studio-landing-notice"><span><strong>Landing page</strong> · /{landing.storePage.slug.replace(/^flow-/, '')} · {checkoutDraft?.status === 'PUBLISHED' && checkoutDraft.isActive ? 'Live' : 'Draft'}. Edit the design here and manage products, delivery and order rules in Products & checkout. Publish updates both together.</span><span>{landing.thankYouPageId && <Link to={`/builder/${landing.thankYouPageId}`}>Thank You page</Link>}<button type="button" onClick={() => setCheckoutOpen(true)}>Products & checkout{checkoutDirty ? ' • Unsaved' : ''}</button>{checkoutDraft?.status === 'PUBLISHED' && checkoutDraft.isActive && <a href={`${storefrontUrl}/${landing.storePage.slug.replace(/^flow-/, '')}`} target="_blank" rel="noreferrer">View live page</a>}</span></div>}
    {landing?.pageKind === 'thank-you' && <div className="studio-landing-notice"><span><strong>Thank You page</strong> · Shown after an order from /{landing.storePage.slug.replace(/^flow-/, '')}. Order details are added automatically.</span><Link to={`/builder/${landing.builderPageId}`}>Edit landing + checkout</Link></div>}
    {checkoutOpen && checkoutDraft && <div className="studio-checkout-overlay" role="dialog" aria-modal="true" aria-label="Products and checkout settings"><div className="studio-checkout-dialog"><header><div><strong>Products & checkout</strong><small>/{checkoutDraft.slug} · Save as draft, then Publish to update the live page.</small></div><button type="button" onClick={() => setCheckoutOpen(false)} aria-label="Close checkout settings"><X size={20}/></button></header><div className="studio-checkout-scroll"><div className="studio-checkout-meta"><label>Page title<input value={checkoutDraft.title} onChange={event => { setCheckoutDraft({ ...checkoutDraft, title: event.target.value }); setCheckoutDirty(true); }}/></label><label>SEO title<input value={checkoutDraft.metaTitle} onChange={event => { setCheckoutDraft({ ...checkoutDraft, metaTitle: event.target.value }); setCheckoutDirty(true); }}/></label><label>SEO description<textarea value={checkoutDraft.metaDescription} onChange={event => { setCheckoutDraft({ ...checkoutDraft, metaDescription: event.target.value }); setCheckoutDirty(true); }}/></label></div><CheckoutSettings pageId={checkoutDraft.storePageId} block={checkoutDraft.checkout} update={changes => { setCheckoutDraft(current => current ? { ...current, checkout: { ...current.checkout, ...changes } } : current); setCheckoutDirty(true); }} products={products} productQuery={productQuery} setProductQuery={setProductQuery} refreshProducts={() => setProductRefresh(value => value + 1)}/></div><footer><button type="button" onClick={() => setCheckoutOpen(false)}>Close</button><button type="button" disabled={checkoutBusy || !checkoutDirty} onClick={() => { void saveCheckout(); }}>{checkoutBusy ? 'Saving…' : 'Save checkout draft'}</button><button type="button" disabled={checkoutBusy || !studio.permissions.publish} onClick={async () => { if (await publishDesign()) setCheckoutOpen(false); }}>Publish landing page</button></footer></div></div>}
    {!landing && landingChecked && id && studio.permissions.edit && <div className="studio-landing-notice"><span><strong>Connect to checkout</strong> · Turn this Studio design into a landing page with a live product checkout.</span><span><button type="button" onClick={() => { void connectToLanding(); }}>Connect landing flow</button></span></div>}
    {landing?.warnings.length ? <div className="studio-landing-review" role="status"><strong>Review imported sections before publishing:</strong> {landing.warnings.join(' ')} {landing.missingNodes.length > 0 && <button type="button" disabled={!studio.permissions.edit} onClick={() => { void restoreMissingSections(); }}>Add missing sections to draft</button>}</div> : null}
    {landing && oldOrderSections.length > 0 && <div className="studio-landing-review" role="status">This draft still contains an old order form section. The live page uses Checkout settings for real orders. <button type="button" disabled={!studio.permissions.edit} onClick={() => { studio.command({ type: 'replace', document: { ...doc, rootNodes: doc.rootNodes.filter(item => !oldOrderSections.includes(item)) } }); select(null); toast.success('Old order form removed from draft. Save or Publish to keep the change.'); }}>Remove old order form from draft</button></div>}
    {studio.error && <div className="studio-error" role="alert">{studio.error}{studio.conflict && <><button onClick={() => downloadDocument(doc)}>Export my changes</button><button onClick={() => { if (window.confirm('Reload the server draft? Export your local changes first.')) void studio.load(); }}>Reload server version</button></>}</div>}
    {dynamic.error && <div className="studio-error" role="alert">Unable to load dynamic content: {dynamic.error}</div>}

    <div className="studio-workspace">
      {/* Elementor Main Unified Left Sidebar */}
      <aside className="studio-left elementor-sidebar">
        {/* If an element is selected and we are in edit mode, show Inspector */}
        {node ? (
          <Inspector
            key={node.id}
            node={node}
            document={doc}
            device={device}
            command={studio.command}
            onDeselect={() => select(null)}
          />
        ) : (
          <>
            <div className="elementor-panel-header">
              <button className="elementor-header-btn" title="Site Settings" onClick={() => setPanel(panel === 'design' ? 'elements' : 'design')}>
                <i className="eicon-menu-bar" />
              </button>
              <span className="elementor-header-title">ELEMENTS</span>
              <button className="elementor-header-btn active" title="Widgets">
                <i className="eicon-apps" />
              </button>
            </div>

            <nav className="elementor-top-tabs">
              {[['elements', 'Widgets'], ['design', 'Site Style'], ['templates', 'Library'], ['history', 'History'], ...(studio.permissions.submissions ? [['submissions', 'Forms']] : [])].map(([value, label]) => (
                <button
                  key={value}
                  className={panel === value ? 'active' : ''}
                  onClick={() => setPanel(value)}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="studio-panel-scroll">
              {panel === 'elements' && (
                <>
                  <div className="elementor-search-box">
                    <Search size={15} />
                    <input
                      placeholder="Search Widget…"
                      aria-label="Search elements"
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                    />
                  </div>

                  {[...new Set(widgets.all().map(widget => widget.category))].filter(category => category !== 'Components').map(category => {
                    const categoryWidgets = widgets.all().filter(widget => widget.category === category && `${widget.name} ${category}`.toLowerCase().includes(search.toLowerCase()));
                    if (!categoryWidgets.length) return null;
                    return (
                      <details className="elementor-category-section" key={category} open>
                        <summary><span className="elementor-category-title">{category}</span></summary>
                        <div className="elementor-widgets-grid">
                          {categoryWidgets.map(widget => (
                            <button
                              key={widget.type}
                              className="elementor-widget-box"
                              aria-label={widget.name}
                              disabled={!studio.permissions.edit}
                              draggable={studio.permissions.edit}
                              onDragStart={event => event.dataTransfer.setData('application/nix-widget', widget.type)}
                              onClick={() => add(widget.type)}
                            >
                              <i className={widgetIcons[widget.type] || 'eicon-elementor-circle'} />
                              <span>{widget.name}</span>
                            </button>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </>
              )}

              {panel === 'design' && <DesignPanel document={doc} command={studio.command} selected={node} select={select} />}
              {panel === 'submissions' && studio.permissions.submissions && id && <SubmissionsPanel pageId={id} />}
              {panel === 'settings' && (
                <div className="elementor-panel-content">
                  <div className="elementor-section-group">
                    <div className="elementor-group-title">
                      <span>General Settings</span>
                    </div>
                    <div className="elementor-group-content">
                      <div className="elementor-control-row">
                        <label className="elementor-control-label">Page Title</label>
                        <input
                          className="elementor-control-input"
                          value={doc.title}
                          onChange={e => studio.command({ type: 'document', patch: { title: e.target.value } })}
                          placeholder="Page Title"
                        />
                      </div>
                      {!landing && (
                        <div className="elementor-control-row">
                          <label className="elementor-control-label">URL Slug (/b/)</label>
                          <input
                            className="elementor-control-input"
                            value={doc.slug}
                            onChange={e => studio.command({ type: 'document', patch: { slug: e.target.value } })}
                            placeholder="page-slug"
                          />
                        </div>
                      )}
                      <div className="elementor-control-row">
                        <label className="elementor-control-label">Language</label>
                        <input
                          className="elementor-control-input"
                          value={doc.settings.lang}
                          onChange={e => studio.command({ type: 'document', patch: { settings: { ...doc.settings, lang: e.target.value } } })}
                          placeholder="en / bn"
                        />
                      </div>
                      <div className="elementor-control-row flex-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="elementor-control-label" style={{ marginBottom: 0 }}>RTL Direction</label>
                        <input
                          type="checkbox"
                          checked={doc.settings.direction === 'rtl'}
                          onChange={e => studio.command({ type: 'document', patch: { settings: { ...doc.settings, direction: e.target.checked ? 'rtl' : 'ltr' } } })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="elementor-section-group">
                    <div className="elementor-group-title">
                      <span>SEO & Social</span>
                    </div>
                    <div className="elementor-group-content">
                      {landing ? (
                        <p style={{ fontSize: '11px', color: 'var(--e-text-muted, #71717a)', margin: 0 }}>
                          The landing URL and search preview are managed in Checkout settings.
                        </p>
                      ) : (
                        <>
                          <div className="elementor-control-row">
                            <label className="elementor-control-label">Meta Title</label>
                            <input
                              className="elementor-control-input"
                              value={doc.seo.title}
                              onChange={e => studio.command({ type: 'document', patch: { seo: { ...doc.seo, title: e.target.value } } })}
                              placeholder="SEO Meta Title"
                            />
                          </div>
                          <div className="elementor-control-row">
                            <label className="elementor-control-label">Meta Description</label>
                            <textarea
                              className="elementor-control-input"
                              rows={3}
                              value={doc.seo.description}
                              onChange={e => studio.command({ type: 'document', patch: { seo: { ...doc.seo, description: e.target.value } } })}
                              placeholder="Brief description for search engines..."
                            />
                          </div>
                        </>
                      )}
                      <div className="elementor-control-row flex-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <label className="elementor-control-label" style={{ marginBottom: 0 }}>No-Index (Hide from SEO)</label>
                        <input
                          type="checkbox"
                          checked={doc.seo.noindex}
                          onChange={e => studio.command({ type: 'document', patch: { seo: { ...doc.seo, noindex: e.target.checked } } })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="elementor-section-group">
                    <div className="elementor-group-title">
                      <span>Actions & Portability</span>
                    </div>
                    <div className="elementor-group-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        className="elementor-btn"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '8px' }}
                        onClick={() => downloadDocument(doc)}
                      >
                        <Download size={14} /> Export Document JSON
                      </button>
                      <button
                        className="elementor-btn"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '8px' }}
                        disabled={!studio.permissions.edit}
                        onClick={() => importFile.current?.click()}
                      >
                        <Upload size={14} /> Import Document JSON
                      </button>
                      <input
                        ref={importFile}
                        type="file"
                        accept="application/json,.json"
                        hidden
                        onChange={event => { void importDocument(event.target.files?.[0]); event.target.value = ''; }}
                      />
                      {studio.publishedVersion && (
                        <button
                          className="elementor-btn"
                          style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', marginTop: '4px' }}
                          disabled={!studio.permissions.publish}
                          onClick={() => {
                            if (window.confirm('Remove this page from public view? Its draft and revisions will be kept.')) {
                              void studio.publish('unpublish');
                            }
                          }}
                        >
                          Unpublish Page
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="elementor-section-group">
                    <div className="elementor-group-title">
                      <span>Accessibility Diagnostic</span>
                    </div>
                    <div className="elementor-group-content">
                      {warnings.length ? (
                        warnings.map((warning, index) => (
                          <div key={index} style={{ fontSize: '11px', color: '#f59e0b', marginBottom: '4px', display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                            <span>⚠</span>
                            <span>{warning}</span>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: '11px', color: '#10b981', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>✓</span> All accessibility checks passed.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {panel === 'history' && (
                <div className="elementor-panel-content">
                  <div className="elementor-section-group">
                    <div className="elementor-group-title">
                      <span>Revision History ({revisions.length})</span>
                    </div>
                    <div className="elementor-group-content">
                      <p style={{ fontSize: '11px', color: 'var(--e-text-muted, #71717a)', marginBottom: '12px' }}>
                        Restoring creates a new working draft. Your live page updates only when you publish.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {revisions.map(revision => (
                          <div
                            key={revision.id}
                            style={{
                              border: '1px solid var(--e-border, #e4e4e7)',
                              borderRadius: '4px',
                              padding: '10px',
                              background: 'var(--e-bg-alt, #fafafa)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--e-text, #18181b)' }}>
                                Version {revision.version}
                              </span>
                              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: 'var(--e-accent, #71d7f7)', color: '#000', fontWeight: 600, textTransform: 'uppercase' }}>
                                {revision.action}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--e-text-muted, #71717a)' }}>
                              {revision.authorName} · {new Date(revision.createdAt).toLocaleString()}
                            </div>
                            <button
                              className="elementor-btn"
                              style={{ marginTop: '4px', padding: '5px 8px', fontSize: '11px', width: '100%' }}
                              disabled={!studio.permissions.edit || studio.conflict}
                              onClick={() => {
                                if (window.confirm(`Restore version ${revision.version} as the working draft?`)) {
                                  void studio.restore(revision.id);
                                }
                              }}
                            >
                              Restore as Draft
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {panel === 'templates' && (
                <div className="elementor-panel-content">
                  <div className="elementor-section-group">
                    <div className="elementor-group-title">
                      <span>Save Current Page to Library</span>
                    </div>
                    <div className="elementor-group-content">
                      <div className="elementor-control-row">
                        <label className="elementor-control-label">Template Name</label>
                        <input
                          className="elementor-control-input"
                          aria-label="Template name"
                          placeholder="e.g. Sales Landing Page V1"
                          value={templateName}
                          onChange={event => setTemplateName(event.target.value)}
                        />
                      </div>
                      <button
                        className="elementor-btn elementor-btn-primary"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px' }}
                        disabled={!templateName.trim() || !studio.permissions.templates}
                        onClick={async () => {
                          try {
                            const result = await api.post('/builder/templates', { name: templateName, document: doc });
                            setTemplates(current => [{ id: result.data.id, name: result.data.name }, ...current]);
                            setTemplateName('');
                          } catch (e) {
                            studio.setError(errorMessage(e));
                          }
                        }}
                      >
                        <Plus size={14} /> Save to My Templates
                      </button>
                    </div>
                  </div>

                  <div className="elementor-section-group">
                    <div className="elementor-group-title">
                      <span>Saved Templates ({templates.length})</span>
                    </div>
                    <div className="elementor-group-content">
                      {templates.length === 0 ? (
                        <p style={{ fontSize: '11px', color: 'var(--e-text-muted, #71717a)', margin: 0 }}>
                          No templates saved yet. Save a design above to reuse it anytime.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {templates.map(template => (
                            <div
                              key={template.id}
                              style={{
                                border: '1px solid var(--e-border, #e4e4e7)',
                                borderRadius: '4px',
                                padding: '10px',
                                background: 'var(--e-bg-alt, #fafafa)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--e-text, #18181b)' }}>
                                {template.name}
                              </span>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="elementor-btn"
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                  disabled={!studio.permissions.edit}
                                  onClick={async () => {
                                    try {
                                      const response = await api.get(`/builder/templates/${template.id}`);
                                      const templateDoc = migrateDocument(response.data.document);
                                      templateDoc.title = doc.title;
                                      templateDoc.slug = doc.slug;
                                      if (window.confirm('Replace the draft with this template? This is undoable.')) {
                                        studio.command({ type: 'replace', document: templateDoc });
                                      }
                                    } catch (e) {
                                      studio.setError(errorMessage(e));
                                    }
                                  }}
                                >
                                  Apply
                                </button>
                                <button
                                  className="elementor-btn"
                                  style={{ padding: '4px 8px', fontSize: '11px', color: '#ef4444' }}
                                  disabled={!studio.permissions.templates}
                                  onClick={async () => {
                                    if (!window.confirm('Delete this saved template? Pages using it are unaffected.')) return;
                                    try {
                                      await api.delete(`/builder/templates/${template.id}`);
                                      setTemplates(values => values.filter(item => item.id !== template.id));
                                    } catch (e) {
                                      studio.setError(errorMessage(e));
                                    }
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Elementor Signature Bottom Dock */}
        <footer className="elementor-bottom-dock">
          <div className="elementor-dock-left">
            <button
              className="elementor-dock-btn"
              title="Page Settings"
              onClick={() => { select(null); setPanel('settings'); }}
            >
              <Settings size={17} />
            </button>
            <button
              className={`elementor-dock-btn ${showFloatingNavigator ? 'active' : ''}`}
              title="Navigator"
              onClick={() => setShowFloatingNavigator(!showFloatingNavigator)}
            >
              <i className="fas fa-layer-group" style={{ fontSize: '15px' }} />
            </button>
            <button
              className="elementor-dock-btn"
              title="History"
              onClick={() => { select(null); setPanel('history'); }}
            >
              <History size={17} />
            </button>
            <button
              className="elementor-dock-btn"
              title={`Responsive Mode (${device})`}
              onClick={() => setDevice(device === 'desktop' ? 'tablet' : device === 'tablet' ? 'mobile' : 'desktop')}
            >
              <i className={device === 'desktop' ? 'eicon-device-desktop' : device === 'tablet' ? 'eicon-device-tablet' : 'eicon-device-mobile'} style={{ fontSize: '16px' }} />
            </button>
            <button
              className="elementor-dock-btn"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="elementor-dock-btn"
              title="Preview Changes"
              onClick={async () => {
                const preview = window.open('about:blank', '_blank');
                try {
                  await studio.save();
                  if (preview) preview.location.href = `/api/builder/pages/${id}/preview`;
                } catch {
                  preview?.close();
                }
              }}
            >
              <Eye size={17} />
            </button>
          </div>

          <div className="elementor-dock-right">
            <button
              className="elementor-publish-btn"
              disabled={!studio.permissions.publish || studio.conflict}
              onClick={publishDesign}
            >
              <span>{studio.publishedVersion ? 'Update' : 'Publish'}</span>
              <i className="eicon-chevron-up" />
            </button>
          </div>
        </footer>
      </aside>

      {/* Main Canvas Stage */}
      <section className="studio-stage">
        <div className="studio-stage-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button title="Save and exit" onClick={async () => { try { if (!(await saveCheckout())) return; await studio.save(); if (!studio.conflict) navigate('/pages'); } catch { /* save reports the error in Studio */ } }}>
              <ArrowLeft size={16} /> Exit
            </button>
            <span><span className="studio-live-dot" />{device} <span className="studio-muted">/ {width}px</span></span>
          </div>
          <div>
            <label>Zoom <select value={zoom} onChange={event => setZoom(Number(event.target.value))}>{[0.4, 0.5, 0.6, 0.7, 0.8, 1].map(value => <option value={value} key={value}>{Math.round(value * 100)}%</option>)}</select></label>
            <button onClick={() => setZoom(Math.min(1, Math.max(0.3, (window.innerWidth - 660) / width)))}>Fit</button>
          </div>
        </div>

        <CanvasBoundary resetKey={doc}>
          <Canvas
            document={doc}
            siteName={studio.siteName}
            sitePhone={studio.sitePhone}
            loops={dynamic.loops}
            selected={selected}
            select={select}
            command={studio.command}
            width={width}
            zoom={zoom}
            editable={studio.permissions.edit}
            device={device}
          />
        </CanvasBoundary>

        {/* Floating Navigator Modal (100% Identical to Elementor Navigator Screenshot) */}
        {showFloatingNavigator && (
          <div className="elementor-floating-navigator">
            <div className="elementor-navigator-header">
              <button className="elementor-nav-header-btn" title="Collapse All">
                <i className="eicon-frame-expand" />
              </button>
              <span className="elementor-navigator-title">Navigator</span>
              <button
                className="elementor-nav-close-btn"
                title="Close Navigator"
                onClick={() => setShowFloatingNavigator(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="elementor-navigator-body">
              <Navigator
                nodes={doc.rootNodes}
                selected={selected}
                select={select}
                command={studio.command}
                onContextMenu={(e, targetNode) => setContextMenu({ x: e.clientX, y: e.clientY, node: targetNode })}
              />
            </div>
            <div className="elementor-navigator-footer">
              <span className="elementor-nav-handle">•••</span>
            </div>
          </div>
        )}
      </section>
    </div>

    {contextMenu && (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu(null)}
        onEdit={() => select(contextMenu.node.id)}
        onDuplicate={() => { select(contextMenu.node.id); action('duplicate'); }}
        onCopy={() => { select(contextMenu.node.id); action('copy'); }}
        onPaste={() => action('paste')}
        onPasteStyle={() => { select(contextMenu.node.id); action('pasteStyle'); }}
        onResetStyle={() => { select(contextMenu.node.id); action('resetStyle'); }}
        onDelete={() => { select(contextMenu.node.id); action('remove'); }}
        hasClipboard={Boolean(clipboard)}
      />
    )}
  </div>;
}
