import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  HelpCircle,
  Plus,
  RefreshCw,
  Save,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/api";

interface CustomEventItem {
  name: string;
  selector?: string;
  ga4Event?: string;
  metaEvent?: string;
  metaEventType?: "custom" | "standard";
}

interface TrackingConfig {
  googleAnalyticsId: string;
  metaPixelId: string;
  metaCapiAccessToken: string;
  metaCapiAccessTokenSet: boolean;
  metaCapiTestCode: string;
  customEvents: CustomEventItem[];
}

export const TrackingPage: React.FC = () => {
  const [config, setConfig] = useState<TrackingConfig>({
    googleAnalyticsId: "",
    metaPixelId: "",
    metaCapiAccessToken: "",
    metaCapiAccessTokenSet: false,
    metaCapiTestCode: "",
    customEvents: [],
  });

  const [initialTokenSet, setInitialTokenSet] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingCapi, setTestingCapi] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/storefront/tracking/config");
      if (data?.config) {
        setConfig(data.config);
        setInitialTokenSet(data.config.metaCapiAccessTokenSet);
        if (!data.config.metaCapiAccessTokenSet) {
          setTokenInput("");
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load tracking configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    for (const event of config.customEvents) {
      if (!event.name.trim()) { toast.error("Each custom event needs a name."); return; }
      if (event.selector?.trim()) { try { document.querySelector(event.selector); } catch { toast.error(`Invalid CSS selector for ${event.name}.`); return; } }
    }
    setSaving(true);
    setTestResult(null);
    try {
      const payload: any = {
        googleAnalyticsId: config.googleAnalyticsId,
        metaPixelId: config.metaPixelId,
        metaCapiTestCode: config.metaCapiTestCode,
        customEvents: config.customEvents,
      };

      if (tokenInput.trim()) {
        payload.metaCapiAccessToken = tokenInput.trim();
      }

      const { data } = await api.put("/storefront/tracking/config", payload);
      toast.success(data.message || "Tracking configuration saved successfully!");
      await loadConfig();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save tracking settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestCapi = async () => {
    setTestingCapi(true);
    setTestResult(null);
    try {
      const { data } = await api.post("/storefront/tracking/test-capi");
      setTestResult({ success: true, message: data.message });
      toast.success("Meta CAPI test event delivered successfully!");
    } catch (err: any) {
      const msg = err.response?.data?.message || "Test failed";
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingCapi(false);
    }
  };

  const addCustomEvent = () => {
    setConfig((prev) => ({
      ...prev,
      customEvents: [
        ...prev.customEvents,
        {
          name: "",
          selector: "",
          ga4Event: "",
          metaEvent: "",
          metaEventType: "custom",
        },
      ],
    }));
  };

  const updateCustomEvent = (index: number, patch: Partial<CustomEventItem>) => {
    setConfig((prev) => {
      const updated = [...prev.customEvents];
      updated[index] = { ...updated[index], ...patch };
      return { ...prev, customEvents: updated };
    });
  };

  const removeCustomEvent = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      customEvents: prev.customEvents.filter((_, i) => i !== index),
    }));
  };

  const isGaActive = Boolean(config.googleAnalyticsId?.trim());
  const isMetaActive = Boolean(config.metaPixelId?.trim());
  const isCapiActive = Boolean(config.metaPixelId?.trim() && (initialTokenSet || tokenInput.trim()));

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/storefront"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            <ArrowLeft size={14} /> Back to Storefront
          </Link>
          <div className="mt-2 flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Tracking &amp; Conversion API (CAPI)
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Zap size={11} className="text-emerald-500" /> Native Server Engine
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Configure Google Analytics 4, Meta Pixel, and direct server-side Meta Conversions API (CAPI) running natively on your own server.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadConfig}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            title="Reload configuration"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* GA4 Status */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Google Analytics 4</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isGaActive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isGaActive ? "bg-emerald-500" : "bg-slate-400"}`} />
              {isGaActive ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
            {config.googleAnalyticsId || "Not Connected"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Standard E-commerce events enabled</p>
        </div>

        {/* Meta Pixel Status */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Meta Pixel (Browser)</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isMetaActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isMetaActive ? "bg-blue-500" : "bg-slate-400"}`} />
              {isMetaActive ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
            {config.metaPixelId || "Not Connected"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Advanced Matching ready</p>
        </div>

        {/* Meta CAPI Status */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Meta Conversions API (CAPI)</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isCapiActive
                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isCapiActive ? "bg-purple-500" : "bg-amber-400"}`} />
              {isCapiActive ? "Server-to-Server Active" : "Token Needed"}
            </span>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
            {isCapiActive ? "Native Node.js Server" : "Not Configured"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Direct Express API — No 3rd Party</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: Google Analytics 4 */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                <Flame size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Google Analytics 4 (GA4)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Track visits, product views, searches, cart actions, and checkout funnel in Google Analytics.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 max-w-md space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Measurement ID (G-XXXXXXXXXX)
            </label>
                      <input
              type="text"
              value={config.googleAnalyticsId}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, googleAnalyticsId: e.target.value.trim().toUpperCase() }))
              }
              placeholder="G-ABC123XYZ0"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                      />
            <p className="text-[11px] text-slate-500">
              Found in Google Analytics &gt; Admin &gt; Data Streams &gt; Web stream details.
            </p>
          </div>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
            <p className="font-semibold text-slate-800 dark:text-slate-200">Automatically tracked GA4 events:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                "page_view",
                "view_item_list",
                "view_item",
                "search",
                "add_to_cart",
                "view_cart",
                "begin_checkout",
                "add_payment_info",
                "purchase",
                "sign_up",
                "login",
              ].map((ev) => (
                <span
                  key={ev}
                  className="rounded-md bg-white px-2 py-0.5 text-[11px] font-mono font-medium text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-300"
                >
                  {ev}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              * Storefront cookie consent mode is respected. Enhanced Measurement (scrolls, outbound clicks) operates per your GA4 property settings.
            </p>
          </div>
        </section>

        {/* SECTION 2: Meta Pixel (Browser) */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <Activity size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Meta Pixel (Browser-Side)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Standard client-side Facebook / Meta pixel tracking for retargeting and ad conversion optimization.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 max-w-md space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Meta Pixel ID (Numeric dataset ID)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={config.metaPixelId}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, metaPixelId: e.target.value.replace(/\D/g, "") }))
              }
              placeholder="123456789012345"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
            <p className="text-[11px] text-slate-500">
              Found in Meta Events Manager &gt; Data Sources &gt; Settings &gt; Dataset ID.
            </p>
          </div>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
              <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>Advanced Matching &amp; Deduplication Built-in</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Customer phone numbers, emails, and names entered during checkout are saved and securely matched during subsequent sessions to boost your Meta Event Match Quality score.
            </p>
          </div>
        </section>

        {/* SECTION 3: Meta Conversions API (CAPI) */}
        <section className="rounded-2xl border border-purple-200/80 bg-white p-6 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-purple-50 p-2.5 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                <Server size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Meta Conversions API (Server-Side CAPI)
                  </h2>
                  <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                    Self-Hosted (No 3rd Party)
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Direct server-to-server tracking executed by your own Express backend. Bypasses ad-blockers and iOS privacy restrictions.
                </p>
              </div>
            </div>

            {/* Test CAPI Button */}
            <button
              type="button"
              onClick={handleTestCapi}
              disabled={testingCapi || !config.metaPixelId || (!initialTokenSet && !tokenInput.trim())}
              className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-40 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
            >
              <Send size={13} className={testingCapi ? "animate-spin" : ""} />
              {testingCapi ? "Sending Test Event..." : "Send Test Event to Meta"}
            </button>
          </div>

          {/* Test Result Message */}
          {testResult && (
            <div
              className={`mt-4 rounded-xl p-3.5 text-xs font-medium ${
                testResult.success
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold">{testResult.success ? "✓ Test Success:" : "✕ Test Failed:"}</span>
                <span>{testResult.message}</span>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {/* Access Token */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Meta System User Access Token
                </label>
                {initialTokenSet && !tokenInput && (
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    ✓ Token is set in database
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={
                    initialTokenSet
                      ? config.metaCapiAccessToken || "•••••••••••••••• (Leave blank to keep current token)"
                      : "Paste EAAB... token from Meta Events Manager"
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-10 text-sm font-mono text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Generate in Meta Events Manager &gt; Settings &gt; Conversions API &gt; "Generate access token".
              </p>
            </div>

            {/* Test Event Code */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Test Event Code <span className="font-normal text-slate-400">(Optional for debugging)</span>
              </label>
              <input
                type="text"
                value={config.metaCapiTestCode}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, metaCapiTestCode: e.target.value.trim() }))
                }
                placeholder="TEST12345"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
              <p className="text-[11px] text-slate-500">
                From Meta Events Manager &gt; Test Events tab. Clear this field before running live ad campaigns.
              </p>
            </div>
          </div>

          {/* Architecture Highlights */}
          <div className="mt-5 grid gap-3 rounded-xl border border-purple-100 bg-purple-50/50 p-4 text-xs dark:border-purple-900/30 dark:bg-purple-950/20 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                ⚡ 100% In-House Server Processing
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Your Node.js/Express server calls Meta Graph API <code className="font-mono text-purple-700 dark:text-purple-300">v21.0</code> directly on every order placement. No Stape.io or external cloud containers required.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                🎯 Dual Deduplication via event_id
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Both browser pixel and server CAPI dispatch events with the exact same <code className="font-mono text-purple-700 dark:text-purple-300">event_id</code>, ensuring Meta deduplicates without duplicate purchase metrics.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                🔒 SHA-256 Hashing &amp; BD Normalization
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Phone numbers (normalized to E.164: +880...), email addresses, customer names, and cities are automatically hashed per Meta's privacy spec before transmission.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                🍪 _fbc and _fbp Cookie Forwarding
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                First-party Facebook click IDs (<code className="font-mono text-purple-700 dark:text-purple-300">_fbc</code>) and browser IDs (<code className="font-mono text-purple-700 dark:text-purple-300">_fbp</code>) are captured at checkout and forwarded with server events.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: Custom Events */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Custom Event Tracking
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Define custom event identifiers for banners, WhatsApp button clicks, promotional popups, or custom funnels.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={addCustomEvent}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            >
              <Plus size={14} /> Add Custom Event
            </button>
          </div>

          {config.customEvents.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
              <Sparkles className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                No custom events registered
              </p>
              <p className="mt-1 text-xs text-slate-400">
                All standard e-commerce events (PageView, AddToCart, Purchase, etc.) are already tracked automatically.
              </p>
              <button
                type="button"
                onClick={addCustomEvent}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
              >
                <Plus size={13} /> Add first custom event
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {config.customEvents.map((event, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="min-w-[140px] flex-1">
                    <label className="block text-[11px] font-semibold text-slate-500">
                      Event Identifier (Key)
                    </label>
                    <input
                      type="text"
                      value={event.name}
                      onChange={(e) => updateCustomEvent(idx, { name: e.target.value.trim() })}
                      placeholder="e.g. promo_banner_click"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="min-w-[180px] flex-1">
                    <label className="block text-[11px] font-semibold text-slate-500">Click selector</label>
                    <input type="text" value={event.selector || ""} onChange={(e) => updateCustomEvent(idx, { selector: e.target.value })} placeholder='.checkout-button or [data-track="whatsapp"]' className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white" />
                    <span className="text-[10px] text-slate-400">Track clicks on matching storefront elements</span>
                  </div>

                  <div className="min-w-[140px] flex-1">
                    <label className="block text-[11px] font-semibold text-slate-500">
                      GA4 Event Name
                    </label>
                    <input
                      type="text"
                      value={event.ga4Event || ""}
                      onChange={(e) => updateCustomEvent(idx, { ga4Event: e.target.value.trim() })}
                      placeholder="promo_banner_click"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="min-w-[140px] flex-1">
                    <label className="block text-[11px] font-semibold text-slate-500">
                      Meta Event Name
                    </label>
                    <input
                      type="text"
                      value={event.metaEvent || ""}
                      onChange={(e) => updateCustomEvent(idx, { metaEvent: e.target.value.trim() })}
                      placeholder="BannerClick"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="w-28">
                    <label className="block text-[11px] font-semibold text-slate-500">
                      Meta Type
                    </label>
                    <select
                      value={event.metaEventType || "custom"}
                      onChange={(e) =>
                        updateCustomEvent(idx, { metaEventType: e.target.value as any })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    >
                      <option value="custom">trackCustom</option>
                      <option value="standard">track (Standard)</option>
                    </select>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => removeCustomEvent(idx)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                      title="Remove event"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Developer snippet note */}
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/30">
            <span className="font-semibold text-slate-700 dark:text-slate-300">How to call in storefront code:</span>
            <code className="mt-1 block rounded bg-slate-900 p-2 font-mono text-[11px] text-emerald-400 dark:bg-black">
              import &#123; trackCustomEvent &#125; from './analytics';<br />
              trackCustomEvent('promo_banner_click', &#123; banner_id: 'summer_sale_2026' &#125;);
            </code>
          </div>
        </section>

        {/* Bottom Save Bar */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">
            Changes are saved to your store database and take effect immediately.
          </p>
          <button
            type="submit"
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save All Settings"}
          </button>
        </div>
      </form>
    </div>
  );
};
