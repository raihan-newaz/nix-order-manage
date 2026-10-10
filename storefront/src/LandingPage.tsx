import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCachedLandingDesign, getCachedProduct, getCachedStorePage, getLandingDesign, getProduct, getStorePage, placeOrder, quoteLandingCoupon, type LandingDesign } from './api';
import { useCustomerAuth } from './context/CustomerAuthContext';
import { generateEventId, getAnalyticsConsent, getMetaCookies, isTrackingAllowed, trackAnalyticsEvent, trackPurchaseOnce } from './analytics';
import type { Product, StorefrontSettings } from './types';
import { LandingCarousel } from './LandingCarousel';
import './landing.css';
import './landingCheckoutEnhancements.css';

type LandingStyle = { background?: string; color?: string; accent?: string; hoverColor?: string; align?: 'left' | 'center'; width?: 'normal' | 'wide'; spacing?: 'compact' | 'normal' | 'spacious'; fontFamily?: 'inherit' | 'Manrope' | 'Hind Siliguri' };
type LandingImageRatio = 'AUTO' | '1:1' | '4:5' | '3:4' | '16:9' | '9:16';
const mediaRatio = (ratio?: LandingImageRatio) => ratio && ratio !== 'AUTO' ? ratio.replace(':', ' / ') : undefined;
type LandingBlock =
  | { id: string; type: 'HERO'; eyebrow: string; heading: string; text: string; image: string; imageRatio?: LandingImageRatio; buttonText?: string; style?: LandingStyle }
  | { id: string; type: 'TEXT_SECTION'; heading: string; text: string; style?: LandingStyle }
  | { id: string; type: 'IMAGE_SECTION'; heading: string; image: string; images?: string[]; imageRatio?: LandingImageRatio; display?: 'SINGLE' | 'CAROUSEL'; caption: string; style?: LandingStyle }
  | { id: string; type: 'SIZE_CHART'; heading: string; columns: string[]; rows: string[][]; note: string; style?: LandingStyle }
  | { id: string; type: 'VIDEO'; heading: string; url: string; autoplay?: boolean; aspectRatio?: 'AUTO' | '16:9' | '9:16' | '4:3' | '1:1'; style?: LandingStyle }
  | { id: string; type: 'GALLERY'; heading: string; images: string[]; imageRatio?: LandingImageRatio; display?: 'GRID' | 'CAROUSEL'; style?: LandingStyle }
  | { id: string; type: 'FEATURES'; heading: string; items: string[]; style?: LandingStyle }
  | { id: string; type: 'TESTIMONIALS'; heading: string; items: Array<{ quote: string; author: string }>; style?: LandingStyle }
  | { id: string; type: 'FAQ'; heading: string; items: Array<{ question: string; answer: string }>; style?: LandingStyle }
  | { id: string; type: 'CTA'; heading: string; text: string; label: string; style?: LandingStyle }
  | { id: string; type: 'COUNTDOWN'; heading: string; endAt: string; style?: LandingStyle }
  | { id: string; type: 'SPACER'; height: number; style?: LandingStyle }
  | { id: string; type: 'CHECKOUT'; heading: string; productIds: string[]; selection: 'SINGLE' | 'MULTI'; minProducts?: number; maxProducts?: number; couponEnabled?: boolean; freeDeliveryMinQuantity?: number; paymentMethods?: Array<'COD' | 'UDDOKTAPAY'>; buttonText: string; billingHeading?: string; productsHeading?: string; nameLabel?: string; namePlaceholder?: string; phoneLabel?: string; phonePlaceholder?: string; addressLabel?: string; addressPlaceholder?: string; footerTitle?: string; footerDeliveryText?: string; footerPrivacyText?: string; style?: LandingStyle };
type LandingRecord = { title: string; slug: string; blocks: LandingBlock[]; metaTitle: string; metaDescription: string };
type Picked = Record<string, { selected: boolean; quantity: number; variantId: string }>;
const money = (amount: number) => `৳${Math.round(amount).toLocaleString('en-BD')}`;
const price = (regular: number, sale: number) => sale > 0 ? sale : regular;
const styleFor = (style?: LandingStyle): CSSProperties => ({ backgroundColor: style?.background || '#ffffff', color: style?.color || '#18212f', textAlign: style?.align || 'left', fontFamily: style?.fontFamily && style.fontFamily !== 'inherit' ? `'${style.fontFamily}', 'Hind Siliguri', sans-serif` : undefined, paddingBlock: style?.spacing === 'compact' ? 28 : style?.spacing === 'spacious' ? 88 : 56, ['--landing-accent' as string]: style?.accent || '#db2777', ['--landing-button-hover' as string]: style?.hoverColor || '#be123c' });
const Flaticon = ({ name, size = 16, className = '' }: { name: string; size?: number; className?: string }) => <i aria-hidden="true" className={`fi fi-rr-${name} ${className}`} style={{ fontSize: size, lineHeight: 1 }} />;
const youtubeId = (value: string) => { try { const url = new URL(value); if (url.protocol !== 'https:') return null; const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, ''); const segment = url.pathname.split('/').filter(Boolean); const id = host === 'youtu.be' ? segment[0] : host === 'youtube.com' ? (url.pathname === '/watch' ? url.searchParams.get('v') : ['shorts', 'live', 'embed'].includes(segment[0]) ? segment[1] : null) : host === 'youtube-nocookie.com' && segment[0] === 'embed' ? segment[1] : null; return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null; } catch { return null; } };

export function LandingPage({ settings, slug: slugOverride, initialPage, initialDesign }: { settings: StorefrontSettings; slug?: string; initialPage?: LandingRecord; initialDesign?: LandingDesign | null }) {
  const { slug: routeSlug = '' } = useParams();
  const slug = slugOverride || routeSlug;
  const initialResolvedPage = initialPage || (getCachedStorePage(`flow-${slug}`) as unknown as LandingRecord | undefined);
  const initialResolvedDesign = initialDesign !== undefined ? initialDesign : (getCachedLandingDesign(`flow-${slug}`) || null);
  const [page, setPage] = useState<LandingRecord | null>(initialResolvedPage || null);
  const [design, setDesign] = useState<LandingDesign | null>(initialResolvedDesign || null);
  const [products, setProducts] = useState<Record<string, Product>>(() => {
    const target = initialResolvedPage;
    if (!target) return {};
    const checkout = target.blocks.find((block): block is Extract<LandingBlock, { type: 'CHECKOUT' }> => block.type === 'CHECKOUT');
    if (!checkout) return {};
    const cached: Record<string, Product> = {};
    for (const id of checkout.productIds) {
      const p = getCachedProduct(id);
      if (p) cached[id] = p;
    }
    return cached;
  });
  const [loading, setLoading] = useState(!initialResolvedPage);
  const [error, setError] = useState('');
  const { customer } = useCustomerAuth();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<Picked>(() => {
    const target = initialResolvedPage;
    if (!target) return {};
    const checkout = target.blocks.find((block): block is Extract<LandingBlock, { type: 'CHECKOUT' }> => block.type === 'CHECKOUT');
    if (!checkout) return {};
    return Object.fromEntries(checkout.productIds.map((id, index) => [id, { selected: index === 0, quantity: 1, variantId: '' }]));
  });
  const [deliveryArea, setDeliveryArea] = useState<'DHAKA_CITY' | 'SUB_AREA' | 'OUTSIDE_DHAKA'>('OUTSIDE_DHAKA');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UDDOKTAPAY'>('COD');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', district: '', city: '', email: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const viewedLanding = useRef('');
  const trackedCheckoutView = useRef('');
  useLayoutEffect(() => {
    document.body.classList.add('landing-route-active');
    return () => document.body.classList.remove('landing-route-active');
  }, []);
  useEffect(() => {
    if (!design || document.getElementById('builder-countdown-runtime')) return;
    const script = document.createElement('script');
    script.id = 'builder-countdown-runtime';
    script.src = '/api/builder/runtime.js';
    script.defer = true;
    document.head.appendChild(script);
  }, [design]);

  useEffect(() => {
    if (!design) return;
    const carousels = document.querySelectorAll<HTMLElement>('.elementor-image-carousel-wrapper, .e-image-carousel');
    if (!carousels.length) return;
    const cleanups: Array<() => void> = [];

    carousels.forEach((carousel) => {
      const track = carousel.querySelector<HTMLElement>('.carousel-track');
      if (!track) return;
      const slides = carousel.querySelectorAll<HTMLElement>('.carousel-slide');
      const total = slides.length;
      if (total <= 1) return;

      const prev = carousel.querySelector<HTMLButtonElement>('.carousel-prev');
      const next = carousel.querySelector<HTMLButtonElement>('.carousel-next');
      const dots = carousel.querySelectorAll<HTMLButtonElement>('.carousel-dot');

      let current = 0;
      let timer: number | null = null;
      const autoplay = carousel.getAttribute('data-autoplay') !== 'false';
      const interval = Number(carousel.getAttribute('data-interval')) || 3500;

      const goTo = (idx: number) => {
        current = (idx + total) % total;
        track.style.transform = `translateX(-${current * 100}%)`;
        dots.forEach((d, i) => {
          if (i === current) {
            d.style.background = '#ffffff';
            d.style.transform = 'scale(1.2)';
            d.classList.add('active');
          } else {
            d.style.background = 'rgba(255,255,255,0.5)';
            d.style.transform = 'scale(1)';
            d.classList.remove('active');
          }
        });
      };

      const startTimer = () => {
        if (!autoplay) return;
        stopTimer();
        timer = window.setInterval(() => goTo(current + 1), interval);
      };

      const stopTimer = () => {
        if (timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      };

      const handlePrev = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        goTo(current - 1);
        startTimer();
      };

      const handleNext = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        goTo(current + 1);
        startTimer();
      };

      if (prev) prev.addEventListener('click', handlePrev);
      if (next) next.addEventListener('click', handleNext);

      dots.forEach((d) => {
        const dotHandler = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          const idx = Number(d.getAttribute('data-index'));
          if (!isNaN(idx)) goTo(idx);
          startTimer();
        };
        d.addEventListener('click', dotHandler);
      });

      let touchStartX = 0;
      let touchEndX = 0;
      const handleTouchStart = (e: TouchEvent) => {
        touchStartX = e.changedTouches[0].screenX;
        stopTimer();
      };
      const handleTouchEnd = (e: TouchEvent) => {
        touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 40) {
          goTo(current + 1);
        } else if (touchEndX - touchStartX > 40) {
          goTo(current - 1);
        }
        startTimer();
      };

      carousel.addEventListener('mouseenter', stopTimer);
      carousel.addEventListener('mouseleave', startTimer);
      carousel.addEventListener('touchstart', handleTouchStart, { passive: true });
      carousel.addEventListener('touchend', handleTouchEnd, { passive: true });

      goTo(0);
      startTimer();

      cleanups.push(() => {
        stopTimer();
        if (prev) prev.removeEventListener('click', handlePrev);
        if (next) next.removeEventListener('click', handleNext);
        carousel.removeEventListener('mouseenter', stopTimer);
        carousel.removeEventListener('mouseleave', startTimer);
        carousel.removeEventListener('touchstart', handleTouchStart);
        carousel.removeEventListener('touchend', handleTouchEnd);
      });
    });

    return () => {
      cleanups.forEach((c) => c());
    };
  }, [design]);
  const scrollToOrderSection = () => {
    let attempts = 0;
    const maxAttempts = 25;
    const runScroll = () => {
      const target = document.getElementById('order')
        || document.getElementById('order-form')
        || document.querySelector('.landing-checkout-section')
        || document.querySelector('#landing-checkout')
        || document.querySelector('[data-builder-type="CHECKOUT"]');
      if (!target) {
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(runScroll, 50);
        }
        return;
      }
      const topbar = document.querySelector('.landing-topbar') || document.querySelector('.builder-header');
      const headerOffset = topbar ? (topbar.getBoundingClientRect().height || 50) + 16 : 60;
      const startY = window.pageYOffset;
      const startTime = performance.now();
      const duration = 650;

      const step = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / duration);
        const ease = 1 - Math.pow(1 - progress, 3);
        const targetRect = target.getBoundingClientRect();
        const currentTargetY = window.pageYOffset + targetRect.top - headerOffset;
        const newY = startY + (currentTargetY - startY) * ease;
        window.scrollTo(0, Math.max(0, newY));

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          const finalRect = target.getBoundingClientRect();
          window.scrollTo(0, Math.max(0, window.pageYOffset + finalRect.top - headerOffset));
        }
      };

      requestAnimationFrame(step);
      try { window.history.replaceState(window.history.state, '', '#order'); } catch (_) {}
    };
    runScroll();
  };
  useEffect(() => {
    let cancelled = false;
    const cachedPage = (getCachedStorePage(`flow-${slug}`) as unknown as LandingRecord | undefined);
    const readyPage = initialPage?.slug === `flow-${slug}` ? initialPage : (cachedPage?.slug === `flow-${slug}` ? cachedPage : null);
    if (!readyPage && !page) {
      setLoading(true);
    }
    const pageRequest = readyPage ? Promise.resolve({ page: readyPage }) : getStorePage(`flow-${slug}`);
    pageRequest.then(async ({ page: result }) => {
      if (cancelled) return;
      const landing = result as unknown as LandingRecord;
      const checkoutBlock = landing.blocks.find((block): block is Extract<LandingBlock, { type: 'CHECKOUT' }> => block.type === 'CHECKOUT');
      if (!checkoutBlock) throw new Error('Landing page is unavailable');
      setPicked((prev) => {
        if (Object.keys(prev).length && checkoutBlock.productIds.every(id => prev[id])) return prev;
        return Object.fromEntries(checkoutBlock.productIds.map((id, index) => [id, prev[id] || { selected: index === 0, quantity: 1, variantId: '' }]));
      });
      const productRequest = Promise.all(checkoutBlock.productIds.map(id => {
        const cached = getCachedProduct(id);
        return cached ? Promise.resolve(cached) : getProduct(id).then(({ product }) => product).catch(() => null);
      }));
      const designRequest = readyPage && initialDesign !== undefined ? Promise.resolve(initialDesign) : getLandingDesign(landing.slug);
      const publishedDesign = await designRequest;
      if (cancelled) return;
      setPage(landing);
      setDesign(publishedDesign || null);
      setLoading(false);
      const found = await productRequest;
      if (cancelled) return;
      setProducts((prev) => {
        const next = { ...prev };
        for (const item of found) {
          if (item) next[item.id] = item;
        }
        return next;
      });
    }).catch((err) => {
      if (!cancelled && !page) setError(err.message || 'Landing page could not be loaded');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug, initialPage, initialDesign]);
  useEffect(() => {
    if (window.location.hash === '#order' || window.location.hash === '#order-form' || window.location.hash === '#checkout') {
      const timer = setTimeout(() => {
        scrollToOrderSection();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [page, design]);
  useEffect(() => { if (customer) setForm((current) => ({ ...current, name: customer.name || current.name, phone: customer.phone || current.phone, email: customer.email || current.email, address: customer.address || current.address, district: customer.district || current.district, city: customer.city || current.city })); }, [customer]);
  useEffect(() => { if (!page) return; document.title = page.metaTitle || `${page.title} | ${settings.storeName}`; let description = document.querySelector('meta[name="description"]'); if (!description) { description = document.createElement('meta'); description.setAttribute('name', 'description'); document.head.appendChild(description); } description.setAttribute('content', page.metaDescription || page.title); }, [page, settings.storeName]);
  const checkout = page?.blocks.find((block): block is Extract<LandingBlock, { type: 'CHECKOUT' }> => block.type === 'CHECKOUT');
  const followStudioOrderLink = (event: MouseEvent<HTMLElement>) => {
    const targetEl = event.target as Element | null;
    if (!targetEl || typeof targetEl.closest !== 'function') return;
    const anchor = targetEl.closest('a[href], button[data-action="order"], .landing-order-link, .landing-top-cta, .builder-button, [data-action="order"]');
    if (!anchor || !event.currentTarget.contains(anchor)) return;
    const href = (anchor.getAttribute('href') || anchor.getAttribute('data-href') || '').toLowerCase();
    const isOrderAction = ['#order', '#order-form', '#checkout', '#landing-checkout'].some((hash) => href.includes(hash))
      || href === '#order'
      || anchor.getAttribute('data-action') === 'order'
      || anchor.classList.contains('landing-top-cta')
      || anchor.classList.contains('landing-order-link');
    if (!isOrderAction) return;
    event.preventDefault();
    scrollToOrderSection();
  };
  const selectedItems = useMemo(() => (checkout?.productIds || []).flatMap((id) => {
    const product = products[id];
    const choice = picked[id];
    if (!product || !choice?.selected) return [];
    const variant = product.productType === 'VARIABLE'
      ? (product.variants.find((item) => item.id === choice.variantId) || product.variants.find((item) => item.inStock) || product.variants[0])
      : undefined;
    if (!product.inStock || (product.productType === 'VARIABLE' && (!variant || !variant.inStock))) return [];
    return [{
      productId: id,
      variantId: variant?.id || null,
      quantity: choice.quantity,
      name: product.name,
      image: product.image,
      price: variant ? price(variant.regularPrice, variant.salePrice) : price(product.regularPrice, product.salePrice)
    }];
  }), [checkout, products, picked]);
  const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const freeDelivery = Boolean(checkout?.freeDeliveryMinQuantity && selectedItems.reduce((sum, item) => sum + item.quantity, 0) >= checkout.freeDeliveryMinQuantity);
  const delivery = freeDelivery ? 0 : deliveryArea === 'DHAKA_CITY' ? settings.insideDhakaCharge : deliveryArea === 'SUB_AREA' ? settings.subAreaCharge : settings.outsideDhakaCharge;
  const selectionCount = Object.values(picked).filter((item) => item.selected).length;
  const minProducts = checkout?.minProducts ?? 1;
  const maxProducts = checkout?.selection === 'SINGLE' ? 1 : checkout?.maxProducts ?? checkout?.productIds.length ?? 1;
  const itemKey = JSON.stringify(selectedItems.map(({ productId, variantId, quantity }) => [productId, variantId, quantity]));
  useEffect(() => {
    const items = (checkout?.productIds || []).map((id) => products[id]).filter((product): product is Product => Boolean(product));
    const send = () => {
      if (!page || !items.length || viewedLanding.current === slug || !isTrackingAllowed()) return;
      const eventId = trackAnalyticsEvent('view_item', { currency: 'BDT', value: items.reduce((sum, item) => sum + price(item.regularPrice, item.salePrice), 0), items: items.map((item) => ({ id: item.id, name: item.name, category: item.category, price: price(item.regularPrice, item.salePrice), quantity: 1 })) });
      if (eventId) viewedLanding.current = slug;
    };
    send();
    window.addEventListener('nix-analytics-consent', send);
    return () => window.removeEventListener('nix-analytics-consent', send);
  }, [page, checkout, products, slug]);
  useEffect(() => {
    if (!page || !checkout || trackedCheckoutView.current === slug) return;
    const section = document.getElementById('order');
    if (!section) return;
    const send = () => {
      const rect = section.getBoundingClientRect();
      if (trackedCheckoutView.current === slug || !isTrackingAllowed() || rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      const eventId = trackAnalyticsEvent('begin_checkout', { currency: 'BDT', value: subtotal, items: selectedItems.map((item) => ({ id: item.productId, name: item.name, price: item.price, quantity: item.quantity })) });
      if (eventId) { trackedCheckoutView.current = slug; observer.disconnect(); }
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) send();
    }, { threshold: 0.15 });
    observer.observe(section);
    window.addEventListener('nix-analytics-consent', send);
    send();
    return () => { observer.disconnect(); window.removeEventListener('nix-analytics-consent', send); };
  }, [page, checkout, slug, itemKey, subtotal]);
  useEffect(() => { setAppliedCoupon(null); }, [itemKey]);
  useEffect(() => { if (checkout?.paymentMethods?.length && !checkout.paymentMethods.includes(paymentMethod)) setPaymentMethod(checkout.paymentMethods[0]); }, [checkout, paymentMethod]);
  const choose = (id: string) => setPicked((current) => { const wasSelected = current[id]?.selected; if (!wasSelected && checkout?.selection === 'MULTI' && Object.values(current).filter((item) => item.selected).length >= maxProducts) { setError(`সর্বোচ্চ ${maxProducts}টি পণ্য বেছে নিতে পারবেন`); return current; } setError(''); return Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, selected: checkout?.selection === 'SINGLE' ? key === id : key === id ? !value.selected : value.selected }])); });
  const applyCoupon = async () => { if (!page || !couponInput.trim() || !selectedItems.length) return; setCouponBusy(true); setCouponError(''); try { const quote = await quoteLandingCoupon({ pageSlug: page.slug, code: couponInput.trim(), items: selectedItems.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })) }); setAppliedCoupon({ code: quote.code, discount: quote.discount }); } catch (err: any) { setCouponError(err.message || 'Coupon code is invalid'); setAppliedCoupon(null); } finally { setCouponBusy(false); } };
  const total = Math.max(0, subtotal + delivery - (appliedCoupon?.discount || 0));
  const chooseLandingPayment = (method: 'COD' | 'UDDOKTAPAY') => {
    setPaymentMethod(method);
    trackAnalyticsEvent('add_payment_info', { currency: 'BDT', value: total, payment_type: method === 'COD' ? 'Cash on Delivery' : 'UddoktaPay Online', items: selectedItems.map((item) => ({ id: item.productId, name: item.name, price: item.price, quantity: item.quantity })) });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (selectionCount < minProducts || selectionCount > maxProducts || selectedItems.length !== selectionCount) {
      setError(`কমপক্ষে ${minProducts}টি উপলব্ধ পণ্য এবং প্রয়োজনীয় সাইজ/রং বেছে নিন`);
      document.getElementById('landing-products')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { fbc, fbp } = getMetaCookies();
      const _eventId = generateEventId();
      const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const result = await placeOrder({
        customer: { ...form, email: form.email || undefined },
        items: selectedItems.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
        deliveryArea,
        paymentMethod,
        pageSlug: page?.slug,
        couponCode: appliedCoupon?.code,
        _fbc: fbc,
        _fbp: fbp,
        _eventId,
        _trackingConsent: isTrackingAllowed(),
        idempotencyKey,
      }, idempotencyKey);
      if (paymentMethod === 'UDDOKTAPAY') {
        if (!result.paymentUrl) throw new Error('Payment link was not returned');
        try {
          sessionStorage.setItem('nix-pending-purchase', JSON.stringify({
            orderNumber: result.order.orderNumber,
            landingSlug: slug,
            orderItems: selectedItems.map((item) => ({ productId: item.productId, productName: item.name, image: item.image, quantity: item.quantity, unitPrice: item.price })),
            eventId: _eventId,
            params: {
              currency: 'BDT',
              value: result.order.grandTotal,
              shipping: result.order.deliveryCharge,
              transaction_id: result.order.orderNumber,
              coupon: appliedCoupon?.code,
              items: selectedItems.map((item) => ({ id: item.productId, name: item.name, price: item.price, quantity: item.quantity }))
            }
          }));
        } catch { /* server CAPI still records verified orders */ }
        window.location.assign(result.paymentUrl);
        return;
      }
      trackPurchaseOnce(result.order.orderNumber, {
        currency: 'BDT',
        value: result.order.grandTotal,
        shipping: result.order.deliveryCharge,
        transaction_id: result.order.orderNumber,
        coupon: appliedCoupon?.code,
        items: selectedItems.map((item) => ({ id: item.productId, name: item.name, price: item.price, quantity: item.quantity }))
      }, _eventId);
      const orderPayload = {
        ...result.order,
        items: selectedItems.map((item) => ({ productId: item.productId, productName: item.name, image: item.image, quantity: item.quantity, unitPrice: item.price })),
        landingSlug: slug,
        customerName: form.name || result.order.customerName || 'সম্মানিত ক্রেতা',
        customerPhone: form.phone || result.order.customerPhone || '',
        deliveryAddress: form.address || result.order.deliveryAddress || ''
      };
      try { sessionStorage.setItem('nix-last-order', JSON.stringify(orderPayload)); } catch { /* Router state preserves the confirmation when storage is unavailable. */ }
      navigate(`/${slug}/thank-you?order=${result.order.orderNumber}`, { state: orderPayload });
    } catch (err: any) {
      setError(err.message || 'Could not place order');
    } finally {
      setSubmitting(false);
    }
  };
  if (loading) return <main className="landing-loading" aria-busy="true" aria-label="Page loading"><div className="landing-loading-spinner" /></main>;
  if (!page || !checkout) return <main className="landing-loading"><h1>Page unavailable</h1><p>{error || 'This offer is not published.'}</p><Link to="/">Back to store</Link></main>;
  const submitLabel = (block: Extract<LandingBlock, { type: 'CHECKOUT' }>) => {
    const label = (block.buttonText || 'অর্ডার সম্পূর্ণ করুন').replace(/\s*(?:[·•|–—-]\s*)?(?:৳|Tk\.?\s*)[\d,]+(?:\.\d{1,2})?\s*$/i, '').trim();
    return `${label || 'অর্ডার সম্পূর্ণ করুন'} · ${money(total)}`;
  };
  return <main className="landing-page" onClick={followStudioOrderLink}>{!design && page.blocks[0]?.type !== 'COUNTDOWN' && <header className="landing-topbar"><Link to="/" className="landing-brand">{settings.storeName}</Link><a href="#order" onClick={(event) => { event.preventDefault(); scrollToOrderSection(); }} className="landing-top-cta">এখনই অর্ডার করুন <Flaticon name="hand-back-point-down" size={18}/></a></header>}{design && <><style>{design.css}</style><div dangerouslySetInnerHTML={{ __html: design.html }} /></>}{page.blocks.filter((block) => !design || block.type === 'CHECKOUT').map((block) => block.type === 'CHECKOUT' ? <section key={block.id} id="order" className="landing-section landing-checkout-section" style={styleFor(block.style)}><div id="order-form" className="landing-inner landing-checkout-shell"><div className="landing-checkout-title"><h2>{block.heading || 'অর্ডার করতে, নিচের ফর্মটি পূর্ণ করুন।'}</h2><p>{paymentMethod === 'COD' ? 'আগে কোনো টাকা দিতে হবে না। প্রোডাক্ট হাতে পাওয়ার পর পরিশোধ করবেন।' : 'নিরাপদ অনলাইন পেমেন্টে অর্ডার সম্পন্ন করুন।'}</p></div>{!customer && <div className="landing-returning-customer"><Flaticon name="info" size={18}/><span>Returning customer? <Link to={`/signin?returnTo=${encodeURIComponent(window.location.pathname)}`}>Click here to login</Link></span></div>}<form onSubmit={submit} className="landing-checkout-grid"><div className="landing-checkout-main"><section className="landing-billing"><h3>{block.billingHeading || 'বিলিং ঠিকানা'}</h3><div className="landing-fields"><label className="wide"><span>{block.nameLabel || 'আপনার নাম লিখুন'} <b>*</b></span><input required minLength={2} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={block.namePlaceholder || 'নাম লিখুন'}/></label><label className="wide"><span>{block.phoneLabel || 'আপনার মোবাইল নাম্বার লিখুন'} <b>*</b></span><input required inputMode="tel" autoComplete="tel" pattern="01[3-9][0-9]{8}" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder={block.phonePlaceholder || 'মোবাইল নাম্বার লিখুন'}/></label>{paymentMethod === 'UDDOKTAPAY' && <label className="wide landing-payment-email"><span>ইমেইল ঠিকানা <b>*</b></span><input type="email" required autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Payment receipt-এর জন্য ইমেইল"/></label>}<label className="wide"><span>{block.addressLabel || 'আপনার সম্পূর্ণ ঠিকানা লিখুন'} <b>*</b></span><textarea required minLength={8} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder={block.addressPlaceholder || 'ঠিকানা লিখুন, থানা ও জেলা সহ'}/></label></div></section><section id="landing-products" className="landing-products-table-wrap"><h3>{block.productsHeading || 'Your Products'}</h3><div className="landing-products-table-scroll"><table className="landing-products-table"><thead><tr><th>Product</th><th>Quantity</th><th>Price</th></tr></thead><tbody>{block.productIds.map((id) => { const product = products[id]; const choice = picked[id]; if (!product) return <tr key={id}><td colSpan={3} className="landing-unavailable">এই পণ্যটি এখন পাওয়া যাচ্ছে না।</td></tr>; const variant = product.productType === 'VARIABLE' ? product.variants.find((item) => item.id === choice?.variantId) : undefined; const itemPrice = variant ? price(variant.regularPrice, variant.salePrice) : price(product.regularPrice, product.salePrice); return <tr key={id} className={choice?.selected ? 'is-selected' : ''}><td><label className="landing-product-choice"><input type="checkbox" checked={Boolean(choice?.selected)} disabled={!product.inStock} onChange={() => choose(id)}/><span><b>{product.name}</b></span></label>{product.productType === 'VARIABLE' && choice?.selected && <LandingVariationPicker product={product} choice={choice} onSelectVariant={(variantId) => setPicked((current) => ({ ...current, [id]: { ...current[id], variantId } }))}/>}</td><td><div className="landing-table-quantity"><button type="button" aria-label="Decrease quantity" onClick={() => setPicked((current) => ({ ...current, [id]: { ...current[id], quantity: Math.max(1, current[id].quantity - 1) } }))}>−</button><span>{choice?.quantity || 1}</span><button type="button" aria-label="Increase quantity" onClick={() => setPicked((current) => ({ ...current, [id]: { ...current[id], quantity: Math.min(10, current[id].quantity + 1) } }))}>+</button></div></td><td>{product.inStock ? money(itemPrice * (choice?.quantity || 1)) : 'স্টকে নেই'}</td></tr>; })}</tbody></table></div></section></div><aside className="landing-checkout-side"><section className="landing-order-summary"><h3>আপনার অর্ডার</h3><table><thead><tr><th>Product</th><th>Subtotal</th></tr></thead><tbody>{selectedItems.length ? selectedItems.map((item) => <tr key={item.productId}><td><div className="landing-summary-product"><button type="button" aria-label="Remove product" onClick={() => setPicked((current) => ({ ...current, [item.productId]: { ...current[item.productId], selected: false } }))}>×</button><img src={products[item.productId]?.image || '/images/catalog-fallback.png'} alt=""/><b>{item.name} × {item.quantity}</b></div></td><td>{money(item.price * item.quantity)}</td></tr>) : <tr><td colSpan={2}>পণ্য নির্বাচন করুন</td></tr>}</tbody></table><div className="landing-summary-line"><span>Subtotal</span><b>{money(subtotal)}</b></div><fieldset className="landing-shipping-fieldset"><legend>ডেলিভারি এলাকা</legend><div className="landing-shipping-options">{([["DHAKA_CITY", "ঢাকার ভেতরে", settings.insideDhakaCharge], ["SUB_AREA", "ঢাকার পার্শ্ববর্তী এলাকা", settings.subAreaCharge], ["OUTSIDE_DHAKA", "ঢাকার বাইরে", settings.outsideDhakaCharge]] as const).map(([area, label, fee]) => <label className="landing-shipping-option" key={area}><span><input type="radio" name="landing-shipping" checked={deliveryArea === area} onChange={() => setDeliveryArea(area)}/>{label}</span><b>{money(freeDelivery ? 0 : fee)}</b></label>)}</div></fieldset><div className="landing-summary-line"><span>ডেলিভারি চার্জ</span><b>{money(delivery)}</b></div>{appliedCoupon && <div className="landing-summary-line discount"><span>Coupon · {appliedCoupon.code}</span><b>−{money(appliedCoupon.discount)}</b></div>}<div className="landing-summary-line total"><span>Total</span><b>{money(total)}</b></div></section>{Boolean(block.couponEnabled) && <details className="landing-coupon"><summary>Have a coupon?</summary><div className="landing-coupon-body"><label htmlFor="landing-coupon-code">Coupon code</label><div><input id="landing-coupon-code" value={couponInput} onChange={(event) => setCouponInput(event.target.value.toUpperCase())} placeholder="Enter coupon code" autoComplete="off"/><button type="button" disabled={couponBusy || !couponInput.trim() || !selectedItems.length} onClick={applyCoupon}>{couponBusy ? 'Checking…' : 'Apply'}</button></div>{appliedCoupon && <p className="landing-coupon-success">{appliedCoupon.code} applied · −{money(appliedCoupon.discount)} <button type="button" onClick={() => { setAppliedCoupon(null); setCouponInput(''); }}>Remove</button></p>}{couponError && <p className="landing-error" role="alert">{couponError}</p>}</div></details>}<section className="landing-payment-box">{(block.paymentMethods || ['COD']).includes('COD') && <><label className="landing-cod-choice"><input type="radio" name="landing-payment" checked={paymentMethod === 'COD'} onChange={() => chooseLandingPayment('COD')}/><b>Cash on delivery</b></label>{paymentMethod === 'COD' && <div className="landing-cod-note">Pay with cash upon delivery.</div>}</>}{settings.onlinePaymentEnabled && (block.paymentMethods || ['COD']).includes('UDDOKTAPAY') && <><label className="landing-online-payment"><input type="radio" name="landing-payment" checked={paymentMethod === 'UDDOKTAPAY'} onChange={() => chooseLandingPayment('UDDOKTAPAY')}/> নিরাপদে অনলাইনে পেমেন্ট</label>{paymentMethod === 'UDDOKTAPAY' && <div className="landing-cod-note">অর্ডার নিশ্চিত করার পর নিরাপদ payment page খুলবে।</div>}</>}</section>{error && <p className="landing-error" role="alert">{error}</p>}<p className="landing-privacy-copy">Your personal data will be used to process your order, support your experience throughout this website, and for other purposes described in our <Link to="/privacy">privacy policy</Link>.</p><button className="landing-submit" type="submit" disabled={submitting || selectionCount < minProducts || selectedItems.length !== selectionCount || paymentMethod === 'UDDOKTAPAY' && !settings.onlinePaymentEnabled}>{submitting ? 'অর্ডার করা হচ্ছে…' : <><Flaticon name="lock" size={15}/> {submitLabel(block)}</>}</button></aside></form></div></section> : <LandingSection key={block.id} block={block} onOrderClick={scrollToOrderSection}/>)}{design?.footerHtml ? <><style>{design.footerCss}</style><div dangerouslySetInnerHTML={{ __html: design.footerHtml }}/></> : <footer className="landing-footer"><span>{checkout?.footerTitle || settings.storeName}</span><span><Flaticon name="truck-side" size={15}/> {checkout?.footerDeliveryText || 'সারা বাংলাদেশে ডেলিভারি'}</span><Link to="/privacy">{checkout?.footerPrivacyText || 'গোপনীয়তা নীতি'}</Link><span>© {new Date().getFullYear()} {settings.storeName}</span></footer>}</main>;
}

function LandingSection({ block, onOrderClick }: { block: Exclude<LandingBlock, { type: 'CHECKOUT' }>; onOrderClick?: () => void }) {
  if (block.type === 'SPACER') return <div style={{ height: block.height, background: block.style?.background || '#ffffff' }} />;
  if (block.type === 'COUNTDOWN') return <section className="landing-section landing-countdown" style={styleFor(block.style)}><div className="landing-inner"><LandingCountdown heading={block.heading} endAt={block.endAt}/></div></section>;
  const innerClass = `landing-inner ${block.style?.width === 'wide' ? 'wide' : ''}`;
  const button = (label: string) => <a className="landing-order-link" href="#order" onClick={(event) => { event.preventDefault(); onOrderClick ? onOrderClick() : document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} style={{ background: block.style?.accent || '#db2777' }}>{label}<Flaticon name="hand-back-point-down" size={21}/></a>;
  if (block.type === 'TEXT_SECTION') return <section className="landing-section" style={styleFor(block.style)}><div className={innerClass}><h2>{block.heading}</h2><div className="landing-story-list">{block.text.split(/\n+/).filter(Boolean).map((paragraph, index) => <div className="landing-story-item" key={index}><Flaticon name="badge-check" size={18}/><p>{paragraph}</p></div>)}</div></div></section>;
  if (block.type === 'IMAGE_SECTION') { const images = block.display === 'CAROUSEL' ? (block.images?.length ? block.images : block.image ? [block.image] : []) : []; return <section className="landing-section" style={styleFor(block.style)}><figure className={`${innerClass} landing-figure`}><h2>{block.heading}</h2>{block.display === 'CAROUSEL' ? images.length ? <LandingCarousel images={images} label={block.heading || 'Product images'} ratio={mediaRatio(block.imageRatio)}/> : <div className="landing-image-placeholder" aria-label="Add product image"/> : block.image ? <img src={block.image} alt={block.caption || block.heading} loading="lazy" style={{ aspectRatio: mediaRatio(block.imageRatio) }}/> : <div className="landing-image-placeholder" aria-label="Add product image"/>}{block.caption && <figcaption>{block.caption}</figcaption>}</figure></section>; }
  if (block.type === 'SIZE_CHART') return <section className="landing-section" style={styleFor(block.style)}><div className={innerClass}><h2>{block.heading}</h2><div className="landing-table-scroll"><table className={`landing-size-table ${block.style?.align === 'left' ? 'is-left' : 'is-centered'}`}><thead><tr>{block.columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr></thead><tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>{block.note && <p className="landing-table-note">{block.note}</p>}</div></section>;
  if (block.type === 'HERO') return <section className="landing-section landing-hero" style={styleFor(block.style)}><div className={innerClass}><span className="landing-eyebrow" style={{ color: block.style?.accent || '#db2777' }}>{block.eyebrow}</span><h1>{block.heading}</h1><p>{block.text}</p>{button(block.buttonText || 'এখনই বুকিং করুন')}{block.image && <img className="landing-hero-image" src={block.image} alt={block.heading} loading="eager" style={{ aspectRatio: mediaRatio(block.imageRatio) }}/>}</div></section>;
  if (block.type === 'VIDEO') { const id = youtubeId(block.url); const shortUrl = (() => { try { return new URL(block.url).pathname.startsWith('/shorts/'); } catch { return false; } })(); const ratio = block.aspectRatio && block.aspectRatio !== 'AUTO' ? block.aspectRatio : shortUrl ? '9:16' : '16:9'; const [ratioWidth, ratioHeight] = ratio.split(':').map(Number); const autoplay = block.autoplay ? '?autoplay=1&playsinline=1&rel=0' : '?playsinline=1&rel=0'; return <section className="landing-section" style={styleFor(block.style)}><div className={innerClass}><h2>{block.heading}</h2>{id ? <div className={`landing-video ${ratio === '9:16' ? 'portrait' : ''}`} style={{ aspectRatio: `${ratioWidth} / ${ratioHeight}` }}><iframe src={`https://www.youtube-nocookie.com/embed/${id}${autoplay}`} title={block.heading || 'Product video'} loading="lazy" allow="autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div> : <div className="landing-video-placeholder" style={{ aspectRatio: `${ratioWidth} / ${ratioHeight}` }}><span>▶</span><small>YouTube video · builder থেকে URL যোগ করুন</small></div>}</div></section>; }
  if (block.type === 'GALLERY') return <section className="landing-section" style={styleFor(block.style)}><div className={innerClass}><h2>{block.heading}</h2>{block.display === 'CAROUSEL' ? <LandingCarousel images={block.images} label={block.heading || 'Product gallery'} ratio={mediaRatio(block.imageRatio)}/> : <div className="landing-gallery">{block.images.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`${block.heading} ${index + 1}`} loading="lazy" style={{ aspectRatio: mediaRatio(block.imageRatio) }}/>)}</div>}</div></section>;
  if (block.type === 'FEATURES') return <section className="landing-section" style={styleFor(block.style)}><div className={innerClass}><h2>{block.heading}</h2><div className="landing-feature-grid">{block.items.map((item, index) => <div key={index}><span className={`landing-feature-check tone-${index % 4}`}><Flaticon name={['tshirt','palette','sparkles','ruler'][index % 4]} size={19}/></span><p>{item}</p></div>)}</div></div></section>;
  if (block.type === 'TESTIMONIALS') return <section className="landing-section" style={styleFor(block.style)}><div className={innerClass}><h2>{block.heading}</h2><LandingReviews items={block.items}/></div></section>;
  if (block.type === 'FAQ') return <section className="landing-section" style={styleFor(block.style)}><div className={innerClass}><h2>{block.heading}</h2><div className="landing-faq">{block.items.map((item, index) => <details key={index}><summary>{item.question}<Flaticon name="angle-small-down" size={17}/></summary><p>{item.answer}</p></details>)}</div></div></section>;
  return <section className="landing-section landing-cta" style={styleFor(block.style)}><div className={innerClass}><h2>{block.heading}</h2><p>{block.text}</p>{button(block.label)}</div></section>;
}

function LandingCountdown({ heading, endAt }: { heading: string; endAt: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, (Date.parse(endAt) || Date.now()) - Date.now()));
  useEffect(() => { const tick = () => { const deadline = Date.parse(endAt); setRemaining(Number.isFinite(deadline) ? Math.max(0, deadline - Date.now()) : 0); }; tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer); }, [endAt]);
  const totalSeconds = Math.floor(remaining / 1000);
  const values = [Math.floor(totalSeconds / 86400), Math.floor(totalSeconds / 3600) % 24, Math.floor(totalSeconds / 60) % 60, totalSeconds % 60];
  return <><h2>{heading}</h2>{remaining > 0 ? <div className="landing-countdown-grid">{values.map((value, index) => <div key={index}><b>{String(value).padStart(2, '0')}</b><small>{['দিন', 'ঘণ্টা', 'মিনিট', 'সেকেন্ড'][index]}</small></div>)}</div> : <p className="landing-countdown-ended">অফারের সময় শেষ</p>}</>;
}

function LandingReviews({ items }: { items: Array<{ quote: string; author: string }> }) {
  const [active, setActive] = useState(0);
  if (!items.length) return <div className="landing-review-empty">ক্রেতাদের মতামত যোগ করুন</div>;
  const select = (step: number) => setActive((current) => (current + step + items.length) % items.length);
  const item = items[active];
  return <div className="landing-review-carousel"><button type="button" aria-label="আগের মতামত" onClick={() => select(-1)}>‹</button><blockquote><span aria-label="5 stars">★★★★★</span><p>“{item.quote}”</p><cite>— {item.author}</cite></blockquote><button type="button" aria-label="পরের মতামত" onClick={() => select(1)}>›</button><div className="landing-review-dots">{items.map((_, index) => <button key={index} type="button" aria-label={`মতামত ${index + 1}`} aria-current={active === index} onClick={() => setActive(index)}/>)}</div></div>;
}

function LandingVariationPicker({
  product,
  choice,
  onSelectVariant
}: {
  product: Product;
  choice?: { variantId?: string | null };
  onSelectVariant: (variantId: string) => void;
}) {
  const currentVariant = product.variants.find((v) => v.id === choice?.variantId) || product.variants.find((v) => v.inStock) || product.variants[0];
  const selectedAttrs = currentVariant?.attributes || {};

  // Extract attributes
  let attrs = (product.attributes || []).filter((a) => (a.options || a.values)?.length);
  if (!attrs.length && product.variants.length > 0) {
    const keys = Object.keys(product.variants[0].attributes || {});
    attrs = keys.map((key) => ({
      name: key,
      type: /color/i.test(key) ? 'COLOR' : /size/i.test(key) ? 'SIZE_TEXT' : 'TEXT',
      options: [...new Set(product.variants.map((v) => v.attributes[key]).filter(Boolean))]
    }));
  }

  // Sort so Color is first, Size is second
  attrs = [...attrs].sort((a, b) => {
    const isColorA = /color/i.test(a.name) ? 0 : /size/i.test(a.name) ? 1 : 2;
    const isColorB = /color/i.test(b.name) ? 0 : /size/i.test(b.name) ? 1 : 2;
    return isColorA - isColorB;
  });

  const handleAttributeChange = (attrName: string, val: string) => {
    const nextAttrs = { ...selectedAttrs, [attrName]: val };
    const normalize = (s: unknown) => String(s || '').trim().toLowerCase();
    
    let matched = product.variants.find((v) => {
      const vAttrs = v.attributes || {};
      return v.inStock && Object.entries(nextAttrs).every(([k, vVal]) => {
        const matchingKey = Object.keys(vAttrs).find((vk) => normalize(vk) === normalize(k));
        return matchingKey ? normalize(vAttrs[matchingKey]) === normalize(vVal) : true;
      });
    });
    if (!matched) {
      matched = product.variants.find((v) => {
        const vAttrs = v.attributes || {};
        return Object.entries(nextAttrs).every(([k, vVal]) => {
          const matchingKey = Object.keys(vAttrs).find((vk) => normalize(vk) === normalize(k));
          return matchingKey ? normalize(vAttrs[matchingKey]) === normalize(vVal) : true;
        });
      });
    }
    if (!matched) {
      matched = product.variants.find((v) => {
        const vAttrs = v.attributes || {};
        const matchingKey = Object.keys(vAttrs).find((vk) => normalize(vk) === normalize(attrName));
        return matchingKey ? normalize(vAttrs[matchingKey]) === normalize(val) : false;
      });
    }
    if (matched) {
      onSelectVariant(matched.id);
    }
  };

  const colorHexMap: Record<string, string> = {
    'black': '#18181b',
    'jet black': '#18181b',
    'emerald green': '#064e3b',
    'maroon': '#800000',
    'navy blue': '#000080',
    'navy': '#000080',
    'bottle green': '#004225',
    'green': '#15803d',
    'red': '#dc2626',
    'blue': '#2563eb',
    'white': '#ffffff',
    'olive': '#808000'
  };

  return (
    <div className="landing-swatch-picker" role="group" aria-label={`${product.name} variations`}>
      {attrs.map((attribute) => {
        const rawOptions = attribute.options || attribute.values || [];
        const isColor = attribute.type === 'COLOR' || /color/i.test(attribute.name);
        const isSize = attribute.type === 'SIZE_NUMBER' || attribute.type === 'SIZE_TEXT' || /size/i.test(attribute.name);
        const selectedVal = selectedAttrs[attribute.name] || rawOptions[0];

        return (
          <div className="landing-swatch-group" key={attribute.name}>
            <div className="landing-swatch-label">
              <span>{isColor ? 'কালার' : isSize ? 'সাইজ' : attribute.name}:</span>
              <b>{selectedVal}</b>
            </div>
            <div className={`landing-swatch-boxes ${isColor ? 'is-color-row' : 'is-size-row'}`}>
              {rawOptions.map((option) => {
                const isSelected = selectedVal === option;
                const savedColor = Object.entries(attribute.optionColors || {}).find(([term]) => term.toLowerCase() === option.toLowerCase())?.[1];
                const hex = savedColor && /^#[0-9a-fA-F]{6}$/.test(savedColor) ? savedColor : colorHexMap[option.toLowerCase()] || '';

                return (
                  <button
                    type="button"
                    key={option}
                    className={`landing-swatch-btn ${isSelected ? 'active' : ''} ${isColor ? 'color-box' : 'size-box'}`}
                    onClick={() => handleAttributeChange(attribute.name, option)}
                    title={option}
                    aria-label={option}
                  >
                    {isColor ? (
                      <span
                        className="landing-swatch-color-preview"
                        style={{
                          backgroundColor: hex || '#333333',
                          border: hex === '#ffffff' ? '1px solid #cbd5e1' : 'none'
                        }}
                      />
                    ) : (
                      <span className="landing-swatch-text">{option}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


