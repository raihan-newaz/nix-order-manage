import { CSSProperties, FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronRight, ClipboardCheck, Heart, Menu, Minus, PackageCheck, Plus, Search, ShieldCheck, ShoppingBag, Trash2, Truck, UserRound, X } from 'lucide-react';
import { addCustomerWishlist, getCachedLandingDesign, getCachedProduct, getCachedProducts, getCachedStorefrontSettings, getCachedStorePage, getLandingDesign, getPaymentResult, getProduct, getStorePage, getStorefrontSettings, listProducts, placeOrder, trackOrder, type LandingDesign } from './api';
import { useCart } from './context/CartContext';
import { useCustomerAuth } from './context/CustomerAuthContext';
import { defaultStorefrontSettings, publicSupportPhone } from './store-config';
import type { CheckoutField, DeliveryArea, OrderResult, Product, StorePage, StorefrontSettings, Variant } from './types';
import { CustomerAccountPage, CustomerAuthPage } from './CustomerAccountPages';
import { LandingPage } from './LandingPage';
import { LandingThankYouPage } from './LandingThankYouPage';
import { configureAnalytics, generateEventId, getAnalyticsConsent, getMetaCookies, isTrackingAllowed, openAnalyticsPreferences, productAnalyticsItem, setAnalyticsConsent, trackAnalyticsEvent, trackCustomEvent, trackPurchaseOnce } from './analytics';

const money = (value: number) => `৳${Math.round(value).toLocaleString('en-BD')}`;
const deliveryAreaOptions: Array<{ value: DeliveryArea; label: string; description: string }> = [
  { value: 'OUTSIDE_DHAKA', label: 'Outside Dhaka', description: 'Nationwide delivery' },
  { value: 'SUB_AREA', label: 'Dhaka sub area', description: 'Savar, Tongi and nearby areas' },
  { value: 'DHAKA_CITY', label: 'Dhaka city', description: 'Inside Dhaka city' },
];
const deliveryFeeForArea = (area: DeliveryArea, settings: StorefrontSettings) => area === 'OUTSIDE_DHAKA' ? settings.outsideDhakaCharge : area === 'SUB_AREA' ? settings.subAreaCharge : settings.insideDhakaCharge;
const fallbackImage = '/images/catalog-fallback.png';
const productPath = (product: Product) => `/product/${encodeURIComponent(product.slug || product.id)}`;
const fallbackCheckoutFields: CheckoutField[] = [
  { key:'name', label:'Full name', type:'text', enabled:true, required:true }, { key:'phone', label:'Mobile number', type:'tel', enabled:true, required:true },
  { key:'email', label:'Email address', type:'email', enabled:true, required:false }, { key:'address', label:'Full delivery address', type:'textarea', enabled:true, required:true },
  { key:'district', label:'District', type:'text', enabled:true, required:true }, { key:'city', label:'City / area', type:'text', enabled:true, required:false }, { key:'note', label:'Order note', type:'text', enabled:true, required:false },
];

const resetStorefrontScroll = () => {
  const root = document.documentElement;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);
  document.body.scrollTop = 0;
};

// Reset only after React commits the next route. Resetting inside pushState
// visibly scrolls the old page to the top before the new page appears.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    return () => { history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    resetStorefrontScroll();
  }, [pathname]);
  return null;
}

function AnalyticsLayer({ settings }: { settings: StorefrontSettings }) {
  const { pathname } = useLocation();
  const [consent, setConsent] = useState(getAnalyticsConsent);
  const lastTrackedPath = useRef('');
  useEffect(() => {
    const sync = (event: Event) => setConsent((event as CustomEvent).detail ?? getAnalyticsConsent());
    window.addEventListener('nix-analytics-consent', sync);
    return () => window.removeEventListener('nix-analytics-consent', sync);
  }, []);
  useEffect(() => {
    const configured = settings.themeConfig.analytics?.customEvents || [];
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      for (const item of configured) {
        if (!item.selector || !item.name) continue;
        try {
          if (!target.closest(item.selector)) continue;
          trackCustomEvent(item.name, { page_path: location.pathname, element_text: (target.closest(item.selector)?.textContent || '').trim().slice(0, 100) }, item);
          break;
        } catch { /* malformed selectors are ignored until corrected in admin */ }
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [settings.themeConfig.analytics?.customEvents]);
  useEffect(() => {
    configureAnalytics(settings.themeConfig.analytics);
    if (!isTrackingAllowed() || lastTrackedPath.current === pathname || pathname === '/payment/result' && new URLSearchParams(window.location.search).has('token')) return;
    lastTrackedPath.current = pathname;
    const safePath = pathname.replace(/^\/product\/[^/]+/, '/product/:id').replace(/^\/order\/[^/]+/, '/order/:orderNumber');
    trackAnalyticsEvent('page_view', { page_path: safePath, page_location: `${window.location.origin}${safePath}`, page_title: document.title });
  }, [pathname, settings.themeConfig.analytics, consent]);
  if (consent) return null;
  return <aside className="analytics-consent" role="dialog" aria-label="Privacy preferences"><div><b>Privacy preferences</b><p>Allow analytics and marketing measurement. If enabled, store activity and limited order identifiers may be shared with Google and Meta; Meta may receive hashed contact details for completed orders.</p></div><div className="analytics-consent-actions"><button type="button" onClick={() => setAnalyticsConsent('rejected')}>Reject</button><button type="button" className="accept" onClick={() => setAnalyticsConsent('accepted')}>Allow analytics</button></div></aside>;
}

function Header({ settings }: { settings: StorefrontSettings }) {
  const { count } = useCart();
  const { customer } = useCustomerAuth();
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTouched = useRef(false);
  const mobileSearchInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const configuredMenu = settings.themeConfig.headerMenu?.length ? settings.themeConfig.headerMenu : [{ label: 'Shop', url: '/shop' }, { label: 'About', url: '/about' }, { label: 'Track order', url: '/track-order' }, { label: 'Help', url: '/faq' }];
  const menuItems = [{ label: 'Home', url: '/' }, ...configuredMenu.filter((item) => item.url !== '/' && item.label.toLowerCase() !== 'home'), { label: 'Account', url: customer ? '/account' : '/signin' }];
  useEffect(() => { if (mobileSearchOpen) mobileSearchInput.current?.focus(); }, [mobileSearchOpen]);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (search.trim().length >= 2) trackAnalyticsEvent('search', { search_term: search.trim().slice(0, 100), search_results: searchResults.length });
    if (searchResults.length === 1) { setOpen(false); setMobileSearchOpen(false); navigate(productPath(searchResults[0])); }
  };
  useEffect(() => {
    if (!searchTouched.current) return;
    const query = search.trim();
    if (query.length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    let active = true;
    const timer = window.setTimeout(() => {
      listProducts(`?search=${encodeURIComponent(query)}&limit=6`).then(({ products }) => { if (active) setSearchResults(products.slice(0, 6)); }).catch(() => { if (active) setSearchResults([]); }).finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search]);
  const searchResultsView = search.trim().length >= 2 && (searching || searchResults.length > 0) ? <div className="header-search-results">{searching ? <span className="search-result-status">Searching…</span> : searchResults.length ? searchResults.map((product) => <button type="button" key={product.id} onClick={() => { setOpen(false); setSearch(''); setSearchResults([]); navigate(productPath(product)); }}><img src={product.image || fallbackImage} alt=""/><span><b>{product.name}</b><small>{product.category} · {money(product.salePrice)}</small></span><ArrowRight size={14}/></button>) : <span className="search-result-status">No products found</span>}</div> : null;
  return <>
    {settings.themeConfig.showAnnouncement && <div className="announcement">{settings.announcement}</div>}
    <header className="site-header">
      <button className="menu" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>{open ? <X /> : <Menu />}</button>
      <Link className="brand" to="/" aria-label={`${settings.storeName} home`}>{settings.storeName}</Link>
      <nav className={open ? 'nav open' : 'nav'}>
        {menuItems.map((item) => <NavLink key={`${item.label}-${item.url}`} to={item.url} onClick={() => setOpen(false)}>{item.label}</NavLink>)}
      </nav>
      <div className="header-actions">
        <div className="desktop-search-wrap"><form className="desktop-header-search" onSubmit={submitSearch}><Search size={16} /><input value={search} onChange={(event) => { searchTouched.current = true; setSearch(event.target.value); }} placeholder="Search products" aria-label="Search products" /><button type="submit" aria-label="Submit search"><ArrowRight size={15} /></button></form>{!mobileSearchOpen && searchResultsView}</div>
        <button type="button" className="mobile-search-toggle" onClick={() => setMobileSearchOpen((value) => !value)} aria-label={mobileSearchOpen ? 'Close search' : 'Search products'} aria-expanded={mobileSearchOpen}>{mobileSearchOpen ? <X size={19}/> : <Search size={19}/>}</button>
        <Link className="account-link" to={customer ? '/account' : '/signin'} aria-label={customer ? 'My account' : 'Sign in'}><UserRound size={19}/></Link>
        <Link className="bag" to="/cart" aria-label={`Cart with ${count} items`}><ShoppingBag size={20} />{count > 0 && <span>{count}</span>}</Link>
      </div>
      <div className={mobileSearchOpen ? 'mobile-search-panel open' : 'mobile-search-panel'}><form className="mobile-menu-search" onSubmit={submitSearch}><Search size={17} /><input ref={mobileSearchInput} value={search} onChange={(event) => { searchTouched.current = true; setSearch(event.target.value); }} placeholder="What are you looking for?" aria-label="Search products" /><button type="submit" aria-label="Submit search"><ArrowRight size={16} /></button></form>{mobileSearchOpen && searchResultsView}</div>
      <button type="button" className={open ? 'menu-backdrop visible' : 'menu-backdrop'} onPointerDown={() => setOpen(false)} aria-label="Close menu" />
    </header>
  </>;
}

function Layout({ children, settings }: { children: React.ReactNode; settings: StorefrontSettings }) {
  const theme = settings.themeConfig;
  const themeStyle = { '--ink': theme.primaryColor, '--accent': theme.accentColor, '--paper': theme.backgroundColor, '--muted': theme.mutedColor, '--theme-font': theme.fontFamily, '--button-radius': theme.buttonRadius === 'round' ? '999px' : theme.buttonRadius === 'soft' ? '12px' : '0px', '--card-radius': theme.cardRadius === 'round' ? '22px' : theme.cardRadius === 'soft' ? '12px' : '0px' } as CSSProperties;
  const footerMenus = theme.footerMenus?.length ? theme.footerMenus : [{ heading: 'Customer care', items: [{ label: 'Contact us', url: '/contact' }, { label: 'Delivery information', url: '/delivery' }, { label: 'Exchange & returns', url: '/returns' }, { label: 'Frequently asked questions', url: '/faq' }] }, { heading: 'Shop confidently', items: [{ label: 'Track your order', url: '/track-order' }, { label: 'Privacy policy', url: '/privacy' }, { label: 'Terms & conditions', url: '/terms' }] }];
  return <div className={`store-theme ${theme.headerMode === 'STATIC' ? 'header-static' : ''} ${theme.productDensity === 'COMPACT' ? 'product-density-compact' : ''}`} style={themeStyle}><Header settings={settings} /><main>{children}</main><footer>
    <div><Link className="brand light" to="/">{settings.storeName}</Link><p>{settings.footerText}</p><Link className="footer-link" to="/shop">Shop the collection <ArrowRight size={15} /></Link></div>
    {footerMenus.slice(0, 2).map((menu) => <div key={menu.heading}><b>{menu.heading}</b>{menu.items.map((item) => <Link key={`${item.label}-${item.url}`} to={item.url}>{item.label}</Link>)}</div>)}
    <div className="footer-legal-column"><b>Information</b><nav className="footer-legal-links" aria-label="Store information"><Link to="/about">About</Link><Link to="/delivery">Delivery information</Link><Link to="/returns">Returns & exchange</Link><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms & conditions</Link></nav></div>
    <button type="button" className="privacy-choices" onClick={openAnalyticsPreferences}>Privacy choices</button>
    <small>© {new Date().getFullYear()} {settings.storeName}. All rights reserved.</small>
  </footer></div>;
}

function ProductImage({ src, alt, ...props }: { src?: string; alt: string; [key: string]: unknown }) {
  return <img src={src || fallbackImage} alt={alt} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImage; }} {...props} />;
}

function ProductGridSkeleton() {
  return <div className="product-grid" aria-busy="true" aria-label="Loading products">{[1, 2, 3, 4].map((i) => <div className="product-card" key={i}><div className="product-image skeleton" /><div className="catalogue-loading-copy"><div className="line skeleton" /><div className="line skeleton" /></div></div>)}</div>;
}

function DeliveryAreaPicker({ settings, value, onChange, name = 'delivery-area' }: { settings: StorefrontSettings; value: DeliveryArea; onChange: (area: DeliveryArea) => void; name?: string }) {
  return <fieldset className="delivery-area-picker"><legend>Delivery area</legend><div className="delivery-area-options">{deliveryAreaOptions.map((option) => <label className={value === option.value ? 'selected' : ''} key={option.value}><input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} /><span><b>{option.label}</b><small>{option.description}</small></span><strong>{money(deliveryFeeForArea(option.value, settings))}</strong><Check className="delivery-area-check" size={14}/></label>)}</div></fieldset>;
}

function ProductCard({ product, onBuyNow, buyNowText = 'Buy now' }: { product: Product; onBuyNow?: (product: Product) => void; buyNowText?: string }) {
  const discount = product.regularPrice > product.salePrice ? Math.round((1 - product.salePrice / product.regularPrice) * 100) : 0;
  return <article className="product-card">
    <Link className="product-image" to={productPath(product)}>
      {discount > 0 && <span className="discount">−{discount}%</span>}
      <ProductImage src={product.image} alt={product.name} loading="lazy" width="640" height="800" />
      {!product.inStock && <span className="sold-out">Sold out</span>}
    </Link><WishlistButton productId={product.id}/>
    <div className="product-info"><span>{product.category}</span><Link to={productPath(product)}>{product.name}</Link><div className="price"><b>{product.salePrice > 0 ? money(product.salePrice) : 'Coming soon'}</b>{discount > 0 && <del>{money(product.regularPrice)}</del>}</div>{onBuyNow && <button className="card-buy" disabled={!product.inStock} onClick={() => onBuyNow(product)}>{product.inStock ? buyNowText : 'Sold out'} <ArrowRight size={15} /></button>}</div>
  </article>;
}

function WishlistButton({ productId }: { productId: string }) {
  const { customer } = useCustomerAuth(); const navigate = useNavigate(); const location = useLocation(); const [saved, setSaved] = useState(false);
  const save = async () => { if (!customer) { navigate(`/signin?returnTo=${encodeURIComponent(location.pathname)}`); return; } try { await addCustomerWishlist(productId); setSaved(true); } catch { /* account page remains the source of truth */ } };
  return <button type="button" className={saved ? 'wishlist-button saved' : 'wishlist-button'} onClick={save} aria-label={saved ? 'Saved to wishlist' : 'Save to wishlist'}><Heart size={16} fill={saved ? 'currentColor' : 'none'}/></button>;
}

function HomePage({ settings }: { settings: StorefrontSettings }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>(() => getCachedProducts() || []);
  const [bestSellers, setBestSellers] = useState<Product[]>(() => getCachedProducts('?sort=best-selling') || []);
  const [activeSlide, setActiveSlide] = useState(0);
  const [quickProduct, setQuickProduct] = useState<Product | null>(null);
  const { buyNow } = useCart();
  const [loading, setLoading] = useState(() => !getCachedProducts());
  const [error, setError] = useState('');
  const [heroAspectRatio, setHeroAspectRatio] = useState<string>('1536 / 1024');
  const listTracked = useRef(false);
  useEffect(() => { listProducts().then((data) => { setProducts(data.products); if (!listTracked.current) { listTracked.current = true; trackAnalyticsEvent('view_item_list', { item_list_name: 'Homepage collection', items: data.products.slice(0, 8).map((item) => productAnalyticsItem(item)) }); } }).catch((e) => setError(e.message)).finally(() => setLoading(false)); listProducts('?sort=best-selling').then((data) => setBestSellers(data.products)).catch(() => undefined); }, []);
  const heroSlides = settings.heroImages.map((image, index) => ({
    id: `custom-${index}`,
    image,
    alt: settings.storeName,
    to: settings.heroButtonUrl,
  }));
  const newArrivals = [...products.filter((product) => product.productType === 'SIMPLE').slice(0, 6), ...products.filter((product) => product.productType === 'VARIABLE').slice(0, 2)];
  const showcases = settings.themeConfig.showcase?.length ? settings.themeConfig.showcase : [{ id: 'new', eyebrow: 'JUST IN', title: 'New arrivals', source: 'NEW' as const, limit: 8, enabled: true }, { id: 'best', eyebrow: 'CUSTOMER FAVOURITES', title: 'Most selling', source: 'BEST' as const, limit: 4, enabled: settings.themeConfig.showBestSellers }];
  useEffect(() => { if (heroSlides.length < 2) return; const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % heroSlides.length), 5000); return () => window.clearInterval(timer); }, [heroSlides.length]);
  useEffect(() => {
    const firstImg = heroSlides[0]?.image;
    if (!firstImg) return;
    const img = new Image();
    img.src = firstImg;
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setHeroAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
      }
    };
  }, [heroSlides]);
  const quickBuy = (product: Product, variant?: Variant) => { if (product.productType === 'VARIABLE' && !variant) { setQuickProduct(product); return; } const unitPrice = variant?.salePrice ?? product.salePrice; buyNow({ productId: product.id, variantId: variant?.id, name: product.name, variantName: variant ? Object.values(variant.attributes).join(' / ') || variant.name : undefined, image: variant?.image || product.image, unitPrice, quantity: 1, stockQuantity: variant?.stockQuantity ?? product.stockQuantity }); navigate('/checkout'); };
  return <>
    <section className="hero carousel" style={{ aspectRatio: heroAspectRatio }}>{heroSlides.length ? heroSlides.map((slide, index) => <div className={`hero-slide ${index === activeSlide ? 'active' : ''}`} key={slide.id}><div className="hero-banner-image"><ProductImage src={slide.image} alt={slide.alt} onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => { if (e.currentTarget.naturalWidth && e.currentTarget.naturalHeight) setHeroAspectRatio(`${e.currentTarget.naturalWidth} / ${e.currentTarget.naturalHeight}`); }} /></div><Link className="button dark hero-shop-overlay" to={slide.to}>{settings.heroButtonLabel} <ArrowRight size={18} /></Link></div>) : <div className="hero-slide active"><div className="hero-banner-image skeleton" /></div>}{heroSlides.length > 1 && <div className="carousel-dots">{heroSlides.map((slide, index) => <button key={slide.id} aria-label={`Show banner ${index + 1}`} className={activeSlide === index ? 'active' : ''} onClick={() => setActiveSlide(index)} />)}</div>}</section>
    {settings.themeConfig.showTrustBar && <section className="trust-row"><span><Truck /> Nationwide delivery</span><span><ShieldCheck /> Cash on delivery</span><span><PackageCheck /> Easy exchange support</span></section>}
    {showcases.filter((section) => section.enabled).map((section) => { const sectionProducts = section.source === 'BEST' ? (bestSellers.length ? bestSellers : products) : section.source === 'CATEGORY' ? products.filter((product) => product.category.toLowerCase() === (section.category || '').toLowerCase()) : newArrivals; return <section className={`collection section ${section.source === 'BEST' ? 'best-sellers' : ''}`} id={section.id} key={section.id}><div className="section-head"><div><span className="eyebrow">{section.eyebrow}</span><h2>{section.title}</h2></div><Link to={section.source === 'CATEGORY' ? `/shop?category=${encodeURIComponent(section.category || '')}` : '/shop'}>View all <ArrowRight size={16} /></Link></div>{loading ? <ProductGridSkeleton /> : error ? <Empty title="We could not load the collection" text={error} /> : sectionProducts.length ? <div className="product-grid">{sectionProducts.slice(0, section.limit).map((product) => <ProductCard key={product.id} product={product} onBuyNow={quickBuy} buyNowText={settings.themeConfig.buyNowText || 'Buy now'} />)}</div> : <Empty title="No products in this category" text="Add products to the selected category to show them here." />}</section>; })}
    {settings.themeConfig.showAbout && <section className="why section" id="why"><div className="why-image"><span className="delivery-art-label">DELIVERY<br />& CARE</span><div className="delivery-art-card"><Truck size={23}/><span>Nationwide delivery</span><b>From {money(Math.min(settings.insideDhakaCharge, settings.subAreaCharge, settings.outsideDhakaCharge))}</b></div></div><div><span className="eyebrow">DELIVERY & EASY EXCHANGE</span><h2>{settings.aboutTitle}</h2><p>{settings.aboutText}</p><div className="principles"><span><b>01</b> Inside Dhaka delivery <strong>{money(settings.insideDhakaCharge)}</strong></span><span><b>02</b> Dhaka sub area delivery <strong>{money(settings.subAreaCharge)}</strong></span><span><b>03</b> Outside Dhaka delivery <strong>{money(settings.outsideDhakaCharge)}</strong></span>{publicSupportPhone(settings.phone) && <span><b>04</b> Need an exchange? Call <a href={`tel:${settings.phone}`}>{settings.phone}</a></span>}</div><Link className="delivery-help-link" to="/delivery">See delivery information <ArrowRight size={15}/></Link></div></section>}
    {quickProduct && <QuickBuyModal product={quickProduct} variationStyle={settings.themeConfig.variationStyle} showColorName={settings.themeConfig.showColorName !== false} buyNowText={settings.themeConfig.buyNowText} onClose={() => setQuickProduct(null)} onBuy={(variant) => quickBuy(quickProduct, variant)} />}
  </>;
}

function VariationOptions({ product, selected, style, showColorName = true, onChange }: { product: Product; selected: Record<string,string>; style: string; showColorName?: boolean; onChange: (next: Record<string,string>) => void }) {
  const defs: Product['attributes'] = variationDefinitions(product);
  return <div className={`variation-picker shape-${style.toLowerCase()}`}>{defs.map((attribute) => {
    const rawOptions = attribute.options || attribute.values || [];
    const options = attribute.type === 'SIZE_NUMBER' ? [...rawOptions].sort((a,b) => Number(a) - Number(b)) : rawOptions;
    const colors = attribute.optionColors || {};
    const isColor = attribute.type === 'COLOR' || /color/i.test(attribute.name);
    return <div className="variation-group" key={attribute.name}><div className="variation-group-title"><b>{attribute.name}</b>{isColor && showColorName && selected[attribute.name] && <span>{selected[attribute.name]}</span>}</div><div className={`variation-values ${isColor ? 'color-values' : ''}`}>{options.map((option) => {
      const compatible = product.variants.some((variant) => variant.inStock && variant.attributes[attribute.name] === option && Object.entries(selected).every(([name,value]) => name === attribute.name || variant.attributes[name] === value));
      const active = selected[attribute.name] === option;
      return (
        <button
          type="button"
          key={option}
          title={option}
          aria-label={`${attribute.name}: ${option}`}
          disabled={!compatible}
          className={`${active ? 'selected' : ''} ${isColor ? 'color-choice' : ''} ${isColor && !showColorName ? 'swatch-only' : ''}`}
          onClick={() => onChange({ ...selected, [attribute.name]: option })}
        >
          {isColor && <i style={{ backgroundColor: colors[option] || option.toLowerCase() }} />}
          {(!isColor || showColorName) && <span>{option}</span>}
        </button>
      );
    })}</div></div>;
  })}</div>;
}

const variationDefinitions = (product: Product) => {
  const attributes = product.attributes.filter((attribute) => attribute.variation !== false && (attribute.options || attribute.values)?.length).sort((a,b) => {
    const rank = (item: typeof a) => item.type === 'COLOR' || /color/i.test(item.name) ? 0 : /size/i.test(item.name) ? 1 : 2;
    return rank(a) - rank(b);
  });
  return attributes.length ? attributes : Object.keys(product.variants[0]?.attributes || {}).map((name) => ({ name, options: [...new Set(product.variants.map((variant) => variant.attributes[name]).filter(Boolean))], type: /color/i.test(name) ? 'COLOR' : /size/i.test(name) ? 'SIZE_TEXT' : 'TEXT' } as Product['attributes'][number]));
};

function QuickBuyModal({ product, onClose, onBuy, variationStyle = 'SOFT', showColorName = true, buyNowText = 'Buy now' }: { product: Product; onClose: () => void; onBuy: (variant: Variant) => void; variationStyle?: string; showColorName?: boolean; buyNowText?: string }) {
  const [choices, setChoices] = useState<Record<string,string>>({});
  const [selectionError, setSelectionError] = useState('');
  const attributes = variationDefinitions(product);
  const selected = product.variants.find((variant) => attributes.length ? attributes.every((attribute) => choices[attribute.name] && variant.attributes[attribute.name] === choices[attribute.name]) : product.variants.some((item) => item.id === variant.id && Object.values(choices).length > 0));
  const choose = (next: Record<string,string>) => { setChoices(next); setSelectionError(''); };
  const confirmBuy = () => {
    if (!selected) { setSelectionError('Please select a color and size first.'); return; }
    if (!selected.inStock) { setSelectionError('This variation is sold out. Please choose another option.'); return; }
    onBuy(selected);
  };
  return <div className="quick-modal" role="dialog" aria-modal="true" aria-label="Choose variation"><div><button className="modal-close" onClick={onClose}><X size={20} /></button><span className="eyebrow">CHOOSE YOUR OPTION</span><div className="quick-product"><ProductImage src={selected?.image || product.image} alt={product.name} /><div><h2>{product.name}</h2><p>Choose color first, then size to see availability.</p></div></div><VariationOptions product={product} selected={choices} style={variationStyle} showColorName={showColorName} onChange={choose}/>{selected && <p className="variation-stock">{selected.inStock ? `${money(selected.salePrice)} · ${selected.stockQuantity} available` : 'Sold out'}</p>}{selectionError && <p className="form-error" role="alert">{selectionError}</p>}<button className="button dark full modal-checkout" disabled={!product.variants.some((variant) => variant.inStock)} onClick={confirmBuy}>{selected ? `${buyNowText} · ${money(selected.salePrice)}` : buyNowText}</button></div></div>;
}

function ProductPage({ settings }: { settings: StorefrontSettings }) {
  const { id = '' } = useParams();
  // Different product URLs must not commit the previous product's state.
  return <ProductDetail key={id} id={id} variationStyle={settings.themeConfig.variationStyle || 'SOFT'} showColorName={settings.themeConfig.showColorName !== false} buyNowText={settings.themeConfig.buyNowText || 'Buy now'} storeName={settings.storeName} />;
}

function ProductDetail({ id, variationStyle, showColorName, buyNowText, storeName }: { id: string; variationStyle: string; showColorName: boolean; buyNowText: string; storeName: string }) {
  const { add, buyNow } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState<Product | undefined>(() => getCachedProduct(id));
  const [selected, setSelected] = useState<Variant | undefined>(() => {
    const available = getCachedProduct(id)?.variants.filter((variant) => variant.inStock);
    return available?.length === 1 ? available[0] : undefined;
  });
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string,string>>({});
  const [activeImage, setActiveImage] = useState(() => getCachedProduct(id)?.image || '');
  const [related, setRelated] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loadError, setLoadError] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const pauseAutoplayUntil = useRef(0);
  useEffect(() => {
    let cancelled = false;
    getProduct(id)
      .then(({ product: p }) => {
        if (cancelled) return;
        setProduct(p);
        const canonicalPath = `/product/${encodeURIComponent(p.slug || p.id)}`;
        if (location.pathname !== canonicalPath) navigate(canonicalPath, { replace: true });
        trackAnalyticsEvent('view_item', { currency: 'BDT', value: p.salePrice, items: [productAnalyticsItem(p)] });
        setActiveImage((current) => current || p.image || '');
        document.title = `${p.metaTitle || p.name} | ${storeName}`;
        const description = document.querySelector('meta[name="description"]');
        if (description) description.setAttribute('content', p.metaDescription || p.description || `Shop modern fashion at ${storeName}.`);
        listProducts().then(({ products }) => { if (!cancelled) setRelated(products.filter((item) => item.id !== p.id && item.category === p.category).slice(0, 4)); }).catch(() => undefined);
        let previousIds: string[] = [];
        try { const stored: unknown = JSON.parse(localStorage.getItem('nix-recent-products-v1') || '[]'); previousIds = Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : []; } catch { previousIds = []; }
        previousIds = previousIds.filter((productId) => productId !== p.id).slice(0, 4);
        try { localStorage.setItem('nix-recent-products-v1', JSON.stringify([p.id, ...previousIds].slice(0, 8))); } catch { /* keep browsing if storage is disabled */ }
        Promise.all(previousIds.map((productId) => getProduct(productId).then((result) => result.product).catch(() => null))).then((items) => { if (!cancelled) setRecentlyViewed(items.filter((item): item is Product => !!item)); });
        const initialVariant = p.productType === 'VARIABLE' && p.variants.filter((v) => v.inStock).length === 1 ? p.variants.find((v) => v.inStock) : undefined;
        setSelected(initialVariant);
        setSelectedAttributes(initialVariant?.attributes || {});
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message); });
    return () => { cancelled = true; };
  }, [id, location.pathname, navigate]);
  useEffect(() => {
    if (!product) return;
    const images = Array.from(new Set([selected?.image, product.image, ...product.gallery].filter(Boolean))) as string[];
    if (images.length < 2) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= pauseAutoplayUntil.current && !document.hidden) {
        setActiveImage((current) => {
          const index = Math.max(0, images.indexOf(current));
          return images[(index + 1) % images.length];
        });
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [product, selected?.image]);
  if (loadError) return <section className="section"><Empty title="Product unavailable" text={loadError} /></section>;
  if (!product) return <section className="product-detail section" aria-busy="true" aria-label="Loading product"><div className="detail-gallery"><div className="detail-image skeleton" /></div><div className="detail-copy product-loading-copy"><div className="line skeleton" /><div className="line skeleton" /><div className="line skeleton" /></div></section>;
  const purchasable = selected || (product.productType === 'SIMPLE' && product.inStock ? product : undefined);
  const price = selected?.salePrice ?? product.salePrice;
  const regular = selected?.regularPrice ?? product.regularPrice;
  const stock = selected?.stockQuantity ?? product.stockQuantity;
  const hasAvailableOption = product.productType === 'VARIABLE' && !selected && product.variants.some((variant) => variant.inStock);
  const purchaseDisabled = product.productType === 'VARIABLE' ? (selected ? !selected.inStock : !product.variants.some((variant) => variant.inStock)) : stock < 1;
  const stockAvailable = selected ? stock > 0 : product.productType === 'VARIABLE' ? hasAvailableOption : stock > 0;
  const stockLabel = product.productType === 'VARIABLE' && !selected ? (hasAvailableOption ? 'Options in stock' : 'Currently unavailable') : stock > 0 ? (stock <= 5 ? `Only ${stock} left` : 'In stock') : 'Currently unavailable';
  const gallery = Array.from(new Set([selected?.image, product.image, ...product.gallery].filter(Boolean))) as string[];
  const showImage = activeImage && gallery.includes(activeImage) ? activeImage : selected?.image || product.image || gallery[0];
  const changeImage = (direction: number) => {
    if (gallery.length < 2) return;
    const currentIndex = Math.max(0, gallery.indexOf(showImage || gallery[0]));
    setActiveImage(gallery[(currentIndex + direction + gallery.length) % gallery.length]);
    pauseAutoplayUntil.current = Date.now() + 7000;
  };
  const currentItem = () => ({ productId: product.id, variantId: selected?.id, name: product.name, variantName: selected ? Object.values(selected.attributes).join(' / ') || selected.name : undefined, image: selected?.image || product.image, unitPrice: price, quantity, stockQuantity: stock });
  const canPurchase = () => {
    if (product.productType === 'VARIABLE' && !selected) { setSelectionError('Please select a variation first.'); return false; }
    if (!purchasable || stock < 1) { setSelectionError('This product is currently sold out.'); return false; }
    return true;
  };
  const addToCart = () => {
    if (!canPurchase()) return;
    add(currentItem());
    trackAnalyticsEvent('add_to_cart', { currency: 'BDT', value: price * quantity, items: [productAnalyticsItem(product, quantity)] });
    navigate('/cart');
  };
  const purchaseNow = () => {
    if (!canPurchase()) return;
    buyNow(currentItem());
    navigate('/checkout');
  };
  return <section className="product-detail section">
    <button className="back" onClick={() => navigate(-1)}><ArrowLeft size={18} /> Back to shop</button>
    <div className="detail-gallery"><div className="detail-image" onPointerDown={(event) => { swipeStart.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={(event) => { if (!swipeStart.current) return; const dx = event.clientX - swipeStart.current.x; const dy = event.clientY - swipeStart.current.y; swipeStart.current = null; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) changeImage(dx < 0 ? 1 : -1); }} onPointerCancel={() => { swipeStart.current = null; }} onMouseEnter={() => { pauseAutoplayUntil.current = Date.now() + 7000; }} onTouchStart={() => { pauseAutoplayUntil.current = Date.now() + 7000; }}>
      <ProductImage src={showImage} alt={product.name} draggable={false} />
      {gallery.length > 1 && <><button type="button" className="gallery-arrow previous" onClick={() => changeImage(-1)} aria-label="Previous product image"><ArrowLeft size={18}/></button><button type="button" className="gallery-arrow next" onClick={() => changeImage(1)} aria-label="Next product image"><ArrowRight size={18}/></button><span className="gallery-count">{Math.max(0, gallery.indexOf(showImage || '')) + 1} / {gallery.length}</span></>}
    </div>{gallery.length > 1 && <div className="gallery-thumbs">{gallery.map((image) => <button type="button" aria-label={`Show product image ${gallery.indexOf(image) + 1}`} className={showImage === image ? 'active' : ''} onClick={() => { setActiveImage(image); pauseAutoplayUntil.current = Date.now() + 7000; }} key={image}><ProductImage src={image} alt="" /></button>)}</div>}</div>
    <div className="detail-copy"><nav className="product-breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link>{(product.categoryTrail?.length ? product.categoryTrail : [{ name: product.category, slug: product.category }]).map((category) => <span className="breadcrumb-category" key={category.slug}><ChevronRight size={13}/><Link to={`/shop?category=${encodeURIComponent(category.name)}`}>{category.name}</Link></span>)}<span className="breadcrumb-current"><ChevronRight size={13}/><span aria-current="page">{product.name}</span></span></nav><h1>{product.name}</h1><div className="detail-price"><b>{money(price)}</b>{regular > price && <del>{money(regular)}</del>}</div><p>{product.description || 'A versatile wardrobe essential designed for everyday comfort and effortless styling.'}</p>
      {product.productType === 'VARIABLE' && <div className="options"><label>Select options</label><VariationOptions product={product} selected={selectedAttributes} style={variationStyle} showColorName={showColorName} onChange={(next) => { setSelectedAttributes(next); const definitions = variationDefinitions(product); const matched = definitions.every((attribute) => next[attribute.name]) ? product.variants.find((variant) => definitions.every((attribute) => variant.attributes[attribute.name] === next[attribute.name])) : undefined; setSelected(matched); if (matched) setActiveImage(matched.image || product.image || ''); setSelectionError(''); setQuantity(1); }}/>{selected && <p className="variation-stock">{selected.inStock ? `${selected.stockQuantity} available` : 'Sold out'}</p>}</div>}
      {selectionError && <p className="form-error">{selectionError}</p>}
      <div className="purchase-row"><div className="qty"><button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button><span>{quantity}</span><button type="button" aria-label="Increase quantity" onClick={() => setQuantity(Math.min(stock, quantity + 1))}><Plus size={16} /></button></div><button className="button outline grow" disabled={purchaseDisabled} onClick={addToCart}><ShoppingBag size={18} /> {stockAvailable ? 'Add to bag' : 'Sold out'}</button><button className="button dark grow" disabled={purchaseDisabled} onClick={purchaseNow}>{buyNowText} <ArrowRight size={18} /></button></div>
      <div className="detail-stock"><span className={stockAvailable ? 'available' : 'unavailable'}><i />{stockLabel}</span><span>Cash on delivery</span><span>Easy exchange support</span></div>
      <div className="detail-promises"><span><Check /> Delivery: Dhaka ৳60 · Outside ৳120</span><span><Check /> Stock is confirmed at checkout</span></div>
    </div>
    {related.length > 0 && <section className="related"><div className="section-head"><div><span className="eyebrow">MORE TO EXPLORE</span><h2>You may also like</h2></div><Link to={`/?category=${encodeURIComponent(product.category)}`}>View all <ArrowRight size={16} /></Link></div><div className="product-grid">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
    {recentlyViewed.length > 0 && <section className="related recently-viewed"><div className="section-head"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Recently viewed</h2></div><Link to="/shop">Explore all <ArrowRight size={16} /></Link></div><div className="product-grid">{recentlyViewed.map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
  </section>;
}

function ShopPage({ settings }: { settings: StorefrontSettings }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { buyNow } = useCart();
  const [products, setProducts] = useState<Product[]>(() => getCachedProducts() || []);
  const [loading, setLoading] = useState(() => !getCachedProducts());
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [quickProduct, setQuickProduct] = useState<Product | null>(null);
  const listTracked = useRef(false);
  useEffect(() => { listProducts().then(({ products: next }) => { setProducts(next); if (!listTracked.current) { listTracked.current = true; trackAnalyticsEvent('view_item_list', { item_list_name: 'Shop collection', items: next.slice(0, 20).map((item) => productAnalyticsItem(item)) }); } }).catch((error) => setLoadError(error.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { setSearch(searchParams.get('search') || ''); }, [searchParams.toString()]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  useEffect(() => {
    const requested = searchParams.get('category');
    if (!requested) { setCategory('All'); return; }
    const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
    setCategory(categories.find((item) => item !== 'All' && normalize(item) === normalize(requested)) || 'All');
  }, [searchParams.toString(), categories]);
  const visible = products.filter((product) => (category === 'All' || product.category === category) && (!inStockOnly || product.inStock) && `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'price-asc' ? a.salePrice - b.salePrice : sort === 'price-desc' ? b.salePrice - a.salePrice : sort === 'name' ? a.name.localeCompare(b.name) : 0);
  const buy = (product: Product, variant?: Variant) => { if (product.productType === 'VARIABLE' && !variant) { setQuickProduct(product); return; } buyNow({ productId: product.id, variantId: variant?.id, name: product.name, variantName: variant ? Object.values(variant.attributes).join(' / ') || variant.name : undefined, image: variant?.image || product.image, unitPrice: variant?.salePrice ?? product.salePrice, quantity: 1, stockQuantity: variant?.stockQuantity ?? product.stockQuantity }); navigate('/checkout'); };
  return <section className="section shop-page"><span className="eyebrow">THE COLLECTION</span><h1>Find your next<br />everyday essential.</h1><div className="shop-tools"><label className="shop-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" /></label><div className="shop-controls"><label className="stock-filter"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} /> In stock</label><select className="shop-sort" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products"><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name: A to Z</option></select><span>{visible.length} styles</span></div></div><div className="chips">{categories.map((item) => <button className={category === item ? 'active' : ''} onClick={() => { setCategory(item); const next = new URLSearchParams(searchParams); if (item === 'All') next.delete('category'); else next.set('category', item); navigate({ search: next.toString() }, { replace: true }); }} key={item}>{item}</button>)}</div>{loading ? <ProductGridSkeleton /> : loadError ? <Empty title="Could not load products" text={loadError} /> : visible.length ? <div className="product-grid">{visible.map((product) => <ProductCard key={product.id} product={product} onBuyNow={buy} buyNowText={settings.themeConfig.buyNowText || 'Buy now'} />)}</div> : <Empty title="No styles found" text="Try another search or category." action="Back home" />}{quickProduct && <QuickBuyModal product={quickProduct} variationStyle={settings.themeConfig.variationStyle} showColorName={settings.themeConfig.showColorName !== false} buyNowText={settings.themeConfig.buyNowText} onClose={() => setQuickProduct(null)} onBuy={(variant) => buy(quickProduct, variant)} />}</section>;
}

type ContentPageKey = 'about' | 'delivery' | 'returns' | 'faq' | 'privacy' | 'terms';
const contentPages: Record<ContentPageKey, { eyebrow: string; title: string; intro: string; blocks: Array<[string, string]> }> = {
  about: { eyebrow: 'ABOUT {storeName}', title: 'Easy pieces for real life.', intro: '{storeName} brings together considered products, clear information and straightforward service for a confident shopping experience.', blocks: [['Our approach', 'We aim to make it easy to discover useful products, understand available options and see the full price before placing an order.'], ['Shop with clarity', 'Product pages show available variations, pricing and stock information. If an option is unavailable, it cannot be added to your order.'], ['Here to help', 'Our customer care team can help with order, delivery and product questions. Keep your order number and checkout phone number nearby.']] },
  delivery: { eyebrow: 'DELIVERY INFORMATION', title: 'Delivery that keeps you informed.', intro: '{storeName} delivers across Bangladesh using our supported courier network. Your available delivery area and charge are shown before you place an order.', blocks: [['Our courier partners', 'Depending on destination, service coverage and operational availability, orders may be dispatched with Pathao Courier, SteadFast Courier or RedX. The assigned courier is confirmed when your parcel is prepared.'], ['Delivery areas & charges', 'Choose Outside Dhaka, Dhaka sub area or Dhaka city at checkout. The applicable delivery charge is shown beside each option and included in your order total before confirmation.'], ['Processing & delivery time', 'Orders are reviewed and confirmed before dispatch. Delivery estimates can vary by destination, courier workload, weather and other service conditions; an estimate is not a guaranteed arrival time.'], ['Tracking your parcel', 'After dispatch, courier tracking information is added to your order when available. Visit Track order and enter your order number and checkout mobile number to view the latest store update. You may also use the assigned courier’s tracking service.'], ['A successful delivery', 'Please provide a complete address and an active phone number, and ensure someone can receive the parcel. If your address or availability changes, contact us as soon as possible. Delivery attempts and return handling depend on the courier’s service rules.']] },
  returns: { eyebrow: 'EXCHANGE & RETURNS', title: 'We are here to help.', intro: 'If something is not right with your order, contact customer care promptly so we can review the issue and explain the available options.', blocks: [['How to request help', 'Share your order number, checkout mobile number, the item and a clear description or photo of the issue. Please contact us before sending an item back.'], ['Item condition', 'For a size or product exchange, items should be unused, unwashed and returned with original tags and packaging where applicable. Approval and available options depend on the item and its condition.'], ['Availability & delivery', 'Exchanges depend on replacement stock and delivery coverage. Any return or redelivery arrangements, including applicable courier charges, will be confirmed with you before proceeding.'], ['Exceptions', 'Items showing wear, washing, damage after delivery or missing original components may not qualify. We will review each request and explain the decision.']] },
  faq: { eyebrow: 'HELP CENTRE', title: 'Questions, answered.', intro: 'Helpful details for ordering, payment and delivery from {storeName}.', blocks: [['Which couriers deliver orders?', 'We use Pathao Courier, SteadFast Courier or RedX depending on destination coverage and operational availability. Your assigned courier and tracking details are shared after dispatch when available.'], ['How is delivery charge selected?', 'Choose Outside Dhaka, Dhaka sub area or Dhaka city in your cart or at checkout. The selected rate is added to the total immediately.'], ['Can I pay online?', 'Cash on delivery is available. If secure online payment is enabled at checkout, you can also pay through UddoktaPay.'], ['How do I track an order?', 'Open Track order and enter the order number from your confirmation and the mobile number used at checkout. Courier tracking information appears when it has been added to the order.'], ['Can I change or cancel an order?', 'Contact us as soon as possible. Changes may not be possible after the parcel has been prepared or dispatched.'], ['How do product options work?', 'Select the available colour, size or other variation before adding a variable product to your bag.']] },
  privacy: { eyebrow: 'PRIVACY POLICY', title: 'Your information, handled carefully.', intro: '{storeName} uses personal information to operate the store, fulfill orders and provide customer support.', blocks: [['Information you provide', 'When you order or create an account, we may collect your name, phone number, email, delivery address, order details and information you choose to share with customer care.'], ['How information is used', 'We use this information to confirm and fulfill orders, arrange delivery, process payment, provide tracking and support, maintain account features and protect the store from misuse.'], ['Service providers', 'When needed to complete your order, relevant details are shared with the courier assigned to your parcel, such as Pathao Courier, SteadFast Courier or RedX, and with the selected payment provider. We share only information needed for the service.'], ['Analytics & preferences', 'If enabled, analytics or advertising tools may collect site usage events according to your consent and browser settings. You can review available privacy choices using the link in the site footer.'], ['Retention & protection', 'Order and account information is retained as needed for store operations, support and applicable recordkeeping. We use access controls and operational safeguards, but no internet transmission or storage system can be guaranteed completely secure.'], ['Your choices & contact', 'You may contact us to request help with your account information or privacy questions. Some order records may need to be retained for operational or legal recordkeeping. Call {phone} for customer care.']] },
  terms: { eyebrow: 'TERMS & CONDITIONS', title: 'Clear terms for confident shopping.', intro: 'These terms explain how orders, payment and delivery work when you shop with {storeName}. Placing an order means you have reviewed and accepted these store terms.', blocks: [['Orders & confirmation', 'An order request is subject to product availability and review. We may contact you using the phone number provided to confirm details. An order is not considered dispatched until it has been prepared and handed to a courier.'], ['Product details & availability', 'We make reasonable efforts to keep product descriptions, images, variations and stock information accurate. Displayed colours may vary by device. If an item or selected variation becomes unavailable, we will contact you about the available options.'], ['Prices & payment', 'Product prices and the selected delivery charge are shown before order submission. Available payment methods are shown at checkout; online payment is offered only when enabled. For cash on delivery, payment is due to the courier or delivery representative upon receipt.'], ['Delivery', 'Orders may be delivered by Pathao Courier, SteadFast Courier or RedX depending on service coverage and availability. Delivery estimates are not guaranteed. Please provide an accurate address and reachable phone number. Tracking information is provided when available.'], ['Changes, cancellations & returns', 'Contact customer care promptly if you need to change or cancel an order. A request may not be possible once processing or dispatch has begun. Exchanges and return requests are reviewed under our Exchange & returns information.'], ['Accounts & acceptable use', 'Keep your sign-in details private and provide accurate information. Do not misuse the site, interfere with its operation or submit fraudulent orders. We may limit access where needed to protect customers and store operations.'], ['Policies & support', 'Our Privacy policy explains how information is handled, and our Delivery information and Exchange & returns pages provide additional service details. For help, contact {phone} with your order number where relevant.']] },
};

function ContentPageContent({ record, raw, settings }: { record?: StorePage | null; raw?: (typeof contentPages)[ContentPageKey]; settings: StorefrontSettings }) {
  const fill = (text: string) => text.replace(/\{storeName\}/g, settings.storeName).replace(/\{phone\}/g, publicSupportPhone(settings.phone) || 'our support team');
  const title = record ? fill(record.title) : raw ? fill(raw.title) : '';
  const description = record ? fill(record.metaDescription || record.excerpt || '') : raw ? fill(raw.intro) : '';
  useEffect(() => {
    if (!title) return;
    document.title = `${record?.metaTitle ? fill(record.metaTitle) : title} | ${settings.storeName}`;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
    meta.content = description;
  }, [title, description, record?.metaTitle, settings.storeName]);
  const blocks = record ? record.blocks : raw ? raw.blocks.map(([heading, text], index) => ({ id: `${index}`, type: 'TEXT' as const, heading, text })) : [];
  return <section className="content-page section"><div className="content-intro"><span className="eyebrow">{fill(record?.eyebrow || raw?.eyebrow || '')}</span><h1>{title}</h1><p>{fill(record?.excerpt || raw?.intro || '')}</p><Link className="button dark" to="/shop">Shop now <ArrowRight size={18} /></Link></div><div className="content-blocks">{record?.coverImage && <img className="content-page-cover" src={record.coverImage} alt=""/>}{blocks.map((block, index) => block.type === 'TEXT' ? <article key={block.id}><b>{String(index + 1).padStart(2, '0')}</b><div><h2>{fill(block.heading || '')}</h2><p>{fill(block.text || '')}</p></div></article> : block.type === 'IMAGE' ? <figure className="content-page-image" key={block.id}><img src={block.url} alt={block.alt || ''}/>{block.text && <figcaption>{fill(block.text)}</figcaption>}</figure> : block.type === 'HTML' ? <div className="content-page-html" key={block.id} dangerouslySetInnerHTML={{ __html: block.html || '' }} /> : <div className="content-page-action" key={block.id}>{block.url?.startsWith('/') ? <Link className="button dark" to={block.url}>{block.label} <ArrowRight size={17}/></Link> : <a className="button dark" href={block.url} target="_blank" rel="noreferrer">{block.label} <ArrowRight size={17}/></a>}</div>)}</div></section>;
}

function ContentPage({ page, settings }: { page: string; settings: StorefrontSettings }) {
  const navigate = useNavigate();
  const raw = contentPages[page as ContentPageKey];
  const [loaded, setLoaded] = useState<{ slug: string; page: StorePage | null; fallback: boolean; missing: boolean } | null>(() => {
    const cached = getCachedStorePage(page);
    return cached ? { slug: page, page: cached, fallback: false, missing: false } : null;
  });
  useEffect(() => {
    let active = true;
    getStorePage(page).then(({ page: result }) => {
      if (!active) return;
      setLoaded({ slug: page, page: result, fallback: false, missing: false });
      if (result.slug !== page && !result.slug.startsWith('flow-')) navigate(`/${result.slug}`, { replace: true });
    }).catch((error: any) => { if (active) setLoaded({ slug: page, page: null, fallback: error.status !== 404, missing: error.status === 404 }); });
    return () => { active = false; };
  }, [page, navigate]);
  const record = loaded?.slug === page ? loaded.page : null;
  const fallback = loaded?.slug === page && loaded.fallback && raw;
  if (!loaded || loaded.slug !== page) return <section className="section content-page-loading" aria-busy="true" aria-label="Page loading" />;
  if (loaded.missing || (!record && !fallback)) return <section className="section"><Empty title="Page not found" text="This page is not available." action="Back home" /></section>;
  return <ContentPageContent record={record} raw={raw} settings={settings} />;
}

function DynamicPageResolver({ settings }: { settings: StorefrontSettings }) {
  const { slug = '' } = useParams();
  const [retry, setRetry] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState<{ slug: string; page: StorePage | null; design?: LandingDesign | null; missing: boolean } | null>(() => {
    const cachedPage = getCachedStorePage(slug) || getCachedStorePage(`flow-${slug}`);
    if (cachedPage) {
      const cachedDesign = cachedPage.slug.startsWith('flow-') ? getCachedLandingDesign(cachedPage.slug) : undefined;
      return { slug, page: cachedPage, design: cachedDesign, missing: false };
    }
    return null;
  });
  useEffect(() => {
    let active = true;
    setLoadError('');
    Promise.all([getStorePage(slug), getLandingDesign(`flow-${slug}`)]).then(([{ page: result }, design]) => {
      if (!active) return;
      setLoaded({ slug, page: result, design, missing: false });
    }).catch((error: any) => {
      if (!active) return;
      if (error?.status === 404) setLoaded({ slug, page: null, missing: true });
      else setLoadError('The page could not load. Please try again.');
    });
    return () => { active = false; };
  }, [slug, retry]);

  if (loadError) return <main className="section"><p role="alert">{loadError}</p><button className="button dark" onClick={() => setRetry(value => value + 1)}>Try again</button></main>;

  if (!loaded || loaded.slug !== slug) {
    return <main className="landing-loading" aria-busy="true" aria-label="Page loading"><div className="landing-loading-spinner" /></main>;
  }
  const record = loaded.page;
  if (record?.slug.startsWith('flow-')) {
    return <LandingPage settings={settings} slug={record.slug.slice('flow-'.length)} initialPage={record as unknown as Parameters<typeof LandingPage>[0]['initialPage']} initialDesign={loaded.design} />;
  }
  if (loaded.missing || !record) {
    return <Layout settings={settings}><section className="section"><Empty title="Page not found" text="This page is not available." action="Back home" /></section></Layout>;
  }
  return <Layout settings={settings}><ContentPageContent record={record} settings={settings} /></Layout>;
}

function ContactPage({ settings }: { settings: StorefrontSettings }) {
  return <section className="content-page section"><div className="content-intro"><span className="eyebrow">CONTACT {settings.storeName}</span><h1>We are ready to help.</h1><p>For delivery, exchange or product questions, keep your order number ready and contact our customer care team.</p>{publicSupportPhone(settings.phone) && <a className="button dark" href={`tel:${settings.phone}`}>Call {settings.phone}</a>}</div><div className="content-blocks"><article><b>01</b><div><h2>Order support</h2><p>For an existing order, use the same mobile number from checkout when you contact us.</p><Link to="/track-order">Track your order <ArrowRight size={16} /></Link></div></article><article><b>02</b><div><h2>Before you order</h2><p>Check the product size, variation and stock availability before adding it to your bag.</p><Link to="/faq">Read FAQs <ArrowRight size={16} /></Link></div></article></div></section>;
}

function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<{ orderNumber: string; status: string; paymentStatus: string; grandTotal: number; createdAt: string; courierTrackingCode?: string | null } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(''); setResult(null); try { const response = await trackOrder(orderNumber.trim(), phone.trim()); setResult(response.order); } catch (e: any) { setError(e.message); } finally { setLoading(false); } };
  return <section className="tracking-page section"><div><span className="eyebrow">ORDER TRACKING</span><h1>Know where your order is.</h1><p>Enter the order number and mobile number used at checkout.</p><form className="track-form" onSubmit={submit}><label>Order number<input required value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="WEB-..." /></label><label>Mobile number<input required inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01XXXXXXXXX" /></label><button className="button dark" disabled={loading}><ClipboardCheck size={18} />{loading ? 'Checking…' : 'Track order'}</button></form>{error && <p className="form-error">{error}</p>}</div><aside className="track-result">{result ? <><span className="eyebrow">ORDER FOUND</span><h2>{result.orderNumber}</h2><div><span>Status</span><b>{result.status.replace(/_/g, ' ')}</b></div><div><span>Payment</span><b>{result.paymentStatus}</b></div><div><span>Total</span><b>{money(result.grandTotal)}</b></div>{result.courierTrackingCode && <div><span>Courier code</span><b>{result.courierTrackingCode}</b></div>}</> : <><PackageCheck size={30} /><h2>Your order updates will appear here.</h2><p>We only show an order when its number and checkout mobile number match.</p></>}</aside></section>;
}

function CartPage({ settings }: { settings: StorefrontSettings }) {
  const { items, subtotal, deliveryArea, setDeliveryArea, setQuantity, remove } = useCart();
  useEffect(() => { if (items.length) trackAnalyticsEvent('view_cart', { currency: 'BDT', value: subtotal, items: items.map((item) => ({ id: item.productId, name: item.name, price: item.unitPrice, quantity: item.quantity })) }); }, []);
  if (!items.length) return <section className="section"><Empty title="Your bag is empty" text={`Discover the latest ${settings.storeName} edit and add something you love.`} action="Explore collection" /></section>;
  return <section className="cart-layout section"><div><span className="eyebrow">YOUR SELECTION</span><h1>Shopping bag <small>{items.length}</small></h1><div className="cart-items">{items.map((item) => <article className="cart-item" key={item.key}><ProductImage src={item.image} alt="" /><div><h3>{item.name}</h3>{item.variantName && <p>{item.variantName}</p>}<b>{money(item.unitPrice)}</b><div className="qty compact"><button onClick={() => setQuantity(item.key, item.quantity - 1)}><Minus size={14} /></button><span>{item.quantity}</span><button onClick={() => setQuantity(item.key, item.quantity + 1)}><Plus size={14} /></button></div></div><button className="remove" onClick={() => remove(item.key)} aria-label="Remove"><Trash2 size={18} /></button></article>)}</div></div><OrderSummary subtotal={subtotal} settings={settings} deliveryArea={deliveryArea} setDeliveryArea={setDeliveryArea} /></section>;
}

function OrderSummary({ subtotal, settings, deliveryArea, setDeliveryArea, checkout = true }: { subtotal: number; settings: StorefrontSettings; deliveryArea: DeliveryArea; setDeliveryArea: (area: DeliveryArea) => void; checkout?: boolean }) {
  const delivery = deliveryFeeForArea(deliveryArea, settings);
  return <aside className="summary"><h3>Order summary</h3><DeliveryAreaPicker settings={settings} value={deliveryArea} onChange={setDeliveryArea} name="cart-delivery-area"/><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Delivery</span><b>{money(delivery)}</b></div><div className="summary-total"><span>Total</span><b>{money(subtotal + delivery)}</b></div>{checkout && <Link className="button dark full" to="/checkout">Continue to checkout <ArrowRight size={18} /></Link>}<p><ShieldCheck size={16} /> Prices and stock verified securely at checkout.</p></aside>;
}

function CheckoutPage({ settings }: { settings: StorefrontSettings }) {
  const { items, subtotal, deliveryArea, setDeliveryArea, clear } = useCart();
  const { customer } = useCustomerAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UDDOKTAPAY'>('COD');
  const [form, setForm] = useState<Record<string,string>>({ name: '', phone: '', email: '', address: '', district: 'Dhaka', city: '', note: '' });
  const checkoutFields = settings.themeConfig.checkoutFields || fallbackCheckoutFields;
  const enabledFields = checkoutFields.filter((field) => field.enabled);
  const needsPaymentEmail = paymentMethod === 'UDDOKTAPAY' && !enabledFields.some((field) => field.key === 'email');
  const checkoutTracked = useRef(false);
  useEffect(() => { if (items.length && !checkoutTracked.current) { checkoutTracked.current = true; trackAnalyticsEvent('begin_checkout', { currency: 'BDT', value: subtotal, items: items.map((item) => ({ id: item.productId, name: item.name, price: item.unitPrice, quantity: item.quantity })) }); } }, [items, subtotal]);
  useEffect(() => { if (customer && !form.name && !form.phone) setForm((current) => ({ ...current, name: customer.name || '', phone: customer.phone || '', email: customer.email || '', address: customer.address || '', district: customer.district || 'Dhaka', city: customer.city || customer.area || '' })); }, [customer]);
  const delivery = deliveryFeeForArea(deliveryArea, settings);
  if (!items.length) return <section className="section"><Empty title="Nothing to checkout" text="Add a product before starting checkout." action="Go shopping" /></section>;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      const submissionFields = needsPaymentEmail ? [...enabledFields, { key: 'email' }] : enabledFields;
      const cleanedCustomer = Object.fromEntries(submissionFields.map((field) => [field.key, form[field.key]?.trim() || undefined]));
      // Send _fbc/_fbp cookies and event ID for server-side CAPI deduplication
      const { fbc, fbp } = getMetaCookies();
      const _eventId = generateEventId();
      const result = await placeOrder({ customer: { ...cleanedCustomer, ...(!enabledFields.some((field) => field.key === 'district') ? { district: undefined } : {}) }, paymentMethod, deliveryArea, items: items.map((item) => ({ productId: item.productId, variantId: item.variantId || null, quantity: item.quantity })), _fbc: fbc, _fbp: fbp, _eventId, _trackingConsent: isTrackingAllowed() });
      if (paymentMethod === 'UDDOKTAPAY') {
        if (!result.paymentUrl) throw new Error('Payment link was not returned');
        try { sessionStorage.setItem('nix-pending-purchase', JSON.stringify({ orderNumber: result.order.orderNumber, eventId: _eventId, params: { currency: 'BDT', value: result.order.grandTotal, shipping: result.order.deliveryCharge, transaction_id: result.order.orderNumber, items: items.map((item) => ({ id: item.productId, name: item.name, price: item.unitPrice, quantity: item.quantity })) } })); } catch { /* server CAPI still records verified orders */ }
        window.location.assign(result.paymentUrl); return;
      }
      trackPurchaseOnce(result.order.orderNumber, { currency: 'BDT', value: result.order.grandTotal, shipping: result.order.deliveryCharge, transaction_id: result.order.orderNumber, items: items.map((item) => ({ id: item.productId, name: item.name, price: item.unitPrice, quantity: item.quantity })) }, _eventId);
      try { sessionStorage.setItem('nix-last-order', JSON.stringify(result.order)); } catch { /* confirmation remains available in router state */ } clear(); navigate(`/order/${result.order.orderNumber}`, { state: result.order });
    } catch (e: any) { setError(e.message); } finally { setSubmitting(false); }
  };
  const change = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setForm({ ...form, [key]: event.target.value }); setFieldErrors((current) => { const next = { ...current }; delete next[key]; return next; }); };
  const invalidField = (key: string, label: string) => (event: React.FormEvent<HTMLElement>) => {
    event.preventDefault();
    const prompt = key === 'name' ? 'Enter your full name' : key === 'phone' ? 'Enter your mobile number' : key === 'address' ? 'Enter your full delivery address' : `Enter ${label.toLowerCase()}`;
    setFieldErrors((current) => ({ ...current, [key]: prompt }));
  };
  const selectPayment = (method: 'COD' | 'UDDOKTAPAY') => { setPaymentMethod(method); trackAnalyticsEvent('add_payment_info', { currency: 'BDT', value: subtotal + delivery, payment_type: method === 'COD' ? 'Cash on Delivery' : 'UddoktaPay Online', items: items.map((item) => ({ id: item.productId, name: item.name, price: item.unitPrice, quantity: item.quantity })) }); };
  const paymentOptions = <div className="checkout-payment-options"><h3>Payment method</h3><label><input type="radio" name="payment-method" checked={paymentMethod === 'COD'} onChange={() => selectPayment('COD')} /><span><b>Cash on delivery</b><small>Pay when your order arrives</small></span></label>{settings.onlinePaymentEnabled && <label><input type="radio" name="payment-method" checked={paymentMethod === 'UDDOKTAPAY'} onChange={() => selectPayment('UDDOKTAPAY')} /><span><b>Pay securely online</b><small>Continue to UddoktaPay after submitting your order</small></span></label>}</div>;
  return <section className="checkout section">
    <div className="checkout-heading"><span className="eyebrow">QUICK CHECKOUT</span><h1>Delivery details</h1><p>No account needed. Complete your order in under a minute.</p></div>
    <form id="storefront-checkout-form" onSubmit={submit}><div className="field-grid">{enabledFields.map((field) => <label className={field.key === 'address' || field.key === 'note' || field.custom ? 'wide' : ''} key={field.key}>{field.label}{paymentMethod === 'UDDOKTAPAY' && field.key === 'email' && <small> (required for payment receipt)</small>}{field.type === 'textarea' ? <textarea required={field.required} minLength={field.key === 'address' ? 8 : undefined} className={fieldErrors[field.key] ? 'field-invalid' : ''} aria-invalid={Boolean(fieldErrors[field.key])} onInvalid={invalidField(field.key, field.label)} value={form[field.key] || ''} onChange={change(field.key)} placeholder={fieldErrors[field.key] || field.placeholder || ''}/> : field.type === 'select' ? <select required={field.required} className={fieldErrors[field.key] ? 'field-invalid' : ''} aria-invalid={Boolean(fieldErrors[field.key])} onInvalid={invalidField(field.key, field.label)} value={form[field.key] || ''} onChange={change(field.key)}><option value="">{fieldErrors[field.key] || `Choose ${field.label.toLowerCase()}`}</option>{(field.options || []).map((option) => <option key={option}>{option}</option>)}</select> : <input type={field.type} required={field.required || (paymentMethod === 'UDDOKTAPAY' && field.key === 'email')} minLength={field.key === 'name' ? 2 : undefined} className={fieldErrors[field.key] ? 'field-invalid' : ''} aria-invalid={Boolean(fieldErrors[field.key])} onInvalid={invalidField(field.key, field.label)} inputMode={field.type === 'tel' ? 'tel' : undefined} autoComplete={field.key === 'email' ? 'email' : undefined} value={form[field.key] || ''} onChange={change(field.key)} placeholder={fieldErrors[field.key] || field.placeholder || (field.key === 'phone' ? '01XXXXXXXXX' : '')}/>}</label>)}{needsPaymentEmail && <label className="wide">Email address <small>Required for secure online payment</small><input type="email" required className={fieldErrors.email ? 'field-invalid' : ''} aria-invalid={Boolean(fieldErrors.email)} onInvalid={invalidField('email', 'Email address')} autoComplete="email" value={form.email || ''} onChange={change('email')} placeholder={fieldErrors.email || 'you@example.com'}/></label>}</div></form>
    <div className="checkout-order-column"><aside className="summary checkout-summary"><h3>Your order</h3>{items.map((item) => <div className="mini-item" key={item.key}><ProductImage src={item.image} alt=""/><span>{item.name}<small>{item.variantName} · Qty {item.quantity}</small></span><b>{money(item.unitPrice * item.quantity)}</b></div>)}<div><span>Subtotal</span><b>{money(subtotal)}</b></div><DeliveryAreaPicker settings={settings} value={deliveryArea} onChange={setDeliveryArea} name="checkout-delivery-area"/><div><span>Delivery</span><b>{money(delivery)}</b></div><div className="summary-total"><span>Total</span><b>{money(subtotal + delivery)}</b></div></aside>
      <div className="checkout-payment-block">{paymentOptions}{error && <p className="form-error">{error}</p>}<button className="button dark full place" type="submit" form="storefront-checkout-form" disabled={submitting}>{submitting ? 'Submitting…' : `${paymentMethod === 'COD' ? 'Place COD order' : 'Continue to secure payment'} · ${money(subtotal + delivery)}`}</button></div>
    </div>
  </section>;
}

function PaymentResultPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { clear } = useCart();
  const [result, setResult] = useState<{ orderNumber: string; paymentStatus: string; total: number } | null>(null);
  const [error, setError] = useState('');
  const attempt = params.get('attempt') || sessionStorage.getItem('nix-payment-attempt') || '';
  const token = params.get('token') || sessionStorage.getItem('nix-payment-token') || '';
  useLayoutEffect(() => {
    if (!attempt || !token || !new URLSearchParams(window.location.search).has('token')) return;
    try { sessionStorage.setItem('nix-payment-attempt', attempt); sessionStorage.setItem('nix-payment-token', token); } catch { /* keep the current URL token available for this page */ }
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }, [attempt, token]);
  const check = () => getPaymentResult(attempt, token).then((response) => { setResult(response); if (response.paymentStatus === 'PAID') { clear(); try { const pending = JSON.parse(sessionStorage.getItem('nix-pending-purchase') || 'null'); if (pending?.orderNumber === response.orderNumber && pending.eventId) trackPurchaseOnce(pending.orderNumber, pending.params || { currency: 'BDT', value: response.total, transaction_id: response.orderNumber }, pending.eventId); if (pending?.orderNumber === response.orderNumber && typeof pending.landingSlug === 'string' && /^[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u.test(pending.landingSlug)) { const order = { orderNumber: response.orderNumber, grandTotal: response.total, deliveryCharge: pending.params?.shipping || 0, paymentMethod: 'UDDOKTAPAY', status: 'PAID', landingSlug: pending.landingSlug, items: Array.isArray(pending.orderItems) ? pending.orderItems : [] }; try { sessionStorage.setItem('nix-last-order', JSON.stringify(order)); } catch {} navigate(`/${encodeURIComponent(pending.landingSlug)}/thank-you?order=${encodeURIComponent(response.orderNumber)}`, { replace: true, state: order }); } sessionStorage.removeItem('nix-pending-purchase'); sessionStorage.removeItem('nix-payment-attempt'); sessionStorage.removeItem('nix-payment-token'); } catch { /* Purchase can still be recorded by server CAPI */ } } }).catch(() => setError('Could not check the payment. Please contact support.'));
  useEffect(() => { if (attempt && token) check(); else setError('Payment reference is missing.'); }, [attempt, token]);
  return <section className="success section"><span className="eyebrow">PAYMENT STATUS</span><h1>{result?.paymentStatus === 'PAID' ? 'Payment confirmed.' : params.has('cancelled') ? 'Payment was cancelled.' : 'Payment is pending.'}</h1><p>{result?.paymentStatus === 'PAID' ? 'UddoktaPay verified your payment. Your order is now paid.' : 'We have not verified a completed payment. Please do not place another order until you check its status or contact support.'}</p>{result && <div className="order-ticket"><span>Order number<b>{result.orderNumber}</b></span><span>Payment<b>{result.paymentStatus}</b></span><span>Total<b>{money(result.total)}</b></span></div>}{error && <p className="form-error">{error}</p>}<button className="button dark" onClick={check}>Check status again</button></section>;
}

function SuccessPage() {
  const { state } = useLocation();
  const { orderNumber } = useParams();
  const [copied, setCopied] = useState(false);
  const cached = (() => { try { return JSON.parse(sessionStorage.getItem('nix-last-order') || 'null'); } catch { return null; } })();
  const candidate = (state || cached) as OrderResult | null;
  const order = candidate?.orderNumber === orderNumber ? candidate : null;
  const copyOrderNumber = async () => {
    try { await navigator.clipboard.writeText(orderNumber || ''); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  };
  if (!order) return <Empty title="Order details unavailable" text="Use your order number and phone to track your order." action="Back home"/>;
  return <section className="order-success section">
    <div className="order-success-card">
      <div className="order-success-mark"><Check size={27}/></div>
      <span className="eyebrow">ORDER CONFIRMED</span>
      <h1>Thank you.<br/><em>Your order is in.</em></h1>
      <p className="order-success-intro">We’ve received your order and our team is getting it ready. We’ll contact you if we need to confirm any details.</p>
      <div className="order-success-reference"><span>YOUR ORDER NUMBER</span><div><strong>{orderNumber}</strong><button type="button" onClick={copyOrderNumber} aria-label="Copy order number"><ClipboardCheck size={17}/>{copied ? 'Copied' : 'Copy'}</button></div></div>
      <div className="order-success-facts"><div><span>Payment</span><b>{order?.paymentMethod === 'UDDOKTAPAY' ? 'Online payment' : 'Cash on delivery'}</b></div>{order && <div><span>Order total</span><b>{money(order.grandTotal)}</b></div>}</div>
      <div className="order-success-next"><div className="order-success-next-icon"><PackageCheck size={19}/></div><div><b>What happens next?</b><span>We’ll confirm your order, prepare your items, and share delivery updates as they’re available.</span></div></div>
      <div className="order-success-actions"><Link className="button dark" to="/">Continue shopping <ArrowRight size={17}/></Link><Link className="order-success-track" to="/track-order">Track an order <ChevronRight size={16}/></Link></div>
    </div>
  </section>;
}

function Empty({ title, text, action }: { title: string; text: string; action?: string }) {
  return <div className="empty"><ShoppingBag /><h2>{title}</h2><p>{text}</p>{action && <Link className="button dark" to="/">{action}</Link>}</div>;
}

function MaintenancePage({ settings }: { settings: StorefrontSettings }) {
  const [page, setPage] = useState<StorePage | null>(null);
  useEffect(() => { let active = true; getStorePage('maintenance').then(({ page: result }) => { if (active) setPage(result); }).catch(() => undefined); return () => { active = false; }; }, []);
  useEffect(() => { document.title = `We'll be right back | ${settings.storeName}`; }, [settings.storeName]);
  const fill = (value: string) => value.replace(/\{storeName\}/g, settings.storeName).replace(/\{phone\}/g, publicSupportPhone(settings.phone) || 'our support team');
  return <main className="maintenance-page"><div className="maintenance-glow" aria-hidden="true"/><div className="maintenance-card"><div className="maintenance-top"><span className="maintenance-brand">{settings.storeName}</span><span className="maintenance-status"><span/> Temporarily offline</span></div>{page?.coverImage && <img className="maintenance-image" src={page.coverImage} alt=""/>}<div className="maintenance-content"><span className="maintenance-eyebrow">{fill(page?.eyebrow || 'SITE MAINTENANCE')}</span><h1>{fill(page?.title || 'We will be right back.')}</h1><p>{fill(page?.excerpt || `We are making a few improvements to ${settings.storeName}. Please check back shortly.`)}</p>{page?.blocks.map((block) => block.type === 'TEXT' ? <div className="maintenance-block" key={block.id}><h2>{fill(block.heading || '')}</h2><p>{fill(block.text || '')}</p></div> : block.type === 'IMAGE' ? <img className="maintenance-block-image" key={block.id} src={block.url} alt={block.alt || ''}/> : block.type === 'HTML' ? <div className="content-page-html" key={block.id} dangerouslySetInnerHTML={{ __html: block.html || '' }}/> : <a className="maintenance-link" key={block.id} href={block.url}>{block.label} <ArrowRight size={16}/></a>)}{publicSupportPhone(settings.phone) && <a className="maintenance-contact" href={`tel:${settings.phone}`}>Need help with an order? Call {settings.phone} <ArrowRight size={16}/></a>}</div><div className="maintenance-footer">© {new Date().getFullYear()} {settings.storeName} <span>Thank you for your patience.</span></div></div></main>;
}

export default function App() {
  const location = useLocation();
  const { pathname } = location;
  const [settings, setSettings] = useState<StorefrontSettings>(() => getCachedStorefrontSettings() || defaultStorefrontSettings);
  useEffect(() => { getStorefrontSettings().then(({ settings: next }) => setSettings(next)).catch(() => undefined); }, []);
  useEffect(() => { document.title = settings.themeConfig.maintenanceMode ? `We'll be right back | ${settings.storeName}` : `${settings.storeName} — Online Store`; }, [settings.storeName, settings.themeConfig.maintenanceMode]);
  const safeOrderRoute = pathname.startsWith('/payment/result') || /^\/order\//.test(pathname);
  if (settings.themeConfig.maintenanceMode && !safeOrderRoute) return <MaintenancePage settings={settings} />;
  if (pathname.startsWith('/flow/')) return <Navigate replace to={`${pathname.replace(/^\/flow\//, '/')}${location.search}${location.hash}`} />;
  if (pathname.startsWith('/landing/')) return <Navigate replace to={`${pathname.replace(/^\/landing\//, '/')}${location.search}${location.hash}`} />;
  return (
    <>
      <ScrollToTop />
      <AnalyticsLayer settings={settings} />
      <Routes>
        <Route path="/" element={<Layout settings={settings}><HomePage settings={settings} /></Layout>} />
        <Route path="/shop" element={<Layout settings={settings}><ShopPage settings={settings} /></Layout>} />
        <Route path="/product/:id" element={<Layout settings={settings}><ProductPage settings={settings} /></Layout>} />
        <Route path="/cart" element={<Layout settings={settings}><CartPage settings={settings} /></Layout>} />
        <Route path="/checkout" element={<Layout settings={settings}><CheckoutPage settings={settings} /></Layout>} />
        <Route path="/payment/result" element={<Layout settings={settings}><PaymentResultPage /></Layout>} />
        <Route path="/order/:orderNumber" element={<Layout settings={settings}><SuccessPage /></Layout>} />
        <Route path="/signin" element={<Layout settings={settings}><CustomerAuthPage mode="signin" /></Layout>} />
        <Route path="/signup" element={<Layout settings={settings}><CustomerAuthPage mode="signup" /></Layout>} />
        <Route path="/account" element={<Layout settings={settings}><CustomerAccountPage /></Layout>} />
        <Route path="/about" element={<Layout settings={settings}><ContentPage page="about" settings={settings} /></Layout>} />
        <Route path="/delivery" element={<Layout settings={settings}><ContentPage page="delivery" settings={settings} /></Layout>} />
        <Route path="/returns" element={<Layout settings={settings}><ContentPage page="returns" settings={settings} /></Layout>} />
        <Route path="/faq" element={<Layout settings={settings}><ContentPage page="faq" settings={settings} /></Layout>} />
        <Route path="/privacy" element={<Layout settings={settings}><ContentPage page="privacy" settings={settings} /></Layout>} />
        <Route path="/terms" element={<Layout settings={settings}><ContentPage page="terms" settings={settings} /></Layout>} />
        <Route path="/contact" element={<Layout settings={settings}><ContactPage settings={settings} /></Layout>} />
        <Route path="/track-order" element={<Layout settings={settings}><TrackOrderPage /></Layout>} />
        <Route path="/:slug/thank-you" element={<LandingThankYouPage settings={settings} />} />
        <Route path="/:slug" element={<DynamicPageResolver settings={settings} />} />
        <Route path="*" element={<Layout settings={settings}><Empty title="Page not found" text="This page has moved or no longer exists." action="Back home" /></Layout>} />
      </Routes>
    </>
  );
}
