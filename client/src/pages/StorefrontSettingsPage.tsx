import { useEffect, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Image,
  Plus,
  Save,
  Store,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { MediaPicker } from '../components/MediaPicker';

const empty: any = {
  storeName: "NIX",
  announcement: "Cash on delivery across Bangladesh · Easy exchange",
  heroEyebrow: "THE NEW EDIT",
  heroTitle: "Everyday style, made effortless.",
  heroText:
    "Modern silhouettes, versatile essentials and considered details—made to live in.",
  phone: "01XXXXXXXXX",
  insideDhakaCharge: 60,
  subAreaCharge: 130,
  outsideDhakaCharge: 150,
  featuredCategories: [],
  heroImages: [],
  heroButtonLabel: "Shop now",
  heroButtonUrl: "/shop",
  aboutTitle: "Less noise. Better choices.",
  aboutText:
    "Our edit focuses on easy-to-style pieces, clear product options and a checkout that takes less than a minute.",
  footerText: "Thoughtful fashion for real life.",
  themeConfig: {},
};
const defaultMenu = [
  { label: "Home", url: "/" },
  { label: "Shop", url: "/shop" },
  { label: "About", url: "/about" },
  { label: "Track order", url: "/track-order" },
];
const menuPages = [
  { label: "Home", url: "/" }, { label: "Shop", url: "/shop" },
  { label: "About", url: "/about" }, { label: "Contact", url: "/contact" },
  { label: "Delivery information", url: "/delivery" }, { label: "Returns & exchange", url: "/returns" },
  { label: "FAQ", url: "/faq" }, { label: "Track order", url: "/track-order" },
  { label: "Privacy policy", url: "/privacy" }, { label: "Terms & conditions", url: "/terms" },
];
const defaultShowcase = [
  {
    id: "new-arrivals",
    eyebrow: "JUST IN",
    title: "New arrivals",
    source: "NEW",
    limit: 8,
    enabled: true,
  },
  {
    id: "most-selling",
    eyebrow: "CUSTOMER FAVOURITES",
    title: "Most selling",
    source: "BEST",
    limit: 4,
    enabled: true,
  },
];
const defaultFooter = [
  {
    heading: "Customer care",
    items: [
      { label: "Contact us", url: "/contact" },
      { label: "Delivery information", url: "/delivery" },
    ],
  },
  {
    heading: "Shop confidently",
    items: [
      { label: "Track your order", url: "/track-order" },
      { label: "Returns & exchange", url: "/returns" },
    ],
  },
];
const defaultCheckoutFields = [
  { key: 'name', label: 'Full name', type: 'text', enabled: true, required: true, custom: false },
  { key: 'phone', label: 'Mobile number', type: 'tel', enabled: true, required: true, custom: false },
  { key: 'email', label: 'Email address', type: 'email', enabled: true, required: false, custom: false },
  { key: 'address', label: 'Full delivery address', type: 'textarea', enabled: true, required: true, custom: false },
  { key: 'district', label: 'District', type: 'text', enabled: true, required: true, custom: false },
  { key: 'city', label: 'City / area', type: 'text', enabled: true, required: false, custom: false },
  { key: 'note', label: 'Order note', type: 'text', enabled: true, required: false, custom: false },
];

const Controls = ({ onUp, onDown, onRemove, upDisabled = false, downDisabled = false }: any) => (
  <div className="flex shrink-0 items-center gap-1">
    <button
      type="button"
      onClick={onUp}
      disabled={upDisabled}
      title="Move up"
      aria-label="Move up"
      className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      <ChevronUp className="h-4 w-4" />
    </button>
    <button
      type="button"
      onClick={onDown}
      disabled={downDisabled}
      title="Move down"
      aria-label="Move down"
      className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      <ChevronDown className="h-4 w-4" />
    </button>
    <button
      type="button"
      onClick={onRemove}
      title="Remove section"
      aria-label="Remove section"
      className="rounded-lg border border-slate-200 p-2 text-rose-500 hover:bg-rose-50 dark:border-slate-700"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  </div>
);
const swap = (list: any[], index: number, direction: number) => {
  const next = [...list],
    target = index + direction;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export const StorefrontSettingsPage = () => {
  const [form, setForm] = useState<any>(empty);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sitePages, setSitePages] = useState<Array<{ id: string; title: string; slug: string; status: string; systemKey?: string }>>([]);
  const [savedForm, setSavedForm] = useState<any>(empty);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [draggedCheckoutField, setDraggedCheckoutField] = useState<number | null>(null);
  useEffect(() => {
    api
      .get("/storefront/settings")
      .then((res) => {
        const loaded = {
          ...empty,
          ...res.data.settings,
          themeConfig: res.data.settings.themeConfig || {},
        };
        setForm(loaded);
        setSavedForm(loaded);
        setSettingsLoaded(true);
      })
      .catch(() => toast.error("Could not load storefront settings"));
    api
      .get("/inventory/categories")
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => undefined);
    api
      .get("/inventory/products", { params: { page: 1, limit: 100 } })
      .then(async (res) => {
        const all = [...(res.data.products || [])];
        const totalPages = res.data.pagination?.totalPages || 1;
        for (let page = 2; page <= totalPages; page += 1) {
          const next = await api.get("/inventory/products", { params: { page, limit: 100 } });
          all.push(...(next.data.products || []));
        }
        setProducts(all);
      })
      .catch(() => undefined);
    api.get('/storefront/manage/pages').then((res) => setSitePages(res.data.pages || [])).catch(() => undefined);
  }, []);
  const update = (key: string, value: any) =>
    setForm((state: any) => ({ ...state, [key]: value }));
  const config = form.themeConfig || {};
  const analytics = config.analytics || { googleAnalyticsId: "", metaPixelId: "" };
  const setConfig = (key: string, value: any) =>
    update("themeConfig", { ...config, [key]: value });
  const headerMenu = config.headerMenu
    ? config.headerMenu
    : defaultMenu;
  const showcase = config.showcase ?? defaultShowcase;
  const checkoutFields = config.checkoutFields ?? defaultCheckoutFields;
  const moveCheckoutField = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= checkoutFields.length || to >= checkoutFields.length) return;
    const reordered = [...checkoutFields];
    const [field] = reordered.splice(from, 1);
    reordered.splice(to, 0, field);
    setConfig('checkoutFields', reordered);
    setDraggedCheckoutField(null);
  };
  const footerItems = config.footerMenus?.[0]?.items || defaultFooter[0].items;
  const maintenancePage = sitePages.find((page) => page.systemKey === 'maintenance');
  const availableMenuPages = [
    ...menuPages.filter((item) => !['/about', '/delivery', '/returns', '/faq', '/privacy', '/terms'].includes(item.url)),
    ...sitePages.filter((page) => page.status === 'PUBLISHED' && page.systemKey !== 'maintenance').map((page) => ({ label: menuPages.find((item) => item.url === `/${page.systemKey}`)?.label || page.title, url: `/${page.slug}` })),
  ];
  const saveSection = async (id: string, fields: string[] = [], configFields: string[] = []) => {
    setSavingSection(id);
    try {
      const nextConfig = { ...(savedForm.themeConfig || {}) };
      for (const key of configFields) nextConfig[key] = config[key];
      if (configFields.includes("headerMenu")) nextConfig.headerMenu = headerMenu;
      if (configFields.includes("showcase")) nextConfig.showcase = showcase;
      if (configFields.includes("footerMenus")) nextConfig.footerMenus = [
        { heading: config.footerMenus?.[0]?.heading || "Customer care", items: footerItems },
        config.footerMenus?.[1] || defaultFooter[1],
      ];
      const payload = { ...savedForm, ...Object.fromEntries(fields.map((key) => [key, form[key]])), themeConfig: nextConfig };
      const response = await api.put("/storefront/settings", payload);
      const persisted = { ...payload, ...response.data.settings, themeConfig: response.data.settings.themeConfig || nextConfig };
      setSavedForm(persisted);
      toast.success("Section saved");
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Could not save this section");
    } finally {
      setSavingSection(null);
    }
  };
  const saveButton = (id: string, fields: string[] = [], configFields: string[] = []) => (
    <button type="button" onClick={() => saveSection(id, fields, configFields)} disabled={!settingsLoaded || savingSection !== null} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
      <Save className="h-4 w-4" />{savingSection === id ? "Saving…" : "Save"}
    </button>
  );
  const menuEditor = (
    title: string,
    items: any[],
    change: (next: any[]) => void,
    saveId: string,
  ) => (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-bold">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">
        Add custom links, reorder them, or choose a product category for a
        direct shop link.
      </p></div>{saveButton(saveId, [], [saveId === "headerMenu" ? "headerMenu" : "footerMenus"])}</div>
      <div className="mt-5 space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_1.4fr_170px_auto] dark:border-slate-700"
          >
            <input
              value={item.label}
              onChange={(e) =>
                change(
                  items.map((x, i) =>
                    i === index ? { ...x, label: e.target.value } : x,
                  ),
                )
              }
              className="field mt-0"
              placeholder="Label"
            />
            <input
              value={item.url}
              onChange={(e) =>
                change(
                  items.map((x, i) =>
                    i === index ? { ...x, url: e.target.value } : x,
                  ),
                )
              }
              className="field mt-0"
              placeholder="/shop"
            />
            <select
              value=""
              onChange={(e) => {
                const c = categories.find((row) => row.slug === e.target.value);
                if (c)
                  change(
                    items.map((x, i) =>
                      i === index
                        ? { label: c.name, url: `/shop?category=${c.slug}` }
                        : x,
                    ),
                  );
              }}
              className="field mt-0"
            >
              <option value="">Insert category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value=""
              onChange={(e) => {
                const [kind, id] = e.target.value.split(":");
                const product = kind === "product" ? products.find((row) => row.id === id) : undefined;
                const page = kind === "page" ? availableMenuPages.find((row) => row.url === id) : undefined;
                if (product) change(items.map((x, i) => i === index ? { ...x, label: product.name, url: `/product/${product.slug || product.name.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")}` } : x));
                if (page) change(items.map((x, i) => i === index ? { ...x, label: page.label, url: page.url } : x));
              }}
              className="field mt-0"
              aria-label="Insert product or page"
            >
              <option value="">Insert product or page</option>
              <optgroup label="Pages">{availableMenuPages.map((page) => <option key={page.url} value={`page:${page.url}`}>{page.label}</option>)}</optgroup>
              <optgroup label="Products">{products.map((product) => <option key={product.id} value={`product:${product.id}`}>{product.name}</option>)}</optgroup>
            </select>
            <Controls
              onUp={() => change(swap(items, index, -1))}
              onDown={() => change(swap(items, index, 1))}
              onRemove={() =>
                change(items.filter((_: any, i: number) => i !== index))
              }
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => change([...items, { label: "", url: "/shop" }])}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-600 hover:bg-emerald-50 dark:border-emerald-600/50 dark:text-emerald-400 dark:hover:bg-emerald-500/10 transition"
        >
          <Plus className="h-4 w-4" />
          Add menu item
        </button>
      </div>
    </section>
  );
  return (
    <form onSubmit={(event) => event.preventDefault()} className="storefront-editor mx-auto max-w-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            <Store className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /> Storefront editor
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manual controls for carousel banners, menus and product showcases.
          </p>
        </div>
        <span className="text-xs text-slate-500">Save each section independently.</span>
      </div>
      <div className="storefront-editor-layout columns-1 gap-6 xl:columns-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3"><h2 className="font-bold">Variation option style</h2>{saveButton("variation", [], ["variationStyle", "showColorName", "buyNowText"])}</div>
          <p className="mt-1 text-sm text-slate-500">Choose how color swatches and size choices look on product pages.</p>
          <div className="mt-4 flex flex-wrap gap-3">{([{ id: 'SOFT', label: 'Soft rounded' }, { id: 'CIRCLE', label: 'Circle' }, { id: 'SQUARE', label: 'Square' }] as const).map((style) => <button type="button" key={style.id} onClick={() => setConfig('variationStyle', style.id)} className={`rounded-xl border px-4 py-3 text-sm font-bold ${ (config.variationStyle || 'SOFT') === style.id ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700'}`}><span className={`mb-2 mx-auto block h-8 w-8 border-2 border-slate-700 bg-lime-300 ${style.id === 'SOFT' ? 'rounded-lg' : style.id === 'CIRCLE' ? 'rounded-full' : 'rounded-none'}`}/>{style.label}</button>)}</div>
          <label className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold dark:border-slate-700"><input type="checkbox" checked={config.showColorName !== false} onChange={(event) => setConfig('showColorName', event.target.checked)} />Show color names beside swatches</label>
          <label className="mt-4 block text-sm font-semibold">Buy Now button text<input maxLength={30} value={config.buyNowText || 'Buy now'} onChange={(event) => setConfig('buyNowText', event.target.value)} className="field mt-1" placeholder="Buy now"/><span className="mt-1 block text-xs font-normal text-slate-500">This label appears on the product page purchase button.</span></label>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">Checkout field editor</h2><p className="mt-1 text-sm text-slate-500">Choose what customers fill in and drag fields to reorder them. Name, mobile and delivery address are required. District can be switched off if you do not need it.</p></div><div className="flex shrink-0 gap-2">{saveButton("checkout", [], ["checkoutFields"])}<button type="button" onClick={() => setConfig('checkoutFields', [...checkoutFields, { key: `custom_${Date.now()}`, label: '', type: 'text', enabled: true, required: false, custom: true }])} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Plus className="h-4 w-4"/>Add field</button></div></div>
          <div className="mt-4 space-y-3">{checkoutFields.map((field: any, index: number) => <div key={field.key} draggable onDragStart={(event) => { setDraggedCheckoutField(index); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedCheckoutField !== null) moveCheckoutField(draggedCheckoutField, index); }} onDragEnd={() => setDraggedCheckoutField(null)} className={`grid cursor-grab gap-2 rounded-xl border border-slate-200 p-3 active:cursor-grabbing sm:grid-cols-[1.2fr_130px_auto_auto_auto] dark:border-slate-700 ${draggedCheckoutField === index ? 'opacity-50' : ''}`} title="Drag to reorder checkout fields"><label className="text-xs font-semibold">Field label<input value={field.label} onChange={(e) => setConfig('checkoutFields', checkoutFields.map((item: any, i: number) => i === index ? { ...item, label: e.target.value } : item))} className="field mt-1" placeholder="e.g. Preferred delivery time"/></label><label className="text-xs font-semibold">Input type<select value={field.type} disabled={!field.custom} onChange={(e) => setConfig('checkoutFields', checkoutFields.map((item: any, i: number) => i === index ? { ...item, type: e.target.value } : item))} className="field mt-1"><option value="text">Text</option><option value="textarea">Long text</option><option value="number">Number</option><option value="email">Email</option><option value="tel">Phone</option><option value="select">Dropdown</option></select></label>{field.custom && field.type === 'select' && <label className="text-xs font-semibold sm:col-span-2">Dropdown choices (comma separated)<input value={(field.options || []).join(', ')} onChange={(e) => setConfig('checkoutFields', checkoutFields.map((item: any, i: number) => i === index ? { ...item, options: e.target.value.split(',').map((option: string) => option.trim()).filter(Boolean) } : item))} className="field mt-1" placeholder="Morning, Afternoon, Evening"/></label>}<label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={field.enabled} disabled={['name','phone','address'].includes(field.key)} onChange={(e) => setConfig('checkoutFields', checkoutFields.map((item: any, i: number) => i === index ? { ...item, enabled: e.target.checked, required: e.target.checked ? item.required : false } : item))}/>Show</label><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={field.required} disabled={!field.enabled || ['name','phone','address'].includes(field.key)} onChange={(e) => setConfig('checkoutFields', checkoutFields.map((item: any, i: number) => i === index ? { ...item, required: e.target.checked } : item))}/>Required</label>{field.custom ? <button type="button" onClick={() => setConfig('checkoutFields', checkoutFields.filter((_: any, i: number) => i !== index))} className="self-center rounded-lg p-2 text-rose-500 hover:bg-rose-50" aria-label="Remove checkout field"><Trash2 className="h-4 w-4"/></button> : <span/>}</div>)}</div>
        </section>
        <section id="delivery-charges" className="scroll-mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3"><h2 className="font-bold">Delivery charges</h2>{saveButton("delivery", ["insideDhakaCharge", "subAreaCharge", "outsideDhakaCharge"])}</div>
          <p className="mt-1 text-sm text-slate-500">Set the checkout delivery fee for Dhaka, Dhaka sub areas, and other districts.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {([["insideDhakaCharge", "Inside Dhaka"], ["subAreaCharge", "Dhaka sub areas"], ["outsideDhakaCharge", "Outside Dhaka"]] as const).map(([key, label]) => <label key={key} className="text-sm font-semibold">{label} (৳)<input type="number" min="0" max="1000" value={form[key] ?? (key === "subAreaCharge" ? 130 : key === "outsideDhakaCharge" ? 150 : 60)} onChange={(event) => update(key, Number(event.target.value))} className="field" /></label>)}
          </div>
          <p className="mt-3 text-xs text-slate-500">Dhaka sub area rate applies when the area contains Savar, Ashulia, Tongi, Keraniganj, Amin Bazar, Hemayetpur, Dhamrai, Dohar, or Nawabganj.</p>
        </section>
        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
          <div className="md:col-span-2 flex items-start justify-between gap-3"><div><h2 className="font-bold">Store identity & messaging</h2><p className="mt-1 text-sm text-slate-500">Manage the public store name, support phone and messages shown across your storefront.</p></div>{saveButton("identity", ["storeName", "phone", "announcement", "footerText"])}</div>
          <label className="text-sm font-semibold">
            Store name
            <input
              value={form.storeName}
              onChange={(e) => update("storeName", e.target.value)}
              className="field"
            />
          </label>
          <label className="text-sm font-semibold">
            Announcement
            <input
              value={form.announcement}
              onChange={(e) => update("announcement", e.target.value)}
              className="field"
            />
          </label>
          <label className="text-sm font-semibold md:col-span-2">
            Customer support phone
            <input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="field"
              placeholder="01XXXXXXXXX"
              aria-describedby="support-phone-help"
            />
            <small id="support-phone-help" className="mt-1 block font-normal text-slate-500">A valid 11-digit Bangladesh number appears automatically on landing pages, contact links and thank-you pages.</small>
          </label>
          <label className="text-sm font-semibold md:col-span-2">
            Footer message
            <input
              value={form.footerText}
              onChange={(e) => update("footerText", e.target.value)}
              className="field"
            />
          </label>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">Maintenance page</h2><p className="mt-1 text-sm text-slate-500">Temporarily show a branded maintenance message to storefront visitors. Admin and order-management access stays available.</p></div>{saveButton("maintenance", [], ["maintenanceMode"])}</div>
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"><span><b>Maintenance mode</b><small className="mt-1 block text-slate-500">{config.maintenanceMode ? "On — storefront is paused" : "Off — storefront is open"}</small></span><input type="checkbox" role="switch" checked={Boolean(config.maintenanceMode)} onChange={(event) => setConfig("maintenanceMode", event.target.checked)} className="h-5 w-5 accent-emerald-600" /></label>
          <p className="mt-3 text-xs text-slate-500">The page title, message, image and HTML blocks can be edited in Pages. Keep maintenance mode off until the page is ready.</p>
          {maintenancePage && <Link to={`/pages/${maintenancePage.id}/edit`} className="mt-3 inline-flex rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700">Edit maintenance page</Link>}
        </section>
        <section className="rounded-2xl border border-slate-100/90 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-start justify-between gap-3"><div className="flex gap-3">
            <Image className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="font-bold">Hero carousel images</h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose visual banners directly from Media Gallery, then set
                their display order.
              </p>
            </div>
          </div>{saveButton("hero", ["heroEyebrow", "heroTitle", "heroText", "heroImages", "heroButtonLabel", "heroButtonUrl"])}</div>
          <MediaPicker title="Choose storefront carousel images" multiple maxSelection={8} value={form.heroImages.filter(Boolean)} onChange={urls => update('heroImages', urls)} />
          <div className="space-y-3">
            {form.heroImages.map((image: string, index: number) => (
              <div
                className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[90px_1fr_auto] dark:border-slate-700"
                key={`${image}-${index}`}
              >
                <img
                  src={image || "/images/catalog-fallback.png"}
                  alt=""
                  className="h-16 w-full rounded-lg bg-slate-100 object-cover"
                />
                <MediaPicker compact title={`Change carousel image ${index + 1}`} value={image ? [image] : []} onChange={(urls) => update('heroImages', form.heroImages.map((current: string, imageIndex: number) => imageIndex === index ? (urls[0] || current) : current))} />
                <Controls
                  onUp={() =>
                    update("heroImages", swap(form.heroImages, index, -1))
                  }
                  onDown={() =>
                    update("heroImages", swap(form.heroImages, index, 1))
                  }
                  onRemove={() =>
                    update(
                      "heroImages",
                      form.heroImages.filter(
                        (_: string, i: number) => i !== index,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold">
              CTA label
              <input
                value={form.heroButtonLabel}
                onChange={(e) => update("heroButtonLabel", e.target.value)}
                className="field"
              />
            </label>
            <label className="text-sm font-semibold">
              CTA link
              <input
                value={form.heroButtonUrl}
                onChange={(e) => update("heroButtonUrl", e.target.value)}
                className="field"
              />
            </label>
          </div>
        </section>
        {menuEditor("Header menu", headerMenu, (next) =>
          setConfig("headerMenu", next), "headerMenu")}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3"><h2 className="font-bold">Product showcase sections</h2>{saveButton("showcase", [], ["showcase"])}</div>
          <p className="mt-1 text-sm text-slate-500">
            Choose new arrivals, best-selling, or a product category. Use arrows
            to control top-to-bottom order.
          </p>
          <div className="mt-5 space-y-3">
            {showcase.map((section: any, index: number) => (
              <div
                className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                key={section.id}
              >
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <label className="min-w-0 text-xs font-semibold text-slate-600 dark:text-slate-300">Section title
                    <input value={section.title} onChange={(e) => setConfig("showcase", showcase.map((x: any, i: number) => i === index ? { ...x, title: e.target.value } : x))} className="field mt-1 w-full min-w-0" placeholder="e.g. New arrivals" />
                  </label>
                  <label className="min-w-0 text-xs font-semibold text-slate-600 dark:text-slate-300">Small label above title
                    <input value={section.eyebrow} onChange={(e) => setConfig("showcase", showcase.map((x: any, i: number) => i === index ? { ...x, eyebrow: e.target.value } : x))} className="field mt-1 w-full min-w-0" placeholder="e.g. JUST IN" />
                  </label>
                </div>
                <div className="flex min-w-0 flex-wrap items-end gap-3">
                  <label className="min-w-[150px] flex-[1_1_150px] text-xs font-semibold text-slate-600 dark:text-slate-300">Products from
                    <select value={section.source} onChange={(e) => setConfig("showcase", showcase.map((x: any, i: number) => i === index ? { ...x, source: e.target.value, category: e.target.value === "CATEGORY" ? x.category : undefined } : x))} className="field mt-1 w-full min-w-0">
                      <option value="NEW">New arrivals</option><option value="BEST">Best selling</option><option value="CATEGORY">Product category</option>
                    </select>
                  </label>
                  {section.source === "CATEGORY" && <label className="min-w-[150px] flex-[1_1_150px] text-xs font-semibold text-slate-600 dark:text-slate-300">Category
                    <select value={section.category || ""} onChange={(e) => setConfig("showcase", showcase.map((x: any, i: number) => i === index ? { ...x, category: e.target.value, title: x.title === "New product section" ? e.target.value : x.title } : x))} className="field mt-1 w-full min-w-0">
                      <option value="">Choose category</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </label>}
                  <label className="w-20 shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">Products
                    <input type="number" min="1" max="12" value={section.limit} onChange={(e) => setConfig("showcase", showcase.map((x: any, i: number) => i === index ? { ...x, limit: e.target.value === "" ? "" : Number(e.target.value) } : x))} onBlur={() => setConfig("showcase", showcase.map((x: any, i: number) => i === index ? { ...x, limit: Math.min(12, Math.max(1, Number(x.limit) || 1)) } : x))} className="field mt-1 w-full min-w-0 text-center" />
                  </label>
                  <label className="flex h-10 shrink-0 items-center gap-2 text-xs font-bold"><input type="checkbox" checked={section.enabled} onChange={(e) => setConfig("showcase", showcase.map((x: any, i: number) => i === index ? { ...x, enabled: e.target.checked } : x))} />Show</label>
                  <div className="ml-auto"><Controls upDisabled={index === 0} downDisabled={index === showcase.length - 1} onUp={() => setConfig("showcase", swap(showcase, index, -1))} onDown={() => setConfig("showcase", swap(showcase, index, 1))} onRemove={() => setConfig("showcase", showcase.filter((_: any, i: number) => i !== index))} /></div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setConfig("showcase", [
                ...showcase,
                {
                  id: `section-${Date.now()}`,
                  eyebrow: "CURATED EDIT",
                  title: "New product section",
                  source: "CATEGORY",
                  category: "",
                  limit: 4,
                  enabled: true,
                },
              ])
            }
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-600 hover:bg-emerald-50 dark:border-emerald-600/50 dark:text-emerald-400 dark:hover:bg-emerald-500/10 transition"
          >
            <Plus className="h-4 w-4" />
            Add product showcase
          </button>
        </section>
        <section className="rounded-2xl border border-slate-100/90 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-start justify-between gap-3"><div className="flex items-start gap-3">
            <BarChart3 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div><h2 className="font-bold">Analytics & marketing</h2><p className="mt-1 text-sm text-slate-500">Connect GA4 and Meta Pixel. Store visitors are asked for analytics and marketing consent before either script loads.</p></div>
          </div>{saveButton("analytics", [], ["analytics"])}</div>
          <div className="grid gap-4 md:grid-cols-2 items-start">
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                Google Analytics 4 (GA4 ID)
              </label>
              <input
                value={analytics.googleAnalyticsId || ""}
                onChange={(event) =>
                  setConfig("analytics", {
                    ...analytics,
                    googleAnalyticsId: event.target.value.trim(),
                  })
                }
                className="field mt-0"
                placeholder="G-XXXXXXXXXX"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                Meta Pixel ID
              </label>
              <input
                inputMode="numeric"
                value={analytics.metaPixelId || ""}
                onChange={(event) =>
                  setConfig("analytics", {
                    ...analytics,
                    metaPixelId: event.target.value.replace(/\D/g, ""),
                  })
                }
                className="field mt-0"
                placeholder="123456789012345"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-100 bg-purple-50/60 p-3 text-xs text-purple-900 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-300">
            <span>⚡ Server-side Meta Conversions API (CAPI), test event debugger, and custom events are configured in the dedicated Tracking dashboard.</span>
            <Link to="/tracking" className="inline-flex items-center font-bold text-purple-700 underline hover:text-purple-800 dark:text-purple-400">
              Open Tracking &amp; CAPI →
            </Link>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Tracks page views, product impressions, product views, search counts, add to cart, checkout starts, purchases, sign-ups and sign-ins. Customer contact details, passwords, addresses and order notes are never sent.</p>
        </section>
        {menuEditor("Footer menu", footerItems, (next) =>
          setConfig("footerMenus", [
            {
              heading: config.footerMenus?.[0]?.heading || "Customer care",
              items: next,
            },
            config.footerMenus?.[1] || defaultFooter[1],
          ]), "footerMenu",
        )}
      </div>
    </form>
  );
};
