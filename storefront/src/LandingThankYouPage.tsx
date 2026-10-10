import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, ChevronRight, ClipboardCheck, PhoneCall, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { trackOrder } from './api';
import { trackPurchaseOnce } from './analytics';
import type { OrderResult, StorefrontSettings } from './types';
import { publicSupportPhone } from './store-config';

const money = (value: number) => `৳${Math.round(value).toLocaleString('en-BD')}`;

export function LandingThankYouPage({ settings }: { settings: StorefrontSettings }) {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const orderParam = params.get('order') || params.get('orderNumber') || '';

  const normalizedSlug = slug.replace(/^flow-/, '').replace(/-thank-you$/, '');
  const [copied, setCopied] = useState(false);
  const [verifiedOrder, setVerifiedOrder] = useState<Partial<OrderResult> | null>(null);

  const cachedOrder = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('nix-last-order') || 'null');
    } catch {
      return null;
    }
  })();

  const candidate = (location.state || cachedOrder) as (OrderResult & { landingSlug?: string }) | null;
  const matchesLandingOrder = candidate?.orderNumber === orderParam && candidate?.landingSlug === normalizedSlug;
  const order = matchesLandingOrder ? { ...candidate, ...(verifiedOrder?.orderNumber === orderParam ? verifiedOrder : {}) } : null;
  const orderNumber = order?.orderNumber || '';

  useEffect(() => {
    if (!matchesLandingOrder || order?.items?.length || verifiedOrder?.orderNumber === orderParam || !candidate?.customerPhone) return;
    let active = true;
    trackOrder(orderParam, candidate.customerPhone)
      .then(({ order: verified }) => { if (active) setVerifiedOrder(verified); })
      .catch(() => { /* Keep the immediately available confirmation if order verification is unavailable. */ });
    return () => { active = false; };
  }, [orderParam, normalizedSlug, candidate?.orderNumber, candidate?.customerPhone, matchesLandingOrder, order?.items?.length, verifiedOrder?.orderNumber]);

  useEffect(() => {
    document.title = `অর্ডারের তথ্য | ${settings.storeName}`;
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex, nofollow'; document.head.appendChild(robots);
    return () => { robots.remove(); };
  }, [settings.storeName]);

  useEffect(() => {
    if (!order || !order.orderNumber) return;
    trackPurchaseOnce(order.orderNumber, {
      currency: 'BDT',
      value: order.grandTotal,
      shipping: order.deliveryCharge || 0,
      transaction_id: order.orderNumber,
      items: (order.items || []).map((item) => ({
        id: item.productId || item.productName || 'product',
        name: item.productName || item.name || 'Product',
        price: item.unitPrice || item.price || 0,
        quantity: item.quantity || 1,
      })),
    });
  }, [order?.orderNumber, order?.grandTotal]);

  const copyOrderNumber = async () => {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const customerName = order?.customerName || order?.customer?.name || 'সম্মানিত ক্রেতা';
  const customerPhone = order?.customerPhone || order?.customer?.phone || '';
  const customerAddress = order?.deliveryAddress || order?.customer?.address || '';
  const grandTotal = order?.grandTotal ? money(order.grandTotal) : '৳০';
  const deliveryCharge = order?.deliveryCharge !== undefined ? money(order.deliveryCharge) : '৳০';
  const paymentText = order?.paymentMethod === 'UDDOKTAPAY' ? 'অনলাইন পেমেন্ট' : 'ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে মূল্য পরিশোধ)';

  if (!order) return <main className="landing-thankyou-page"><div className="landing-thankyou-shell"><div className="landing-thankyou-card"><h1>অর্ডারের তথ্য পাওয়া যায়নি</h1><p>আপনার অর্ডার নাম্বার ও ফোন দিয়ে অর্ডার ট্র্যাক করুন।</p><Link to="/track-order" className="landing-thankyou-btn primary">অর্ডার ট্র্যাক করুন</Link></div></div></main>;
  // Only show confirmation details for this landing's matching order.
  return (
    <main className="landing-thankyou-page">
      <div className="landing-thankyou-shell">
        <div className="landing-thankyou-card">
          <div className="landing-thankyou-badge-icon">
            <Check size={36} strokeWidth={3} />
          </div>

          <span className="landing-thankyou-eyebrow">ORDER CONFIRMATION</span>
          <h1 className="landing-thankyou-title">
            ধন্যবাদ, {customerName}!<br />
            <span>আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে।</span>
          </h1>

          <p className="landing-thankyou-subtitle">
            আমাদের একজন প্রতিনিধি শীঘ্রই আপনার সাথে যোগাযোগ করে অর্ডারটি কনফার্ম করবেন। অনুগ্রহ করে আপনার ফোনটি সচল রাখুন।
          </p>

          <div className="landing-thankyou-order-box">
            <div className="landing-thankyou-order-header">
              <span>অর্ডার নাম্বার</span>
              <div className="landing-thankyou-order-num">
                <strong>{orderNumber}</strong>
                <button type="button" onClick={copyOrderNumber} aria-label="Copy order number" title="Copy Order Number">
                  <ClipboardCheck size={16} />
                  <span>{copied ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                </button>
              </div>
            </div>

            {!!order.items?.length && (
              <div className="landing-thankyou-products" aria-label="অর্ডার করা পণ্য">
                {order.items.map((item, index) => (
                  <div className="landing-thankyou-product" key={`${item.productId || item.productName || 'item'}-${index}`}>
                    {item.image ? <img src={item.image} alt={item.productName || item.name || 'পণ্য'} /> : <div className="landing-thankyou-product-placeholder" aria-hidden="true"><ShoppingBag size={18} /></div>}
                    <div className="landing-thankyou-product-copy">
                      <b>{item.productName || item.name || 'পণ্য'}</b>
                      <span>পরিমাণ: {item.quantity || 1}</span>
                    </div>
                    <strong>{money((item.unitPrice || item.price || 0) * (item.quantity || 1))}</strong>
                  </div>
                ))}
              </div>
            )}

            <div className="landing-thankyou-details-grid">
              <div>
                <span>গ্রাহকের ফোন নাম্বার</span>
                <b>{customerPhone || '—'}</b>
              </div>
              <div>
                <span>পেমেন্ট পদ্ধতি</span>
                <b>{paymentText}</b>
              </div>
              {customerAddress && (
                <div className="full-width">
                  <span>ডেলিভারি ঠিকানা</span>
                  <b>{customerAddress}</b>
                </div>
              )}
              <div>
                <span>ডেলিভারি চার্জ</span>
                <b>{deliveryCharge}</b>
              </div>
              <div>
                <span>সর্বমোট মূল্য</span>
                <b className="grand-total">{grandTotal}</b>
              </div>
            </div>
          </div>

          <div className="landing-thankyou-features">
            <div className="feature-item">
              <Truck size={20} className="icon" />
              <div>
                <b>সারা দেশে হোম ডেলিভারি</b>
                <span>২-৩ কার্যদিবসের মধ্যে দ্রুত ডেলিভারি</span>
              </div>
            </div>
            <div className="feature-item">
              <ShieldCheck size={20} className="icon" />
              <div>
                <b>১০০% আসল পণ্যের নিশ্চয়তা</b>
                <span>পণ্য দেখে মূল্য পরিশোধ করার সুযোগ</span>
              </div>
            </div>
          </div>

          <div className="landing-thankyou-actions">
            <Link to="/" className="landing-thankyou-btn primary">
              <ShoppingBag size={18} />
              আরও পণ্য দেখুন
            </Link>
            <Link to="/track-order" className="landing-thankyou-btn secondary">
              অর্ডার ট্র্যাক করুন
              <ChevronRight size={18} />
            </Link>
          </div>

          {publicSupportPhone(settings.phone) && (
            <div className="landing-thankyou-help">
              <PhoneCall size={16} />
              <span>যেকোনো প্রয়োজনে কল করুন: <a href={`tel:${settings.phone}`}>{settings.phone}</a></span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
