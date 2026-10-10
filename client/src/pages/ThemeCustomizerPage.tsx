import { useEffect, useState } from 'react';
import { LayoutTemplate, Palette, RotateCcw, Save, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const defaults = {
  primaryColor: '#171815',
  accentColor: '#d8ff55',
  backgroundColor: '#f7f6f2',
  textColor: '#171815',
  mutedColor: '#707269',
  fontFamily: 'Manrope',
  buttonRadius: 'square',
  cardRadius: 'square',
  headerMode: 'STICKY',
  productDensity: 'COMFORTABLE',
  showAnnouncement: true,
  showTrustBar: true,
  showBestSellers: true,
  showAbout: true,
};

const presets = [
  {
    name: 'NIX Mono',
    values: defaults,
  },
  {
    name: 'Emerald Luxe',
    values: {
      ...defaults,
      primaryColor: '#064e3b',
      accentColor: '#10b981',
      backgroundColor: '#f0fdf4',
      textColor: '#022c22',
      mutedColor: '#047857',
      buttonRadius: 'soft',
      cardRadius: 'soft',
    },
  },
  {
    name: 'Sage Green',
    values: {
      ...defaults,
      primaryColor: '#25342c',
      accentColor: '#cce8b1',
      backgroundColor: '#f5f7f1',
      textColor: '#1a241f',
      mutedColor: '#66736b',
      buttonRadius: 'soft',
      cardRadius: 'soft',
    },
  },
  {
    name: 'Ink Blue',
    values: {
      ...defaults,
      primaryColor: '#17253f',
      accentColor: '#38bdf8',
      backgroundColor: '#f8fafc',
      textColor: '#0f172a',
      mutedColor: '#64748b',
      buttonRadius: 'soft',
      cardRadius: 'soft',
    },
  },
  {
    name: 'Rose Blush',
    values: {
      ...defaults,
      primaryColor: '#831843',
      accentColor: '#fb7185',
      backgroundColor: '#fff1f2',
      textColor: '#4c0519',
      mutedColor: '#9f1239',
      buttonRadius: 'round',
      cardRadius: 'round',
    },
  },
  {
    name: 'Warm Amber',
    values: {
      ...defaults,
      primaryColor: '#78350f',
      accentColor: '#f59e0b',
      backgroundColor: '#fffbeb',
      textColor: '#451a03',
      mutedColor: '#92400e',
      buttonRadius: 'soft',
      cardRadius: 'soft',
    },
  },
  {
    name: 'Midnight Dark',
    values: {
      ...defaults,
      primaryColor: '#09090b',
      accentColor: '#10b981',
      backgroundColor: '#18181b',
      textColor: '#fafafa',
      mutedColor: '#a1a1aa',
      buttonRadius: 'soft',
      cardRadius: 'soft',
    },
  },
  {
    name: 'Sunset Coral',
    values: {
      ...defaults,
      primaryColor: '#9a3412',
      accentColor: '#fb923c',
      backgroundColor: '#fff7ed',
      textColor: '#431407',
      mutedColor: '#c2410c',
      buttonRadius: 'round',
      cardRadius: 'soft',
    },
  },
  {
    name: 'Royal Purple',
    values: {
      ...defaults,
      primaryColor: '#3b0764',
      accentColor: '#c084fc',
      backgroundColor: '#faf5ff',
      textColor: '#2e1065',
      mutedColor: '#7e22ce',
      buttonRadius: 'soft',
      cardRadius: 'round',
    },
  },
  {
    name: 'Clean Slate',
    values: {
      ...defaults,
      primaryColor: '#0f172a',
      accentColor: '#64748b',
      backgroundColor: '#ffffff',
      textColor: '#0f172a',
      mutedColor: '#94a3b8',
      buttonRadius: 'soft',
      cardRadius: 'soft',
    },
  },
];

export const ThemeCustomizerPage = () => {
  const [settings, setSettings] = useState<any>(null);
  const [theme, setTheme] = useState<any>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/storefront/settings')
      .then((res) => {
        setSettings(res.data.settings);
        setTheme({ ...defaults, ...(res.data.settings.themeConfig || {}) });
      })
      .catch(() => toast.error('Could not load theme settings'));
  }, []);

  const update = (key: string, value: string | boolean) =>
    setTheme((current: any) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await api.put('/storefront/settings', {
        ...settings,
        themeConfig: { ...settings.themeConfig, ...theme },
      });
      toast.success('Theme published to storefront');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not publish theme');
    } finally {
      setSaving(false);
    }
  };

  if (!settings)
    return (
      <div className="flex h-[50vh] items-center justify-center text-sm text-slate-500">
        Loading theme customizer…
      </div>
    );

  const isPresetActive = (presetValues: typeof defaults) =>
    theme.primaryColor === presetValues.primaryColor &&
    theme.accentColor === presetValues.accentColor &&
    theme.backgroundColor === presetValues.backgroundColor;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            <Palette className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /> Theme Customizer
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            WordPress-style visual controls for your live storefront. Changes publish without code edits.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme(defaults)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Publishing…' : 'Publish theme'}
          </button>
        </div>
      </div>

      {/* Theme Presets Section - Compact Grid */}
      <section className="rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Theme Presets</h2>
            <p className="text-[11px] text-slate-400">
              One-click designer colour schemes tailored for lifestyle, fashion, and retail
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {presets.length} Presets
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          {presets.map((preset) => {
            const active = isPresetActive(preset.values);
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => setTheme({ ...theme, ...preset.values })}
                className={`group relative rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                  active
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20 dark:bg-emerald-950/20 dark:border-emerald-500/80'
                    : 'border-slate-200/80 bg-slate-50/50 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700'
                }`}
              >
                {/* Compact Color Swatch */}
                <span className="mb-2 flex h-6 overflow-hidden rounded-lg border border-black/5 shadow-inner dark:border-white/10">
                  <i className="flex-1" style={{ background: preset.values.primaryColor }} />
                  <i className="flex-1" style={{ background: preset.values.accentColor }} />
                  <i className="flex-1" style={{ background: preset.values.backgroundColor }} />
                </span>

                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                    {preset.name}
                  </span>
                  {active && (
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Settings & Live Preview */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Colour Palette Controls */}
          <section className="rounded-2xl border border-slate-100/90 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Colour Palette</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['primaryColor', 'Primary / Buttons'],
                ['accentColor', 'Accent & Badges'],
                ['backgroundColor', 'Page Background'],
                ['textColor', 'Text Colour'],
                ['mutedColor', 'Muted Text'],
              ].map(([key, label]) => (
                <label
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200"
                  key={key}
                >
                  {label}
                  <span className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent"
                    />
                    <code className="text-[11px] font-mono font-normal text-slate-400">
                      {theme[key]}
                    </code>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* Typography & Layout */}
          <section className="rounded-2xl border border-slate-100/90 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
              Typography & Layout
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Font Family
                <select
                  value={theme.fontFamily}
                  onChange={(e) => update('fontFamily', e.target.value)}
                  className="field h-9 text-xs"
                >
                  <option>Manrope</option>
                  <option>Inter</option>
                  <option>Plus Jakarta Sans</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Header Behavior
                <select
                  value={theme.headerMode}
                  onChange={(e) => update('headerMode', e.target.value)}
                  className="field h-9 text-xs"
                >
                  <option value="STICKY">Sticky header</option>
                  <option value="STATIC">Static header</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Button Shape
                <select
                  value={theme.buttonRadius}
                  onChange={(e) => update('buttonRadius', e.target.value)}
                  className="field h-9 text-xs"
                >
                  <option value="square">Square</option>
                  <option value="soft">Soft corners</option>
                  <option value="round">Pill</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Product-card Density
                <select
                  value={theme.productDensity}
                  onChange={(e) => update('productDensity', e.target.value)}
                  className="field h-9 text-xs"
                >
                  <option value="COMFORTABLE">Comfortable</option>
                  <option value="COMPACT">Compact</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Card Shape
                <select
                  value={theme.cardRadius}
                  onChange={(e) => update('cardRadius', e.target.value)}
                  className="field h-9 text-xs"
                >
                  <option value="square">Square</option>
                  <option value="soft">Soft corners</option>
                  <option value="round">Rounded</option>
                </select>
              </label>
            </div>
          </section>

          {/* Homepage Sections */}
          <section className="rounded-2xl border border-slate-100/90 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
              Homepage Sections
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['showAnnouncement', 'Show announcement bar'],
                ['showTrustBar', 'Show delivery promise bar'],
                ['showBestSellers', 'Show best sellers section'],
                ['showAbout', 'Show brand story section'],
              ].map(([key, label]) => (
                <label
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100/60 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200"
                  key={key}
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={theme[key]}
                    onChange={(e) => update(key, e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Live Preview Aside */}
        <aside className="h-fit rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <LayoutTemplate className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Live Style Preview
          </div>
          <div
            className="overflow-hidden rounded-xl border border-slate-200 shadow-sm transition-all"
            style={{
              background: theme.backgroundColor,
              color: theme.textColor,
              fontFamily: theme.fontFamily,
            }}
          >
            <div
              className="p-3 text-center text-[10px] font-bold tracking-wider"
              style={{ background: theme.primaryColor, color: '#fff' }}
            >
              YOUR STORE
            </div>
            <div className="space-y-4 p-4">
              <div
                className="h-20 rounded-lg shadow-sm"
                style={{
                  background: theme.primaryColor,
                  borderRadius:
                    theme.cardRadius === 'round'
                      ? 18
                      : theme.cardRadius === 'soft'
                      ? 10
                      : 0,
                }}
              />
              <div className="h-3 w-3/4 rounded" style={{ background: theme.textColor }} />
              <div
                className="h-2 w-full rounded"
                style={{ background: theme.mutedColor, opacity: 0.45 }}
              />
              <button
                className="w-full py-2 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
                style={{
                  background: theme.primaryColor,
                  borderRadius:
                    theme.buttonRadius === 'round'
                      ? 999
                      : theme.buttonRadius === 'soft'
                      ? 10
                      : 0,
                }}
              >
                Shop now
              </button>
              <span
                className="block h-4 w-12 rounded-full shadow-sm"
                style={{ background: theme.accentColor }}
              />
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Selected colours and styles apply instantly to your storefront header, product cards, banners, and checkout.
          </p>
        </aside>
      </div>
    </div>
  );
};
